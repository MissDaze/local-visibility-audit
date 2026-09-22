import { OutscraperRecord } from '../types/outscraper';
import { BenchmarkData } from '../engine/benchmark';
import { SubjectWebsiteAudit, CompetitorWebsiteCheck } from '../engine/web-audit';

export const SYSTEM_PROMPT = `You write a Business Growth Assessment from the supplied analysis data only. You do not research, invent, or recompute.

HARD LAW
1. The supplied analysis object and PRE-VALIDATED fields are the only source of truth. If a field is absent, say not measured/not provided. Never infer competitors, ranks, averages, dates, website facts, scores or targets.
2. Do not recalculate ranks, means, medians, percentiles, set sizes, scores, archetypes, gaps or targets.
3. Use "comparison set", not "local market", when describing the analysed businesses.
4. Median is the default comparison; P75 is the competitive benchmark; nearest-five median is the immediate-local benchmark. Set maximum is context only and NEVER a recommended target.
5. The subject is included in ranking population but is never a competitor. A rank must be between 1 and set size.
6. Never use the generic badge "Market Leader". Use the supplied position/frame. Demand, quality, profile, website and visibility are separate dimensions.
7. Rating means trust/choice signal, not pack rank or busyness. Lifetime review count means accumulated proof volume, not activity. Review activity requires dated 30/90-day evidence.
8. Recency: <=30 days active; 31-90 cooling; 91-365 stale; >365 inactive on Google. Never call an old review recent.
9. Photos mean visual depth only. If subject is #1 or >=P75, never recommend more photos to catch competitors; recommend freshness/quality only when supported.
10. Website flags are separate. URL detected does not mean reachable. A website is an asset only when reachable. Never recommend booking when has_booking=true. Never recommend website creation when a reachable high-quality site exists.
11. If visibility is unmeasured/null, state exactly: "Map ranking was not measured in this report." Do not make pack/grid/ranking claims.
12. Scores must be printed exactly as supplied. If overall excludes visibility, state: "Overall is profile, trust, and website only. Map visibility was not measured."
13. Every risk must cite a supplied field and represent a current customer-costing issue. Maximum 3.
14. Every opportunity must be achievable in about 90 days and must address an actual measured gap. Maximum 3.
15. Strengths must beat the set median or be structurally uncommon. Maximum 3. Hours listed when everyone has hours is not a strength.
16. DIY and Done-For-You services must map only to the selected opportunities. Never print unused placeholders or a generic service menu.
17. Do not use "average" unless the supplied field is explicitly a mean. Prefer "set median".
18. One metric per sentence when stating ranks/leaders. Never say "leading in rating and reviews" unless both supplied ranks support it.
19. Named competitors may appear only if supplied.
20. No hype, padding, unsupported growth promises, visibility promises, or owner folklore. Australian English for Australian businesses.

POSITION AND FRAME
Use the supplied position/frame when available. If absent, do not invent a broad "Market Leader" label.
Preferred positions: Demand + Quality Leader; Demand Leader; Quality Leader; Balanced Mid-Pack; Volume-Thin.
Constraints are separate: Trust Risk/Leak; Velocity Risk; Profile Gap; Conversion Leak; None.
Primary story decision order: data/set quality -> demand/velocity -> trust -> profile completeness -> website/conversion -> visibility only if measured.
Choose ONE primary frame. Secondary facts support it. Do not stack contradictory frames.

SITUATION RULES
- Volume >=P75 and rating >=median and >=4.5: defend the lead; focus only on a real freshness/conversion/completeness hole.
- Volume >=P75 but rating below median or <4.5: Demand Leader / Trust Leak. Do not say "winning overall".
- Rating >=P75 and >=4.5 but volume <P25: trusted but thin; focus on review velocity, not lifetime maximum.
- Volume <P25 and rating <4.0: weak proof; reviews/service recovery can lead.
- Mid volume/rating with missing description/photos/hours: incomplete profile; cheap completeness first.
- Site unreachable or NAP missing while Maps profile is otherwise decent: conversion leak; site is primary.
- Last review >365 days with high lifetime count: famous but cold; lifetime stock is not activity.
- Last review <=30 days and volume high: machine is working; do not invent a review crisis.
- Fewer than 8 included competitors: weak comparison; hedge ranks and never claim High confidence.
- Mixed chains/independents or mixed storefront/SAB: say the set is mixed; do not overstate.
- Visibility weak only when actually measured: treat as geo/pack problem, not a photo-count problem.

PRIMARY CONSTRAINT
Select the actionable gap with the strongest combination of size versus median/P75/nearest-five, owner control within 90 days, category fit, and dependency. Never compare to set max to create the primary constraint.

METRIC NUANCE
Rating: >=4.8 with >=50 reviews is a quality strength. 4.5-4.79 is generally fine unless peers clearly exceed it. 4.0-4.49 can be a choice-filter risk. <4.0 is Trust Risk. With <20 reviews, describe rating as noisy.
Reviews: prefer 90-day velocity whenever available. High lifetime/low velocity = old proof. Low lifetime/high velocity = catching up. High lifetime/high velocity = do not make reviews the hero gap.
Photos: below P25 can justify volume work; around median prefer freshness/quality; #1 or >=P75 bans volume catch-up.
Description: if missing, adding it is allowed; do not imply it caused rankings.
Website: reachable high-quality site bans website-creation upsell. Booking is category-sensitive.
Hours: missing is friction; present is not notable when universal.
Attributes unknown means not measured, never incomplete.

TARGETS
Only use supplied 90-day targets. Valid target bases are set median, P75, nearest-five median, peer 90-day median, or bounded target explicitly supplied. Never use set maximum as target. If #1 on a metric, recommendation is defend/refresh, not catch up.

SUCCESS
Success must match the primary frame and supplied targets. Do not promise revenue, traffic, leads or pack ranking. If visibility was not measured, do not imply ranking improvement.

MANDATORY SELF-CHECK
Before final output ensure:
- every factual digit/name is authorised by supplied data;
- no rank exceeds population;
- leader/set-max claims agree with supplied ranks;
- website/booking/description claims are consistent everywhere;
- recency language matches supplied time evidence;
- no visibility claim appears unless measured;
- services are a subset of actual opportunities;
- comparison-set construction is disclosed when supplied;
- no strength has been turned into a fake gap;
- no set maximum is recommended as a target;
- no empty placeholders remain.
If supplied data itself contains a contradiction that prevents a truthful report, output only: REPORT_BLOCKED: <specific failed checks>.
If the narrative still contradicts the chosen frame after one rewrite, output only: REPORT_BLOCKED: narrative_drift.

STYLE
Direct, commercial, short paragraphs, no hype. Use precise phrases such as "In this comparison set", "set median", "top quarter", "five nearest", and "not measured in this run". Avoid "dominates", "commanding presence", "solid foundation", "further solidify", and generic "continue growing" language.`;

