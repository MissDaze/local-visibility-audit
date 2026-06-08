import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OutscraperRecord } from '../types/outscraper';
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

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash:free';

// Free-tier fallback chain — tried in order if the primary model is rate-limited.
const FALLBACK_MODELS = [
  'deepseek/deepseek-r1:free',
  'meta-llama/llama-4-scout:free',
  'meta-llama/llama-3.3-70b:free',
];

// ---------------------------------------------------------------------------
// Outscraper helper — fetch up to `limit` Google Maps results for a query.
// ---------------------------------------------------------------------------
async function outscraperSearch(query: string, limit = 20): Promise<OutscraperRecord[]> {
  if (!process.env.OUTSCRAPER_API_KEY) {
    throw new Error('OUTSCRAPER_API_KEY is not set.');
  }

  const url =
    `https://api.app.outscraper.com/maps/search-v3` +
    `?query=${encodeURIComponent(query)}` +
    `&limit=${limit}` +
    `&async=false` +
    `&language=en`;

  const res = await fetch(url, {
    headers: {
      'X-API-KEY': process.env.OUTSCRAPER_API_KEY,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outscraper ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = await res.json() as {
    status: string;
    data?: OutscraperRecord[][];
    message?: string;
  };

  if (body.status !== 'Success' || !body.data) {
    throw new Error(body.message || 'Outscraper returned an unexpected response.');
  }

  return body.data[0] ?? [];
}

// ---------------------------------------------------------------------------
// POST /api/audit/stream
//
// Body: { businessName: string, city: string, industry?: string }
//
// SSE event types:
//   { status: string }          — progress update shown to user
//   { text: string }            — LLM output chunk (append to report)
//   { done: true }              — report complete
//   { error: string }           — fatal error
// ---------------------------------------------------------------------------
app.post('/api/audit/stream', async (req: Request, res: Response) => {
  const { businessName, city, industry } = req.body as {
    businessName: string;
    city: string;
    industry?: string;
  };

  if (!businessName?.trim() || !city?.trim()) {
    res.status(400).json({ error: 'businessName and city are required.' });
    return;
  }

  if (!process.env.OUTSCRAPER_API_KEY) {
    res.status(500).json({ error: 'OUTSCRAPER_API_KEY is not set on the server.' });
    return;
  }

  if (!process.env.OPENROUTER_API_KEY) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY is not set on the server.' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    // ── Step 1: Find the subject business ────────────────────────────────────
    send({ status: `Searching Google Maps for "${businessName}" in ${city}…` });

    let subjectRecord: OutscraperRecord | null = null;
    try {
      const results = await outscraperSearch(`${businessName} ${city}`, 1);
      subjectRecord = results[0] ?? null;

      if (subjectRecord) {
        send({
          status: `Found: ${subjectRecord.name} — ${subjectRecord.rating}★ (${subjectRecord.reviews} reviews)`,
        });
      } else {
        send({ status: `No exact match found for "${businessName}". Continuing with competitor data only.` });
      }
    } catch (e: unknown) {
      send({ status: `Could not fetch business data: ${e instanceof Error ? e.message : 'unknown error'}` });
    }

    // ── Step 2: Determine competitor search category ──────────────────────────
    const categoryHint =
      industry?.trim() ||
      subjectRecord?.type ||
      businessName; // fallback: use the business name itself as the search seed

    send({ status: `Fetching top 20 competitors for "${categoryHint}" in ${city}…` });

    let competitorRecords: OutscraperRecord[] = [];
    try {
      competitorRecords = await outscraperSearch(`${categoryHint} in ${city}`, 20);

      // Remove the subject business from competitors if it appears in the list
      if (subjectRecord?.name) {
        competitorRecords = competitorRecords.filter(
          r => r.name?.toLowerCase().trim() !== subjectRecord!.name?.toLowerCase().trim(),
        );
      }

      send({ status: `Found ${competitorRecords.length} competitors. Generating your report…` });
    } catch (e: unknown) {
      send({ status: `Competitor fetch failed: ${e instanceof Error ? e.message : 'error'}. Continuing with available data.` });
    }

    // ── Step 3: Stream from LLM ───────────────────────────────────────────────
    const userMessage = buildUserMessage(
      businessName.trim(),
      city.trim(),
      industry?.trim(),
      subjectRecord,
      competitorRecords,
    );

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const modelsToTry = [MODEL, ...FALLBACK_MODELS.filter(m => m !== MODEL)];
    let streamed = false;

    for (const model of modelsToTry) {
      try {
        if (model !== modelsToTry[0]) {
          send({ status: `Switching to fallback model (${model})…` });
        }

        const stream = await openrouter.chat.completions.create({
          model,
          max_tokens: 4096,
          stream: true,
          messages,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) send({ text });
          if (chunk.choices[0]?.finish_reason) break;
        }

        streamed = true;
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const isRateLimit = /concurrency|rate.?limit|429|capacity/i.test(msg);
        if (isRateLimit && model !== modelsToTry[modelsToTry.length - 1]) {
          send({ status: `Model busy, trying next…` });
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw e;
      }
    }

    if (!streamed) throw new Error('All models are currently busy. Please try again in a moment.');

    send({ done: true });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Audit stream error:', msg);
    send({ error: msg });
    res.end();
  }
});

// Serve the SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Local Audit Engine → http://localhost:${PORT}`);
  console.log(`Model: ${MODEL}`);
  if (!process.env.OUTSCRAPER_API_KEY) console.warn('⚠  OUTSCRAPER_API_KEY not set');
  if (!process.env.OPENROUTER_API_KEY) console.warn('⚠  OPENROUTER_API_KEY not set');
});

export default app;
