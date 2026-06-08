import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import { BusinessProfile } from '../types';
import { OutscraperRecord } from '../types/outscraper';
import { normalizeOutscraperData, parseOutscraperCsv } from '../normalizers/outscraper.normalizer';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../../public')));

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
    'X-Title': 'Local Visibility Audit',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

// ---------------------------------------------------------------------------
// POST /api/fetch-competitors
// Calls the Outscraper Google Maps API and returns up to 20 competitor records.
// Body: { query: string, limit?: number }
// ---------------------------------------------------------------------------
app.post('/api/fetch-competitors', async (req: Request, res: Response) => {
  try {
    const { query, limit = 20 } = req.body as { query: string; limit?: number };

    if (!query?.trim()) {
      res.status(400).json({ error: 'query is required (e.g. "plumber in Melbourne")' });
      return;
    }

    if (!process.env.OUTSCRAPER_API_KEY) {
      res.status(500).json({
        error: 'OUTSCRAPER_API_KEY is not set. Add it to your .env file or Railway variables.',
      });
      return;
    }

    const url =
      `https://api.app.outscraper.com/maps/search-v3` +
      `?query=${encodeURIComponent(query.trim())}` +
      `&limit=${Math.min(limit, 20)}` +
      `&async=false` +
      `&language=en`;

    const apiRes = await fetch(url, {
      headers: {
        'X-API-KEY': process.env.OUTSCRAPER_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      res.status(502).json({ error: `Outscraper API error ${apiRes.status}: ${text.slice(0, 200)}` });
      return;
    }

    const body = await apiRes.json() as {
      status: string;
      data?: OutscraperRecord[][];
      message?: string;
    };

    if (body.status !== 'Success' || !body.data) {
      res.status(502).json({ error: body.message || 'Outscraper returned an unexpected response.' });
      return;
    }

    // data is an array-of-arrays (one inner array per query string sent)
    const records: OutscraperRecord[] = body.data[0] ?? [];

    if (!records.length) {
      res.status(404).json({ error: 'No results found for that query. Try a broader search term.' });
      return;
    }

    const preview = records.map(r => ({
      name: r.name,
      rating: r.rating,
      reviews: r.reviews,
      photos: r.photos_count,
      category: r.type,
    }));

    res.json({ count: records.length, records, preview });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch competitors';
    console.error('Outscraper fetch error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/audit/stream
// Accepts business details + competitor records (JSON from Outscraper API).
// Streams the LLM report via Server-Sent Events.
//
// Body: {
//   business: BusinessProfile,
//   outscraperRecords: OutscraperRecord[],   ← from /api/fetch-competitors
//   dataAgeDays?: number
// }
// ---------------------------------------------------------------------------
app.post('/api/audit/stream', async (req: Request, res: Response) => {
  try {
    const { business, outscraperRecords, outscraperCsv, dataAgeDays = 0 } = req.body as {
      business: BusinessProfile;
      outscraperRecords?: OutscraperRecord[];
      outscraperCsv?: string;      // legacy fallback
      dataAgeDays?: number;
    };

    if (!business) {
      res.status(400).json({ error: 'business is required.' });
      return;
    }

    if (!process.env.OPENROUTER_API_KEY) {
      res.status(500).json({
        error: 'OPENROUTER_API_KEY is not set. Add it to your .env file or Railway variables.',
      });
      return;
    }

    // Accept either pre-fetched JSON records or a raw CSV string (backward compat)
    let rawRecords: OutscraperRecord[];
    if (outscraperRecords?.length) {
      rawRecords = outscraperRecords;
    } else if (outscraperCsv) {
      rawRecords = parseOutscraperCsv(outscraperCsv);
    } else {
      res.status(400).json({ error: 'outscraperRecords or outscraperCsv is required.' });
      return;
    }

    if (rawRecords.length < 2) {
      res.status(400).json({ error: 'Need at least 2 competitor records to benchmark.' });
      return;
    }

    let competitors;
    try {
      competitors = normalizeOutscraperData(rawRecords, business);
      competitors.dataAgeDays = dataAgeDays;
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Normalisation error.' });
      return;
    }

    const outscraperSummary = rawRecords
      .slice(0, 20)
      .map((r, i) =>
        `${i + 1}. ${r.name || 'Unknown'} — ${r.rating ?? '?'}★ (${r.reviews ?? '?'} reviews), ${r.photos_count ?? '?'} photos, category: ${r.type ?? 'N/A'}`,
      )
      .join('\n');

    const userMessage = buildUserMessage(business, competitors, outscraperSummary);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      const stream = await openrouter.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) send({ text });
        if (chunk.choices[0]?.finish_reason) {
          send({ done: true });
          res.end();
          return;
        }
      }

      send({ done: true });
      res.end();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LLM error';
      console.error('OpenRouter error:', msg);
      send({ error: `OpenRouter error: ${msg}` });
      res.end();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('Server error:', msg);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

// Serve the SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Local Audit Engine → http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  if (!process.env.OPENROUTER_API_KEY) console.warn('⚠  OPENROUTER_API_KEY not set');
  if (!process.env.OUTSCRAPER_API_KEY) console.warn('⚠  OUTSCRAPER_API_KEY not set');
});

export default app;
