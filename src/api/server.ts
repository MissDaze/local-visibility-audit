import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OutscraperRecord } from '../types/outscraper';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';
import { scoreAndFilterCompetitors, ScoredCompetitor, ScoreBreakdown, resolveUrl } from '../engine/relevance';
import { computeBenchmarks, BenchmarkData } from '../engine/benchmark';
import {
  searchForWebsite,
  auditSubjectWebsite,
  auditCompetitorWebsites,
  SubjectWebsiteAudit,
  CompetitorWebsiteCheck,
} from '../engine/web-audit';
import { demoGate } from '../middleware/demoGate';

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

// Paid model (user-selected: qwen3.5-122b-a10b, $0.26/1M input, $2.08/1M
// output as of 2026-07-16). Free-tier ":free" models were unreliable in
// production (see repo history); a paid model isn't subject to the same
// throttling, and this still costs a fraction of a cent per report.
const MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen3.5-122b-a10b';

const FALLBACK_MODELS = [
  'qwen/qwen-2.5-7b-instruct',
];

// ---------------------------------------------------------------------------
// Outscraper helper
// ---------------------------------------------------------------------------
// Outscraper's async=false (synchronous) mode holds a concurrency slot open
// for the full scrape duration. It has proven unreliable under load — it can
// hang with no response at all, or return "Too many requests" — even while
// Outscraper's own dashboard keeps working fine. The dashboard (and this
// async=true mode) go through Outscraper's normal job-queue pipeline instead:
// submit the job, then poll the returned results_location until it's done.
async function outscraperSearch(query: string, limit = 20, maxWaitMs = 120000): Promise<OutscraperRecord[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY is not set.');

  const submitUrl =
    `https://api.app.outscraper.com/maps/search-v3` +
    `?query=${encodeURIComponent(query)}&limit=${limit}&async=true&language=en`;

  console.log(`[outscraper] fetch → ${submitUrl}`);
  const submitRes = await fetch(submitUrl, {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });
  console.log(`[outscraper] submit response status: ${submitRes.status}`);

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Outscraper ${submitRes.status}: ${text.slice(0, 200)}`);
  }

  const submitBody = await submitRes.json() as {
    status: string;
    results_location?: string;
    message?: string;
  };
  console.log(`[outscraper] submit body:`, JSON.stringify(submitBody).slice(0, 300));

  if (!submitBody.results_location) {
    throw new Error(submitBody.message || 'Outscraper did not return a results_location.');
  }

  const pollIntervalMs = 4000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const pollRes = await fetch(submitBody.results_location, {
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    });

    if (!pollRes.ok) continue; // transient — keep polling until the deadline

    const pollBody = await pollRes.json() as {
      status: string;
      data?: OutscraperRecord[][];
      message?: string;
    };

    if (pollBody.status === 'Success') {
      return pollBody.data?.[0] ?? [];
    }
    if (pollBody.status !== 'Pending') {
      throw new Error(pollBody.message || `Outscraper job ended with status "${pollBody.status}".`);
    }
    // else still Pending — keep polling
  }

  throw new Error(`Outscraper job timed out after ${maxWaitMs}ms waiting for results.`);
}

// ---------------------------------------------------------------------------
// POST /api/audit/stream
// ---------------------------------------------------------------------------
app.post('/api/audit/stream', demoGate, async (req: Request, res: Response) => {
  console.log('[audit] request received', new Date().toISOString());
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

  // SSE keepalive: the Outscraper async submit+poll can take up to ~2
  // minutes per call now, during which no application data is sent. A
  // periodic comment ping keeps the connection from looking idle to any
  // intermediary (proxy, browser) that might otherwise time it out.
  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);

  try {
    // ── Step 1: Subject business (Outscraper) ────────────────────────────────
    send({ status: `Searching Google Maps for "${businessName}" in ${city}…` });

    let subjectRecord: OutscraperRecord | null = null;
    try {
      console.log(`[outscraper] submitting subject search: "${businessName} ${city}"`);
      const results = await outscraperSearch(`${businessName} ${city}`, 1);
      console.log(`[outscraper] subject search returned ${results.length} result(s)`);
      subjectRecord = results[0] ?? null;

      if (subjectRecord) {
        send({ status: `Found: ${subjectRecord.name} — ${subjectRecord.rating}★ (${subjectRecord.reviews} reviews)` });
      } else {
        send({ status: `No exact match found for "${businessName}". Continuing with competitor data only.` });
      }
    } catch (e: unknown) {
      console.error(`[outscraper] subject search failed for "${businessName} ${city}":`, e instanceof Error ? e.message : e);
      send({ status: `Could not fetch business data: ${e instanceof Error ? e.message : 'unknown error'}` });
    }

    // ── Steps 2 + 3 run in parallel: competitor fetch + subject website audit ─
    const categoryHint = industry?.trim() || subjectRecord?.type || businessName;

    send({ status: `Fetching competitors and auditing websites…` });

    console.log(`[outscraper] submitting competitor search: "${categoryHint} in ${city}"`);
    const [rawCandidates, subjectWebsiteAudit] = await Promise.all([
      // Competitor candidates from Outscraper
      outscraperSearch(`${categoryHint} in ${city}`, 20)
        .then(r => { console.log(`[outscraper] competitor search returned ${r.length} result(s)`); return r; })
        .catch((e: unknown) => {
          console.error(`[outscraper] competitor search failed for "${categoryHint} in ${city}":`, e instanceof Error ? e.message : e);
          return [] as OutscraperRecord[];
        }),

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
      const unscoredBreakdown: ScoreBreakdown = {
        categoryRaw: 0, categoryWeighted: 0,
        typeGroupRaw: 0, typeGroupWeighted: 0,
        keywordRaw: 0, keywordWeighted: 0,
        distanceRaw: 0, distanceWeighted: 0,
        weakestFactor: 'n/a (no subject to compare against)',
      };
      scoredCompetitors = filteredCandidates.map(r => ({
        record: r,
        relevanceScore: 50,
        included: true,
        exclusionReason: null,
        hasValidWebsite: !!resolveUrl(r),
        categoryMatch: 'Unscored (no subject)',
        typeGroup: null,
        scoreBreakdown: unscoredBreakdown,
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

    // Server-side log of excluded candidates + why (also visible in Railway
    // logs, in case the SSE debug panel isn't handy) — temporary diagnostic
    // for tuning the relevance filter, not part of the audit output itself.
    const excludedForLog = scoredCompetitors.filter(c => !c.included);
    if (excludedForLog.length > 0) {
      console.log(`[relevance] ${excludedForLog.length}/${scoredCompetitors.length} excluded:`);
      for (const c of excludedForLog) {
        console.log(
          `  - "${c.record.name}" (${c.record.type || 'no category'}) ` +
          `score=${c.relevanceScore} reason="${c.exclusionReason}" ` +
          `breakdown=${JSON.stringify(c.scoreBreakdown)}`,
        );
      }
    }

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
            scoreBreakdown: c.scoreBreakdown,
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
    let lastError: unknown = null;
    const totalPasses = 2;

    passLoop:
    for (let pass = 1; pass <= totalPasses; pass++) {
      for (const model of modelsToTry) {
        try {
          if (!(pass === 1 && model === modelsToTry[0])) {
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
          break passLoop;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[llm] pass=${pass} model=${model} failed: name=${(e as any)?.name} status=${(e as any)?.status} message=${msg}`);
          lastError = e;

          // Any per-model failure (deprecated slug, rate limit, capacity, upstream
          // timeout, etc.) falls through to the next candidate — a single stale
          // or busy model shouldn't kill the whole report when others exist.
          const isRateLimit = /concurrency|rate.?limit|429|capacity|timeout|401/i.test(msg);
          if (isRateLimit) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (pass < totalPasses) {
        send({ status: `All models busy, retrying in a moment…` });
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!streamed) {
      const finalMsg = lastError instanceof Error ? lastError.message : 'All models are currently busy.';
      throw new Error(`${finalMsg} — please try again in a moment.`);
    }

    send({ done: true });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Audit stream error:', msg);
    send({ error: msg });
    res.end();
  } finally {
    clearInterval(keepAlive);
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
