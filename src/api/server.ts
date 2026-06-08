import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OutscraperRecord } from '../types/outscraper';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';
import { scoreAndFilterCompetitors, ScoredCompetitor } from '../engine/relevance';
import { computeBenchmarks, BenchmarkData } from '../engine/benchmark';

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

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free';

const FALLBACK_MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemini-2.5-flash:free',
  'deepseek/deepseek-r1:free',
];

// ---------------------------------------------------------------------------
// Outscraper helper
// ---------------------------------------------------------------------------
async function outscraperSearch(query: string, limit = 20): Promise<OutscraperRecord[]> {
  if (!process.env.OUTSCRAPER_API_KEY) throw new Error('OUTSCRAPER_API_KEY is not set.');

  const url =
    `https://api.app.outscraper.com/maps/search-v3` +
    `?query=${encodeURIComponent(query)}&limit=${limit}&async=false&language=en`;

  const res = await fetch(url, {
    headers: { 'X-API-KEY': process.env.OUTSCRAPER_API_KEY, Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Outscraper ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = await res.json() as { status: string; data?: OutscraperRecord[][]; message?: string };

  if (body.status !== 'Success' || !body.data) {
    throw new Error(body.message || 'Outscraper returned an unexpected response.');
  }

  return body.data[0] ?? [];
}

// ---------------------------------------------------------------------------
// POST /api/audit/stream
//
// SSE event types:
//   { status: string }                      — progress update
//   { debug: DebugPayload }                 — competitor analysis panel data
//   { text: string }                        — LLM output chunk
//   { done: true }                          — report complete
//   { error: string }                       — fatal error
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    // ── Step 1: Subject business ─────────────────────────────────────────────
    send({ status: `Searching Google Maps for "${businessName}" in ${city}…` });

    let subjectRecord: OutscraperRecord | null = null;
    try {
      const results = await outscraperSearch(`${businessName} ${city}`, 1);
      subjectRecord = results[0] ?? null;

      if (subjectRecord) {
        send({ status: `Found: ${subjectRecord.name} — ${subjectRecord.rating}★ (${subjectRecord.reviews} reviews)` });
      } else {
        send({ status: `No exact match found for "${businessName}". Continuing with competitor data only.` });
      }
    } catch (e: unknown) {
      send({ status: `Could not fetch business data: ${e instanceof Error ? e.message : 'unknown error'}` });
    }

    // ── Step 2: Competitor candidates ────────────────────────────────────────
    const categoryHint = industry?.trim() || subjectRecord?.type || businessName;
    send({ status: `Fetching competitor candidates for "${categoryHint}" in ${city}…` });

    let rawCandidates: OutscraperRecord[] = [];
    try {
      rawCandidates = await outscraperSearch(`${categoryHint} in ${city}`, 20);

      // Remove the subject itself from candidates
      if (subjectRecord?.name) {
        const subjectNameNorm = subjectRecord.name.toLowerCase().trim();
        rawCandidates = rawCandidates.filter(
          r => r.name?.toLowerCase().trim() !== subjectNameNorm,
        );
      }
    } catch (e: unknown) {
      send({ status: `Competitor fetch failed: ${e instanceof Error ? e.message : 'error'}. Continuing.` });
    }

    // ── Step 3: Relevance scoring + filtering ────────────────────────────────
    send({ status: `Scoring ${rawCandidates.length} competitor candidates for relevance…` });

    let scoredCompetitors: ScoredCompetitor[] = [];
    if (subjectRecord && rawCandidates.length > 0) {
      scoredCompetitors = scoreAndFilterCompetitors(subjectRecord, rawCandidates, 70);
    } else {
      // No subject to score against — include all candidates
      scoredCompetitors = rawCandidates.map(r => ({
        record: r,
        relevanceScore: 50,
        included: true,
        exclusionReason: null,
        hasValidWebsite: !!(r.site?.trim()),
        categoryMatch: 'Unscored (no subject)',
        typeGroup: null,
      }));
    }

    const includedCompetitors = scoredCompetitors.filter(c => c.included);
    const excludedCount = scoredCompetitors.length - includedCompetitors.length;

    send({
      status: `${includedCompetitors.length} relevant competitors identified` +
        (excludedCount > 0 ? ` (${excludedCount} excluded as unrelated)` : '') +
        `. Computing benchmarks…`,
    });

    // ── Step 4: Benchmarks + contradiction detection ──────────────────────────
    const benchmarkData: BenchmarkData = computeBenchmarks(subjectRecord, scoredCompetitors);

    // ── Step 5: Emit debug panel data ────────────────────────────────────────
    send({
      debug: {
        subject: subjectRecord ? {
          name: subjectRecord.name,
          type: subjectRecord.type,
          rating: subjectRecord.rating,
          reviews: subjectRecord.reviews,
          photos: subjectRecord.photos_count,
          website: subjectRecord.site || null,
        } : null,
        competitors: scoredCompetitors.map(c => ({
          name: c.record.name,
          category: c.record.type,
          subtypes: c.record.subtypes,
          relevanceScore: c.relevanceScore,
          categoryMatch: c.categoryMatch,
          typeGroup: c.typeGroup,
          included: c.included,
          exclusionReason: c.exclusionReason,
          hasWebsite: c.hasValidWebsite,
          websiteUrl: c.record.site || null,
          reviews: c.record.reviews,
          rating: c.record.rating,
          businessStatus: c.record.business_status,
        })),
        benchmarks: {
          totalCandidates: benchmarkData.totalCandidates,
          included: benchmarkData.includedCount,
          excluded: benchmarkData.excludedCount,
          websiteSummary: benchmarkData.websiteValidationSummary,
          avgRating: benchmarkData.avgRating,
          avgReviews: benchmarkData.avgReviews,
          avgPhotos: benchmarkData.avgPhotos,
          confidence: benchmarkData.benchmarkConfidence,
          confidenceReasons: benchmarkData.confidenceReasons,
          constraints: benchmarkData.constraints,
        },
      },
    });

    send({ status: `Generating your report…` });

    // ── Step 6: Build prompt and stream LLM ──────────────────────────────────
    const includedRecords = includedCompetitors.map(c => c.record);

    const userMessage = buildUserMessage(
      businessName.trim(),
      city.trim(),
      industry?.trim(),
      subjectRecord,
      includedRecords,
      benchmarkData,
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
        const isRateLimit = /concurrency|rate.?limit|429|capacity|endpoint/i.test(msg);
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
