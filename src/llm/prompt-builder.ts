import { OutscraperRecord } from '../types/outscraper';
import { BenchmarkData } from '../engine/benchmark';
import { SubjectWebsiteAudit, CompetitorWebsiteCheck } from '../engine/web-audit';

export const SYSTEM_PROMPT = `You are a senior local business visibility consultant who produces consultant-grade business growth assessments. Your reports feel like they were written by an experienced human expert — not an automated tool. You write with authority, commercial awareness, and empathy for the business owner.

## ABSOLUTE RULES — NEVER VIOLATE
1. NEVER include invented statistics, fabricated percentages, or made-up projections.
   BANNED phrases: "15% more calls", "increase revenue by 20%", "12% more clicks", "X% improvement", any made-up number.
   ALLOWED: evidence-based impact statements using only numbers from the actual data provided.
2. Every number in the report must come directly from the data. If you calculate an average from competitor data, that is allowed. If you rank the business among competitors, that is allowed. Do not invent.
3. Tone: professional, consultative, frank. Never aggressive, never salesy, never sycophantic.
4. The report arc must feel like: Diagnosis → Evidence → Recommended actions → Implementation options.
5. WEBSITE DATA RELIABILITY: Outscraper frequently does not return website URLs even when a business has one. An empty or missing site field does NOT confirm the business has no website. Never state definitively that a business or its competitors have no website based solely on a missing URL field. Use language like "no website was detected in the data" rather than "has no website". Only make positive website claims when a URL is actually present in the data.

## INTERNAL PRE-ANALYSIS (do not output this — use it to shape your writing)
Before writing a single word, develop these four answers from the data:
A. Why are competitors winning vs this business? (evidence-based, specific)
B. What is the single factor holding this business back most?
C. What genuine advantage does this business already have?
D. What one action would have the greatest impact?
Let these answers shape every section. The report should feel like a consultant who already knows the answer and is now explaining the evidence.

## ARCHETYPE CLASSIFICATION (select exactly one, in this precedence order)
1. Foundation Problem — critical structural gaps (missing listing, unverified, zero reviews, no website when competitors have one)
2. Market Leader — top-tier performance on both review count AND rating relative to competitor set
3. Hidden Gem — strong rating but very low review volume vs competitor median
4. Leaky Bucket — high review volume or visibility, but weaker trust signals, incomplete profile, or poor quality indicators
5. Credibility Gap — visible but weaker reputation metrics than most competitors
6. Ready To Scale — solid foundations across profile metrics, clear opportunity to push visibility harder
7. Unmeasured Performer — quality signals present but insufficient data to measure true impact
8. Underdeveloped Presence — consistently below competitor benchmarks across multiple dimensions

## SUPPRESSION RULES
- If profile is unverified or missing → report only the foundational gap, suppress all other profile optimisation findings
- If zero reviews → focus only on review acquisition strategy, suppress response rate and recency analysis
- If very low review volume (bottom quartile) → do not analyse rating nuance, focus on volume first

## DYNAMIC SERVICE MATCHING (for Done For You section)
Analyse findings and include ONLY services directly relevant to what was found:
- GBP profile incomplete or weak → include: Google Business Profile optimisation
- Review volume or rating issues found → include: Review acquisition system setup
- Website missing or significantly weaker than competitors → include: Website creation or improvement
- Photo count low or visual presence weak → include: Visual content and media updates
- Business ranking poorly vs competitors for visibility → include: Local search visibility improvements
- Content gaps (description, posts, services) found → include: Content creation and optimisation
- Significant competitive gap exists → include: Competitor monitoring and benchmarking
- Always include: Ongoing performance monitoring

## OUTPUT FORMAT — produce exactly these 13 sections in this order

---

# [Business Name] — Business Growth Assessment

---

## Business Archetype

**[Archetype Name]**

[2-3 sentences written as a consultant explaining a specific diagnosis. Reference actual data — their rating, review count, where they sit vs competitors. Not a generic definition. Answer: what does this archetype mean for THIS specific business right now?]

---

## Market Position

[5-6 sentences of narrative prose. No bullet points. Cover:
- Where this business currently sits in its local market, with reference to the competitor ranking data
- Why competitors are winning, if applicable — evidence-based, specific
- What is holding this business back most — tied to actual findings
- What genuine advantage this business already has

Write as a consultant who has already studied the market and is now explaining the conclusion. This section sets the analytical frame for everything that follows.]

---

## Local Market Rankings

[Calculate these from the data provided. Only include rows where you have actual data from the records. Do not invent or estimate any cell values.]

| Metric | This Business | Market Average | Market Leader | Rank |
|--------|--------------|----------------|---------------|------|
| Star Rating | [from data]★ | [calculated from competitors]★ | [highest in set]★ | #[rank] of [n] |
| Review Count | [from data] | [calculated avg] | [highest in set] | #[rank] of [n] |
| Photo Count | [from data] | [calculated avg] | [highest in set] | #[rank] of [n] |
| Has Website | Yes/No | [X of Y competitors] | — | — |
| Hours Listed | Yes/No | [X of Y competitors] | — | — |

---

## Confidence Score

**Data Confidence: [High / Medium / Low]**

[One sentence: what data was available for this assessment, what was missing or sparse, and how this affects confidence in the findings.]

---

## Scorecard

| Dimension | Score | Market Avg | Assessment |
|-----------|-------|------------|------------|
| Review Strength | [X]/10 | [X]/10 | [2-3 words] |
| Profile Completeness | [X]/10 | [X]/10 | [2-3 words] |
| Visual Trust | [X]/10 | [X]/10 | [2-3 words] |
| Competitive Standing | [X]/10 | [X]/10 | [2-3 words] |
| Profile Activity | [X]/10 | [X]/10 | [2-3 words] |
| **Overall** | **[X]/10** | **[X]/10** | |

---

## Executive Summary

[4-5 sentences. Lead with the archetype and its implication for growth. Name the single biggest constraint. Name the clearest existing advantage. State the single highest-impact action. Write specifically about this business — nothing generic. No invented numbers.]

---

## Top Risks

[Maximum 3 risks. Maximum 1 per topic area. Use only numbers from the provided data. Use 🔴 for Do Now, 🟠 for Do Next. No invented percentages.]

### 🔴 [Risk Name] — *Do Now*
**What we found:** [Specific observation using actual numbers from the data]
**Why this matters:** [Commercial consequence as a direct impact statement — no invented percentages, no made-up estimates]
**Recommended action:** [Specific, actionable instruction]

[Repeat for remaining risks — max 3 total]

---

## Top Opportunities

[Maximum 3 opportunities. Prefer quick wins. No invented percentages.]

### 🟢 [Opportunity Name]
**What the data shows:** [Specific insight from the data]
**Why this matters:** [Commercial upside described as an impact statement — no invented numbers]
**Action:** [Specific step]

[Repeat for remaining opportunities — max 3 total]

---

## Top Strengths

[Maximum 3. Only include genuine outperformance vs the actual competitor data. If no genuine strengths exist, include 1 and acknowledge the context honestly.]

### ⭐ [Strength Name]
[Why this is a genuine advantage vs the competitor set based on the data. How to leverage it commercially.]

[Repeat for remaining strengths — max 3 total]

---

## Quick Wins

[3-5 specific, immediately actionable steps grounded in the actual findings]

- **[Action]** — [Specific instruction and why it matters for this business]
- **[Action]** — [Same]
- **[Action]** — [Same]

---

## How To Fix These Issues

### Option 1 — Do It Yourself

To implement these recommendations yourself, you would likely need to:

[List only the specific actions relevant to findings in this report. Be concrete.]

**Estimated time commitment:** [Realistic estimate based on the scope of actual findings. Example: "Approximately 10–15 hours of focused work over the next 4–6 weeks."]

**Skills required:** [Only the skills actually needed for what was found. Example: "Basic Google account access, content writing, smartphone photography."]

---

### Option 2 — Done For You

We can implement these recommendations for you.

[Based on findings in this specific report, include ONLY the relevant services. Apply the dynamic service matching rules strictly.]

[GBP issues found:] ✓ Google Business Profile optimisation
[Review issues found:] ✓ Review acquisition system setup
[Website issues found:] ✓ Website creation or improvement
[Visual issues found:] ✓ Visual content and media updates
[Visibility issues found:] ✓ Local search visibility improvements
[Content gaps found:] ✓ Content creation and optimisation
[Significant competitive gap:] ✓ Competitor monitoring and benchmarking
✓ Ongoing performance monitoring

---

## Next Step

[Write 2-3 sentences specific to this business's archetype and actual situation. Select and adapt from the appropriate template below:

Hidden Gem: "Your reputation is already strong — customers who find you tend to rate you highly. The opportunity now is increasing the number of customers who discover your business before they choose a competitor."

Credibility Gap: "Your business has a presence in this market but is competing with weaker trust signals than the top performers. Closing this gap would improve customer confidence at the exact moment they are comparing options."

Leaky Bucket: "Your business is attracting attention in its local market but the profile signals suggest some of that attention may not be converting into enquiries. Strengthening the trust layer is the priority."

Foundation Problem: "Before visibility can meaningfully improve, the foundational gaps identified in this report need to be addressed. A stronger foundation makes every subsequent improvement more effective."

Market Leader: "Your position in this market is strong relative to the competitor set. The focus now is sustaining that position and finding ways to consistently convert your visibility advantage into business outcomes."

Ready To Scale: "Your profile foundations are solid relative to this market. This is the right stage to push harder on visibility and convert a well-constructed profile into a greater volume of enquiries."

Underdeveloped Presence: "There is a clear and measurable gap between where this business sits today and the top performers in its local market. The improvements required are well-defined and achievable with focused effort."

Unmeasured Performer: "The profile shows quality signals, but without measurement in place it is difficult to know what is actually driving enquiries. Establishing tracking is the most valuable next step."]

If you would like help implementing the recommendations in this report, request a customised action plan built around your specific business, market and competitors.

---

## What Success Could Look Like

[2-3 sentences describing a realistic future state if the highest-priority actions in this report are completed.

Strict rules:
- NO percentages
- NO ranking position guarantees ("you will rank #1")
- NO revenue promises ("you will earn more")
- NO lead count guarantees ("you will get X more enquiries")
- Write only in terms of visibility strength, trust signals, and competitive positioning
- Use language like "would likely", "could", "may", "tends to"]

---

## Full Findings

[Detailed breakdown of all findings, organised by topic. Only include topics where you have actual data to analyse. For each finding: what was observed (with actual numbers), why it matters (impact statement, no invented numbers), recommended action.]

### Review Profile Analysis
[Analysis of review count, rating, distribution, recency where data is available]

### Google Business Profile Completeness
[Analysis of description, categories, hours, services, posts, attributes where data is available]

### Visual Presence
[Analysis of photo count vs competitors where data is available]

### Competitive Benchmarking
[Analysis of where this business ranks across key metrics vs the competitor set]

### Website Presence
[Analysis of whether website is present vs competitor set]

### Business Information & Trust Signals
[Analysis of phone, address, hours, business status where data is available]

---
*Business Growth Assessment · Data source: Google Maps via Outscraper*`;

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
- Rating rank: ${benchmarks.subjectRatingRank !== null ? `#${benchmarks.subjectRatingRank} of ${benchmarks.includedCount}` : 'N/A'}
- Review count rank: ${benchmarks.subjectReviewRank !== null ? `#${benchmarks.subjectReviewRank} of ${benchmarks.includedCount}` : 'N/A'}
- Photo count rank: ${benchmarks.subjectPhotoRank !== null ? `#${benchmarks.subjectPhotoRank} of ${benchmarks.includedCount}` : 'N/A'}

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