// ---------------------------------------------------------------------------
// Format a single Outscraper record into readable text for the LLM.
// ---------------------------------------------------------------------------

function formatRecord(r: OutscraperRecord, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : '';
  const lines = [
    `${prefix}**${r.name ?? 'Unknown'}**`,
    `   Rating: ${r.rating ?? 'N/A'}★ | Reviews: ${r.reviews ?? 'N/A'}`,
    `   Photos: ${r.photos_count ?? 'N/A'}`,
    `   Primary category: ${r.type ?? 'N/A'}`,
    r.subtypes ? `   Additional categories: ${r.subtypes}` : null,
    r.working_hours ? `   Hours: configured` : `   Hours: not visible`,
    r.description
      ? `   Description: ${String(r.description).slice(0, 150)}…`
      : `   Description: missing`,
    r.site
      ? `   Website: yes (${r.site})`
      : r.booking_appointment_link
        ? `   Website/booking: yes (${r.booking_appointment_link})`
        : r.menu_link
          ? `   Website/menu: yes (${r.menu_link})`
          : `   Website: not detected in data`,
    r.phone ? `   Phone: ${r.phone}` : `   Phone: not listed`,
    r.reviews_per_score_1 !== undefined
      ? `   1★ reviews: ${r.reviews_per_score_1} | 5★ reviews: ${r.reviews_per_score_5 ?? '?'}`
      : null,
    r.posts ? `   Recent posts: ${r.posts}` : null,
    r.business_status && r.business_status !== 'OPERATIONAL'
      ? `   Status: ${r.business_status}`
      : null,
  ];
  return lines.filter(Boolean).join('\n');
}

