import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OutscraperRecord } from '../types/outscraper';
import { SYSTEM_PROMPT, buildUserMessage } from '../llm/prompt-builder';
import { scoreAndFilterCompetitors, ScoredCompetitor, ScoreBreakdown, resolveUrl } from './relevance';
import { computeBenchmarks, BenchmarkData } from './benchmark';
import {
  searchForWebsite,
  auditSubjectWebsite,
  auditCompetitorWebsites,
  SubjectWebsiteAudit,
  CompetitorWebsiteCheck,
} from './web-audit';
import { outscraperSearch } from './outscraper';

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

export interface AuditEvent {
  status?: string;
  text?: string;
  debug?: unknown;
}

export interface AuditResult {
  markdown: string;
  debug: unknown;
}

// Runs the full audit pipeline (Outscraper subject + competitor search,
// relevance scoring, website audits, benchmark computation, LLM report
// generation) to completion. `onEvent` is called throughout with the same
// event shapes the original SSE endpoint streamed directly to the browser —
// callers that don't care about progress (e.g. the batch processor) can pass
// a no-op.
export async function runAudit(
  businessName: string,
  city: string,
  industry: string | undefined,
  onEvent: (e: AuditEvent) => void,
): Promise<AuditResult> {
  if (!process.env.OUTSCRAPER_API_KEY) throw new Error('OUTSCRAPER_API_KEY is not set on the server.');
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set on the server.');

  // ── Step 1: Subject business (Outscraper) ────────────────────────────────
  onEvent({ status: `Searching Google Maps for "${businessName}" in ${city}…` });

  let subjectRecord: OutscraperRecord | null = null;
  try {
    console.log(`[outscraper] submitting subject search: "${businessName} ${city}"`);
    const results = await outscraperSearch(`${businessName} ${city}`, 1);
    console.log(`[outscraper] subject search returned ${results.length} result(s)`);
    subjectRecord = results[0] ?? null;

    if (subjectRecord) {
      onEvent({ status: `Found: ${subjectRecord.name} — ${subjectRecord.rating}★ (${subjectRecord.reviews} reviews)` });
    } else {
      onEvent({ status: `No exact match found for "${businessName}". Continuing with competitor data only.` });
    }
  } catch (e: unknown) {
    console.error(`[outscraper] subject search failed for "${businessName} ${city}":`, e instanceof Error ? e.message : e);
    onEvent({ status: `Could not fetch business data: ${e instanceof Error ? e.message : 'unknown error'}` });
  }

  // ── Steps 2 + 3 run in parallel: competitor fetch + subject website audit ─
  const categoryHint = industry?.trim() || subjectRecord?.type || businessName;

  onEvent({ status: `Fetching competitors and auditing websites…` });

  // 12z zoom on a coordinate-anchored query approximates a 15km search radius
  // on Google Maps, vs. a plain "in {city}" text query which Google scopes to
  // the town/suburb boundary rather than a fixed distance.
  const competitorQuery = subjectRecord?.latitude && subjectRecord?.longitude
    ? `${categoryHint} @${subjectRecord.latitude},${subjectRecord.longitude},12z`
    : `${categoryHint} in ${city}`;

  console.log(`[outscraper] submitting competitor search: "${competitorQuery}"`);
  const [rawCandidates, subjectWebsiteAudit] = await Promise.all([
    outscraperSearch(competitorQuery, 20)
      .then(r => { console.log(`[outscraper] competitor search returned ${r.length} result(s)`); return r; })
      .catch((e: unknown) => {
        console.error(`[outscraper] competitor search failed for "${competitorQuery}":`, e instanceof Error ? e.message : e);
        return [] as OutscraperRecord[];
      }),

    (async (): Promise<SubjectWebsiteAudit | null> => {
      const knownUrl = resolveUrl(subjectRecord ?? {} as OutscraperRecord);
      const url = knownUrl || (subjectRecord
        ? await searchForWebsite(businessName, city)
        : null);

      if (!url) {
        onEvent({ status: `No website found for "${businessName}" — searching competitors…` });
        return null;
      }

      if (subjectRecord && !subjectRecord.site && url) {
        subjectRecord.site = url;
      }

      onEvent({ status: `Found website for "${businessName}" — auditing content…` });
      const audit = await auditSubjectWebsite(url);
      onEvent({ status: `Website audit complete (quality score: ${audit.qualityScore}/100)` });
      return audit;
    })(),
  ]);

  const filteredCandidates = subjectRecord?.name
    ? rawCandidates.filter(r => r.name?.toLowerCase().trim() !== subjectRecord!.name!.toLowerCase().trim())
    : rawCandidates;

  // ── Step 4: Relevance scoring ────────────────────────────────────────────
  onEvent({ status: `Scoring ${filteredCandidates.length} competitor candidates for relevance…` });

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

  onEvent({
    status: `${includedCompetitors.length} relevant competitors identified` +
      (excludedCount > 0 ? ` (${excludedCount} excluded as unrelated)` : '') +
      `. Auditing competitor websites…`,
  });

  // ── Step 5: Competitor website audits (parallel, top 10 with URLs) ───────
  const competitorWebsiteChecks: CompetitorWebsiteCheck[] = await auditCompetitorWebsites(
    includedCompetitors.map(c => ({ record: c.record, relevanceScore: c.relevanceScore })),
  );

  const reachableCompetitorSites = competitorWebsiteChecks.filter(c => c.reachable).length;
  onEvent({
    status: `Audited ${competitorWebsiteChecks.length} competitor websites` +
      (reachableCompetitorSites < competitorWebsiteChecks.length
        ? ` (${reachableCompetitorSites} reachable)`
        : '') +
      `. Computing benchmarks…`,
  });

  // ── Step 6: Benchmark computation + contradiction detection ──────────────
  const benchmarkData: BenchmarkData = computeBenchmarks(subjectRecord, scoredCompetitors);

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

  // ── Step 7: Debug payload ─────────────────────────────────────────────────
  const debug = {
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
  };
  onEvent({ debug });

  onEvent({ status: `Generating your report…` });

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
  let markdown = '';
  let streamed = false;
  let lastError: unknown = null;
  const totalPasses = 2;

  passLoop:
  for (let pass = 1; pass <= totalPasses; pass++) {
    for (const model of modelsToTry) {
      try {
        if (!(pass === 1 && model === modelsToTry[0])) {
          onEvent({ status: `Switching to fallback model (${model})…` });
        }

        // The prompt requires a 13-section consultant report -- 4096 tokens
        // (~3000 words) was cutting it off mid-report and silently treating
        // that as a normal finish. 12000 gives real headroom; the model's
        // finish_reason is still checked below in case it's ever not enough.
        const controller = new AbortController();
        let inactivityTimer: ReturnType<typeof setTimeout>;
        const resetInactivityTimer = () => {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(() => controller.abort(), 30000);
        };

        const stream = await openrouter.chat.completions.create(
          {
            model,
            max_tokens: 12000,
            stream: true,
            messages,
          },
          { signal: controller.signal },
        );

        resetInactivityTimer();
        for await (const chunk of stream) {
          resetInactivityTimer();
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            markdown += text;
            onEvent({ text });
          }
          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason) {
            if (finishReason === 'length') {
              console.warn(`[llm] pass=${pass} model=${model} response truncated at max_tokens`);
              onEvent({ status: 'Note: report reached the model\'s output limit and may be truncated.' });
            }
            break;
          }
        }
        clearTimeout(inactivityTimer!);

        streamed = true;
        break passLoop;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[llm] pass=${pass} model=${model} failed: name=${(e as any)?.name} status=${(e as any)?.status} message=${msg}`);
        lastError = e;

        const isRateLimit = /concurrency|rate.?limit|429|capacity|timeout|401/i.test(msg);
        if (isRateLimit) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (pass < totalPasses) {
      onEvent({ status: `All models busy, retrying in a moment…` });
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!streamed) {
    const finalMsg = lastError instanceof Error ? lastError.message : 'All models are currently busy.';
    throw new Error(`${finalMsg} — please try again in a moment.`);
  }

  return { markdown, debug };
}
