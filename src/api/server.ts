import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import { BusinessProfile } from '../types';
import { parseOutscraperCsv, normalizeOutscraperData } from '../normalizers/outscraper.normalizer';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../../public')));

// OpenRouter uses the OpenAI-compatible API.
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
// POST /api/audit/stream
// Body: { business: BusinessProfile, outscraperCsv: string, dataAgeDays?: number }
// Response: text/event-stream — streams the LLM report in real time
// ---------------------------------------------------------------------------
app.post('/api/audit/stream', async (req: Request, res: Response) => {
  try {
    const { business, outscraperCsv, dataAgeDays = 0 } = req.body as {
      business: BusinessProfile;
      outscraperCsv: string;
      dataAgeDays?: number;
    };

    if (!business || !outscraperCsv) {
      res.status(400).json({ error: 'business and outscraperCsv are required.' });
      return;
    }

    if (!process.env.OPENROUTER_API_KEY) {
      res.status(500).json({
        error: 'OPENROUTER_API_KEY is not set. Add it to your .env file or Railway variables.',
      });
      return;
    }

    // Parse Outscraper CSV
    let rawRecords;
    try {
      rawRecords = parseOutscraperCsv(outscraperCsv);
    } catch {
      res.status(400).json({ error: 'Failed to parse Outscraper CSV. Check the format.' });
      return;
    }

    if (rawRecords.length < 2) {
      res.status(400).json({ error: 'Outscraper CSV must contain at least 2 competitor rows.' });
      return;
    }

    // Normalize into benchmark averages + percentiles
    let competitors;
    try {
      competitors = normalizeOutscraperData(rawRecords, business);
      competitors.dataAgeDays = dataAgeDays;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to normalize competitor data.';
      res.status(400).json({ error: msg });
      return;
    }

    // Human-readable competitor list for the prompt
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

    // Stream from OpenRouter
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

// ---------------------------------------------------------------------------
// POST /api/parse-outscraper
// Preview parsed competitor rows without running the full audit.
// ---------------------------------------------------------------------------
app.post('/api/parse-outscraper', (req: Request, res: Response) => {
  try {
    const { outscraperCsv } = req.body as { outscraperCsv: string };
    if (!outscraperCsv) { res.status(400).json({ error: 'outscraperCsv required' }); return; }

    const records = parseOutscraperCsv(outscraperCsv);
    const preview = records.slice(0, 20).map(r => ({
      name: r.name,
      rating: r.rating,
      reviews: r.reviews,
      photos: r.photos_count,
      category: r.type,
    }));
    res.json({ count: records.length, preview });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Parse error' });
  }
});

// Serve the SPA for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Local Audit Engine → http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('⚠  OPENROUTER_API_KEY not set — audits will fail until you add it.');
  }
});

export default app;