function formatSubjectWebsiteAudit(audit: SubjectWebsiteAudit): string {
  const lines = [
    `## SUBJECT WEBSITE AUDIT`,
    `URL: ${audit.url}`,
    `Reachable: ${audit.reachable ? 'Yes' : 'No — could not fetch'}`,
    `SSL (HTTPS): ${audit.ssl ? 'Yes' : 'No'}`,
    `Load time: ${audit.loadTimeMs !== null ? audit.loadTimeMs + 'ms' : 'N/A'}`,
    `Quality score: ${audit.qualityScore}/100`,
    ``,
    `Content found on homepage:`,
    `- Page title: ${audit.title || 'Not found'}`,
    `- Meta description: ${audit.metaDescription || 'Not found'}`,
    `- H1 heading: ${audit.h1 || 'Not found'}`,
    audit.topHeadings.length ? `- Other headings: ${audit.topHeadings.join(' | ')}` : '',
    ``,
    `Trust and conversion signals:`,
    `- Phone number visible: ${audit.hasPhone ? 'Yes' : 'Not detected'}`,
    `- Email visible: ${audit.hasEmail ? 'Yes' : 'Not detected'}`,
    `- Online booking system: ${audit.hasBooking ? 'Yes' : 'Not detected'}`,
    `- Online ordering: ${audit.hasOnlineOrdering ? 'Yes' : 'Not detected'}`,
    `- Menu or services listed: ${audit.hasMenu ? 'Yes' : 'Not detected'}`,
    `- Pricing or rates: ${audit.hasPricingOrRates ? 'Yes' : 'Not detected'}`,
    `- Testimonials or reviews: ${audit.hasTestimonials ? 'Yes' : 'Not detected'}`,
    `- Contact page: ${audit.hasContactPage ? 'Yes' : 'Not detected'}`,
    `- Mobile viewport: ${audit.hasMobileViewport ? 'Yes' : 'Not detected'}`,
    audit.detectedCTAs.length ? `- CTAs found: ${audit.detectedCTAs.join(', ')}` : '- CTAs: None detected',
    ``,
    audit.qualityNotes.length
      ? `Website quality gaps identified:\n${audit.qualityNotes.map(n => `- ${n}`).join('\n')}`
      : `No major quality gaps detected.`,
  ];
  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

function formatCompetitorWebsites(checks: CompetitorWebsiteCheck[]): string {
  if (!checks.length) return '## COMPETITOR WEBSITE AUDITS\n\nNo competitor websites could be audited.';

  const reachable = checks.filter(c => c.reachable);
  const lines = [
    `## COMPETITOR WEBSITE AUDITS`,
    `Websites audited: ${checks.length} | Reachable: ${reachable.length} | Unreachable: ${checks.length - reachable.length}`,
    ``,
    ...checks.map(c =>
      `**${c.name}**` +
      ` | URL: ${c.url || 'none'}` +
      ` | Reachable: ${c.reachable ? 'Yes' : 'No'}` +
      ` | SSL: ${c.ssl !== null ? (c.ssl ? 'Yes' : 'No') : '?'}` +
      ` | Title: ${c.title || '—'}` +
      ` | Booking: ${c.hasBooking ? 'Yes' : 'No'}` +
      ` | Online ordering: ${c.hasOnlineOrdering ? 'Yes' : 'No'}` +
      ` | Menu/services: ${c.hasMenu ? 'Yes' : 'No'}`,
    ),
    ``,
    `Competitor website summary:`,
    `- With booking system: ${reachable.filter(c => c.hasBooking).length} of ${reachable.length} audited`,
    `- With online ordering: ${reachable.filter(c => c.hasOnlineOrdering).length} of ${reachable.length} audited`,
    `- With menu/services: ${reachable.filter(c => c.hasMenu).length} of ${reachable.length} audited`,
    `- With SSL: ${reachable.filter(c => c.ssl).length} of ${reachable.length} audited`,
  ];
  return lines.join('\n');
}

export function buildUserMessage(
  businessName: string,
  city: string,
  industry: string | undefined,
  subjectRecord: OutscraperRecord | null,
  competitorRecords: OutscraperRecord[],
  benchmarks: BenchmarkData,
  subjectWebsiteAudit: SubjectWebsiteAudit | null,
  competitorWebsiteChecks: CompetitorWebsiteCheck[],
): string {
  const subjectSection = subjectRecord
    ? `## SUBJECT BUSINESS DATA (from Google Maps)\n\n${formatRecord(subjectRecord)}`
    : `## SUBJECT BUSINESS DATA\n\nNo exact match found for "${businessName}" in "${city}". ` +
      `The business may not have a Google Maps listing, or the listing name may differ significantly. ` +
      `Classify this as a Foundation Problem — missing or unfindable listing is the primary finding.`;

  const competitorSection = competitorRecords.length
    ? `## COMPETITOR SET — ${competitorRecords.length} relevant businesses (pre-filtered for category relevance)\n\n` +
      competitorRecords.map((r, i) => formatRecord(r, i)).join('\n\n')
    : `## COMPETITOR SET\n\nNo relevant competitor data could be retrieved for this query.`;

  const benchmarkSection = `## PRE-VALIDATED BENCHMARK DATA
The following figures have been computed and validated by the system before this prompt was generated.
You MUST use these figures in the report. Do NOT recalculate or contradict them.

Sample:
- Total competitor candidates fetched: ${benchmarks.totalCandidates}
- Relevant competitors included (after relevance filtering): ${benchmarks.includedCount}
- Competitors excluded as unrelated: ${benchmarks.excludedCount}

Website validation (${benchmarks.websiteValidationSummary}):
- Competitors WITH validated websites: ${benchmarks.competitorsWithWebsites}
- Competitors WITHOUT websites: ${benchmarks.competitorsWithoutWebsites}

Robust benchmark metrics (computed from ${benchmarks.includedCount} relevant competitors):
- Median rating: ${benchmarks.medianRating ?? 'insufficient data'} | P75: ${benchmarks.p75Rating ?? 'insufficient data'} | nearest-5 median: ${benchmarks.nearest5MedianRating ?? 'insufficient data'}
- Median reviews: ${benchmarks.medianReviews ?? 'insufficient data'} | P75: ${benchmarks.p75Reviews ?? 'insufficient data'} | nearest-5 median: ${benchmarks.nearest5MedianReviews ?? 'insufficient data'}
- Median photos: ${benchmarks.medianPhotos ?? 'insufficient data'} | P75: ${benchmarks.p75Photos ?? 'insufficient data'} | nearest-5 median: ${benchmarks.nearest5MedianPhotos ?? 'insufficient data'}

Legacy/context metrics (do not use maximums as targets):
Aggregate metrics (computed from ${benchmarks.includedCount} relevant competitors):
- Average rating: ${benchmarks.avgRating ?? 'insufficient data'}
- Average review count: ${benchmarks.avgReviews ?? 'insufficient data'}
- Average photo count: ${benchmarks.avgPhotos ?? 'insufficient data'}
- Market leader rating: ${benchmarks.maxRating ?? 'N/A'}
- Market leader review count: ${benchmarks.maxReviews ?? 'N/A'}
- Market leader photo count: ${benchmarks.maxPhotos ?? 'N/A'}
- % competitors with hours listed: ${benchmarks.percentWithHours !== null ? benchmarks.percentWithHours + '%' : 'N/A'}
- % competitors with description: ${benchmarks.percentWithDescription !== null ? benchmarks.percentWithDescription + '%' : 'N/A'}

Subject rankings within relevant competitor set:
- Rating rank: ${benchmarks.subjectRatingRankLabel}
- Review count rank: ${benchmarks.subjectReviewRankLabel}
- Photo count rank: ${benchmarks.subjectPhotoRankLabel}

Benchmark confidence: ${benchmarks.benchmarkConfidence}%
${benchmarks.confidenceReasons.length ? 'Confidence notes:\n' + benchmarks.confidenceReasons.map(r => `- ${r}`).join('\n') : ''}

## VALIDATED CONSTRAINTS — MANDATORY
${benchmarks.constraints.length
    ? benchmarks.constraints.map(c => `• ${c}`).join('\n')
    : '• No specific contradictions detected.'}

You are REQUIRED to honour all CONSTRAINT and VALIDATED lines above when writing findings and rankings.
Violating a CONSTRAINT line means the report contains a factual error.`;

  const subjectWebsiteNote = subjectRecord?.site
    ? `CONFIRMED — SUBJECT WEBSITE: The subject business has a detected website: ${subjectRecord.site}. ` +
      `Do NOT state this business has no website.`
    : `CAUTION — SUBJECT WEBSITE: No website URL was returned by Outscraper for this business. ` +
      `This is a common data gap — do NOT state the business has no website. ` +
      `If website absence is relevant, use "no website was detected in the data" language.`;

  const websiteAuditSection = subjectWebsiteAudit
    ? formatSubjectWebsiteAudit(subjectWebsiteAudit)
    : `## SUBJECT WEBSITE AUDIT\n\nNo website could be found or audited for this business. ` +
      `Do not state the business has no website — the site may exist but was not discoverable. ` +
      `Flag website presence as unknown/unverified in the report.`;

  const competitorWebsiteSection = formatCompetitorWebsites(competitorWebsiteChecks);

  return `Generate a complete Business Growth Assessment for this business.

**Business name:** ${businessName}
**Location:** ${city}
**Industry:** ${industry || 'derive from the data'}

⚠ ${subjectWebsiteNote}

${subjectSection}

---

${competitorSection}

---

${websiteAuditSection}

---

${competitorWebsiteSection}

---

${benchmarkSection}

---

Instructions:
1. Use the PRE-VALIDATED BENCHMARK DATA above — do not recalculate averages or rankings from scratch.
2. Use the WEBSITE AUDIT sections above when writing any website-related findings. These are real fetched data.
3. Apply the full 13-section output format from your instructions.
4. Use ONLY numbers that appear in the data or benchmarks above — no invented statistics or percentages.
5. Honour all CONSTRAINT lines — they block specific false claims.
6. Apply dynamic service matching for the Done For You section.
7. Select the archetype CTA template that matches this business's situation.
8. Generate the complete report now.`;
}
