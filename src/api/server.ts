import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OutscraperRecord } from '../types/outscraper';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';
import { scoreAndFilterCompetitors, ScoredCompetitor, resolveUrl } from '../engine/relevance';
import { computeBenchmarks, BenchmarkData } from '../engine/benchmark';
import {
  searchForWebsite,
  auditSubjectWebsite,
  auditCompetitorWebsites,
  SubjectWebsiteAudit,
  CompetitorWebsiteCheck,
} from '../engine/web-audit';

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

const MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';

const FALLBACK_MODELS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
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
    // ── Step 1: Subject business (Outscraper) ────────────────────────────────
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

    // ── Steps 2 + 3 run in parallel: competitor fetch + subject website audit ─
    const categoryHint = industry?.trim() || subjectRecord?.type || businessName;

    send({ status: `Fetching competitors and auditing websites…` });

    const [rawCandidates, subjectWebsiteAudit] = await Promise.all([
      // Competitor candidates from Outscraper
      outscraperSearch(`${categoryHint} in ${city}`, 20).catch(() => [] as OutscraperRecord[]),

      // Subject website: find URL then audit
      (async (): Promise<SubjectWebsiteAudit | null> => {
        const knownUrl = resolveUrl(subjectRecord ?? {} as OutscraperRecord);
        const url = knownUrl || (subjectRecord
          ? await searchForWebsite(businessName, city)
          : null);

        if (!url) {
          send({ status: `No website found for "${businessName}" — searching competitors…` });
          return null;
        }

        // Store back on record if we found it via search
        if (subjectRecord && !subjectRecord.site && url) {
          subjectRecord.site = url;
        }

        send({ status: `Found website for "${businessName}" — auditing content…` });
        const audit = await auditSubjectWebsite(url);
        send({ status: `Website audit complete (quality score: ${audit.qualityScore}/100)` });
        return audit;
      })(),
    ]);

    // Remove subject from competitor candidates
    const filteredCandidates = subjectRecord?.name
      ? rawCandidates.filter(r => r.name?.toLowerCase().trim() !== subjectRecord!.name!.toLowerCase().trim())
      : rawCandidates;

    // ── Step 4: Relevance scoring ────────────────────────────────────────────
    send({ status: `Scoring ${filteredCandidates.length} competitor candidates for relevance…` });

    let scoredCompetitors: ScoredCompetitor[] = [];
    if (subjectRecord && filteredCandidates.length > 0) {
      scoredCompetitors = scoreAndFilterCompetitors(subjectRecord, filteredCandidates, 45);
    } else {
      scoredCompetitors = filteredCandidates.map(r => ({
        record: r,
        relevanceScore: 50,
        included: true,
        exclusionReason: null,
        hasValidWebsite: !!resolveUrl(r),
        categoryMatch: 'Unscored (no subject)',
        typeGroup: null,
      }));
    }

    const includedCompetitors = scoredCompetitors.filter(c => c.included);
    const excludedCount = scoredCompetitors.length - includedCompetitors.length;

    send({
      status: `${includedCompetitors.length} relevant competitors identified` +
        (excludedCount > 0 ? ` (${excludedCount} excluded as unrelated)` : '') +
        `. Auditing competitor websites…`,
    });

    // ── Step 5: Competitor website audits (parallel, top 10 with URLs) ───────
    const competitorWebsiteChecks: CompetitorWebsiteCheck[] = await auditCompetitorWebsites(
      includedCompetitors.map(c => ({ record: c.record, relevanceScore: c.relevanceScore })),
    );

    const reachableCompetitorSites = competitorWebsiteChecks.filter(c => c.reachable).length;
    send({
      status: `Audited ${competitorWebsiteChecks.length} competitor websites` +
        (reachableCompetitorSites < competitorWebsiteChecks.length
          ? ` (${reachableCompetitorSites} reachable)`
          : '') +
        `. Computing benchmarks…`,
    });

    // ── Step 6: Benchmark computation + contradiction detection ──────────────
    const benchmarkData: BenchmarkData = computeBenchmarks(subjectRecord, scoredCompetitors);

    // ── Step 7: Debug panel SSE event ────────────────────────────────────────
    send({
      debug: {
        subject: subjectRecord ? {
          name: subjectRecord.name,
          type: subjectRecord.type,
          rating: subjectRecord.rating,
          reviews: subjectRecord.reviews,
          photos: subjectRecord.photos_count,
          website: subjectRecord.site || null,
          websiteAudit: subjectWebsiteAudit ? {
            url: subjectWebsiteAudit.url,
            qualityScore: subjectWebsiteAudit.qualityScore,
            ssl: subjectWebsiteAudit.ssl,
            reachable: subjectWebsiteAudit.reachable,
            hasBooking: subjectWebsiteAudit.hasBooking,
            hasPhone: subjectWebsiteAudit.hasPhone,
          } : null,
        } : null,
        competitors: scoredCompetitors.map(c => {
          const webCheck = competitorWebsiteChecks.find(w => w.name === c.record.name);
          return {
            name: c.record.name,
            category: c.record.type,
            subtypes: c.record.subtypes,
            relevanceScore: c.relevanceScore,
            categoryMatch: c.categoryMatch,
            typeGroup: c.typeGroup,
            included: c.included,
            exclusionReason: c.exclusionReason,
            hasWebsite: c.hasValidWebsite,
            websiteUrl: resolveUrl(c.record),
            websiteReachable: webCheck?.reachable ?? null,
            websiteTitle: webCheck?.title ?? null,
            reviews: c.record.reviews,
            rating: c.record.rating,
            businessStatus: c.record.business_status,
          };
        }),
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

    // ── Step 8: Build prompt and stream LLM ──────────────────────────────────
    const includedRecords = includedCompetitors.map(c => c.record);

    const userMessage = buildUserMessage(
      businessName.trim(),
      city.trim(),
      industry?.trim(),
      subjectRecord,
      includedRecords,
      benchmarkData,
      subjectWebsiteAudit,
      competitorWebsiteChecks,
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
        console.error(`[llm] model=${model} failed:`, JSON.stringify(e, Object.getOwnPropertyNames(e as object)));
        const isLastModel = model === modelsToTry[modelsToTry.length - 1];

        if (!isLastModel) {
          // Any per-model failure (deprecated slug, rate limit, capacity, etc.)
          // falls through to the next candidate — a single stale/busy model
          // shouldn't kill the whole report when working fallbacks exist.
          const isRateLimit = /concurrency|rate.?limit|429|capacity/i.test(msg);
          send({ status: `Model unavailable, trying next…` });
          if (isRateLimit) await new Promise(r => setTimeout(r, 1500));
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
