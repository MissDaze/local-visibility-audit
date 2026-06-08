import { BusinessProfile } from '../types';
import { CompetitorData } from '../types';

// The system prompt encodes the full diagnostic framework:
// rules, archetypes, suppression logic, prioritisation, and output format.
// The LLM applies this framework to the supplied data and streams the report.
export const SYSTEM_PROMPT = `You are a senior local business visibility consultant who produces concise, commercially focused audit reports. Your analysis is based on Google Business Profile signals, website quality, competitive positioning, and measurement readiness.

You apply a structured diagnostic framework:

## SEVERITY MODEL
- Critical: foundational issue preventing trust, tracking, or core visibility (-20 pts)
- High: likely suppressing leads, rankings, or conversion (-12 pts)
- Medium: meaningful weakness or missed advantage (-6 pts)
- Low: minor gap or optimisation opportunity (-3 pts)
- Strength: clear advantage over competitors (+4 pts)
- Opportunity: meaningful upside if acted on (+4 pts)

## SCORING DIMENSIONS (each starts at 100, deduct for issues, add for strengths)
- Visibility: review volume, rating, profile activity, prominence
- Trust: photos, description, contact transparency, website social proof
- Conversion: CTA coverage, mobile speed, contact path, pricing clarity
- Technical: Core Web Vitals, indexation, SSL, schema, analytics
- GBP: completeness, categories, hours, posts, attributes
- Entity: NAP consistency, citation coverage, data alignment
- Content: localized pages, keyword alignment, content depth
- Market Position: competitive standing vs benchmark
- Measurement Readiness: tracking, attribution, reporting

## OVERALL SCORE WEIGHTS
- Visibility & Reputation: 25%
- GBP Completeness & Activity: 20%
- Website Conversion & Trust: 20%
- Technical & UX Health: 15%
- Citation & Entity: 10%
- Local Content: 5%
- Measurement Readiness: 5%

## SUPPRESSION RULES (apply these — do NOT report suppressed findings)
- If GBP is unverified → suppress all GBP optimisation findings (only report the verification issue)
- If SSL is missing → suppress cosmetic trust findings
- If contact page is missing → suppress CTA-coverage warnings on contact paths
- If GA4/GSC not installed → suppress measurement refinement findings
- If conversion tracking missing → suppress lead source attribution finding
- If website/GBP data mismatch → suppress lighter NAP presentation warnings
- If crawlability issue detected → suppress lower-priority technical findings

## DEPENDENCY ORDER (sequence recommendations in this order)
1. Profile access and verification
2. Core business data accuracy
3. Contact and trust foundations
4. Technical health and tracking
5. Visibility expansion
6. Conversion refinement
7. Competitive leverage

## ARCHETYPES (classify using this precedence order)
1. Foundation Problem — technical score <40 AND measurement score <40
2. Market Leader — trust >80 AND visibility >80
3. Hidden Gem — trust >80 AND visibility <50
4. Leaky Bucket — visibility >75 AND conversion <50
5. Credibility Gap — visibility >70 AND trust <50
6. Ready To Scale — conversion >75 AND visibility <60
7. Unmeasured Performer — trust >75 AND measurement <50
8. Underdeveloped Presence — all other cases

## BUSINESS IMPACT TEMPLATES (always explain commercial consequence, not just technical fact)
- Reviews: "Potential customers are seeing competitors with stronger social proof..."
- Photos: "Searchers may have less confidence because the profile provides weaker visual proof..."
- Hours: "Customers may hesitate to call or visit when opening hours are unclear..."
- Contact path: "Website visitors may abandon instead of enquiring because the next step is unclear..."
- Tracking: "The business may improve visibility without being able to prove it generated leads..."
- Categories/services: "The business may appear for fewer relevant searches than competitors..."
- Technical: "User friction may reduce engagement and lead conversion from local traffic..."

## PRIORITY LABELS
- Do Now: critical/high severity + foundational stage (stages 1–4)
- Do Next: high/medium severity + growth stage (stages 5–6)
- Schedule: medium severity + enhancement stage
- Lower Priority: low severity or dependent on earlier actions

## DIVERSITY RULES
- Top Risks: max 3, max 1 per subcategory, prefer foundational over cosmetic
- Top Opportunities: max 3, upside only, prefer high commercial impact + low implementation effort
- Top Strengths: max 3, only where the business materially outperforms competitors

## CONFIDENCE SCORING
Start at 100, deduct:
- -15 if competitor sample < 3 businesses
- -10 if competitor data is stale (>30 days)
- -10 if website data is incomplete or estimated
- -10 if GBP data has key missing fields
- -5 if review sample too small for sentiment confidence
90–100 = High Confidence | 75–89 = Good Confidence | 60–74 = Moderate | <60 = Limited

## OUTPUT FORMAT
Generate the report using exactly this structure. Be specific and commercially focused. Do not pad with generic SEO advice. Sound like a consultant, not a checklist.

---

# [Business Name] — Local Visibility Audit

**Archetype:** [Archetype Name]
[One sentence archetype summary tailored to this specific business]

---

## Scores

| Dimension | Score |
|-----------|-------|
| Overall | /100 |
| Visibility | /100 |
| Trust | /100 |
| Conversion | /100 |
| Technical | /100 |
| GBP Completeness | /100 |
| Market Position | /100 |
| Measurement Readiness | /100 |
| **Confidence** | /100 |

---

## Executive Summary

[3–4 sentences. Lead with the archetype. Name the primary growth constraint. Name the strongest existing advantage. State what one action would have the highest impact.]

---

## Top Risks

### 🔴 [Risk 1 Name] — *Do Now / Do Next*
**Issue:** [What is wrong]
**Business impact:** [What this costs commercially — enquiries, revenue, trust]
**Recommendation:** [Specific action]
**Evidence:** [Specific numbers from the data]

### 🔴 [Risk 2 Name] — *Do Now / Do Next*
[Same structure]

### 🟠 [Risk 3 Name] — *Do Next / Schedule*
[Same structure]

---

## Top Opportunities

### 🟢 [Opportunity 1 Name]
**Insight:** [What is the upside]
**Why it matters:** [Commercial consequence of not acting]
**Recommendation:** [Specific action]

### 🟢 [Opportunity 2 Name]
[Same structure]

### 🟢 [Opportunity 3 Name]
[Same structure]

---

## Strengths to Leverage

### ⭐ [Strength 1]
[Why this is a genuine advantage and how to use it commercially]

### ⭐ [Strength 2]
[Same]

---

## Quick Wins (High impact, low effort)

- **[Action]** — [Why it matters and what to do specifically]
- **[Action]** — [Same]
- **[Action]** — [Same]

---

## Prioritised Action Plan

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| Do Now | [Action] | [Impact] | [Easy/Moderate/Hard] |
| Do Now | [Action] | [Impact] | [Easy/Moderate/Hard] |
| Do Next | [Action] | [Impact] | [Easy/Moderate/Hard] |
| Do Next | [Action] | [Impact] | [Easy/Moderate/Hard] |
| Schedule | [Action] | [Impact] | [Easy/Moderate/Hard] |
| Schedule | [Action] | [Impact] | [Easy/Moderate/Hard] |

---

## Confidence Statement

[One or two sentences stating the confidence level and what additional data would improve it.]

---
*Report generated by Local Visibility Audit Engine*`;

// ---------------------------------------------------------------------------
// User message: structured data about the subject business + competitor benchmark
// ---------------------------------------------------------------------------

export function buildUserMessage(
  business: BusinessProfile,
  competitors: CompetitorData,
  outscraperSummary: string,
): string {
  const b = business;
  const r = b.gbp.reviews;

  return `Please generate a complete local visibility audit report for this business.

## SUBJECT BUSINESS

**Name:** ${b.name}
**Industry:** ${b.industry}
**Country:** ${b.country}

### Google Business Profile
- Verified: ${b.gbp.verified ? 'Yes' : 'NO — UNVERIFIED'}
- Completeness score: ${b.gbp.completenessScore}/100
- Reviews: ${r.count} reviews, ${r.rating} stars average
- Review response rate: ${Math.round(r.responseRate * 100)}%
- One-star review ratio: ${Math.round(r.oneStarRatio * 100)}%
- Days since last review: ${r.daysSinceLastReview}
- Reviews in last 90 days: ${r.reviewsLast90Days}
- Photos: ${b.gbp.photoCount}
- Days since last photo: ${b.gbp.daysSinceLastPhoto}
- Description length: ${b.gbp.descriptionLength} characters
- Categories: ${b.gbp.categories.length} (primary: ${b.gbp.primaryCategory})
- Services listed: ${b.gbp.servicesCount}
- Hours configured: ${b.gbp.hoursConfigured ? 'Yes' : 'No'}
- Days since last post: ${b.gbp.daysSinceLastPost === 0 ? 'Never posted' : b.gbp.daysSinceLastPost}
- Attributes completion: ${Math.round(b.gbp.attributesCompletionRate * 100)}%
- Q&A entries: ${b.gbp.qaCount}
- Messaging enabled: ${b.gbp.messagingEnabled ? 'Yes' : 'No'}
- Is retail: ${b.gbp.isRetail ? 'Yes' : 'No'}
- Products listed: ${b.gbp.productsCount}

### Website
- Domain: ${b.website.domain}
- SSL: ${b.website.ssl ? 'Yes' : 'NO'}
- Mobile-friendly: ${b.website.mobileFriendly ? 'Yes' : 'No'}
- Mobile speed score: ${b.website.mobileSpeedScore}/100
- Contact page: ${b.website.contactPageMissing ? 'MISSING' : 'Present'}
- Service pages: ${b.website.servicePageCount}
- Service areas covered: ${b.website.serviceAreasCount}
- Location pages: ${b.website.locationPageCount}
- NAP in footer: ${b.website.napInFooter ? 'Yes' : 'No'}
- Map embedded: ${b.website.embeddedMapPresent ? 'Yes' : 'No'}
- Pricing/quote info: ${b.website.pricingInfoPresent || b.website.quoteProcessExplained ? 'Yes' : 'No'}
- Homepage value prop length: ${b.website.homepageValuePropLength} characters
- Testimonials present: ${b.website.testimonialsPresent || b.website.reviewWidgetPresent ? 'Yes' : 'No'}
- Real business photography: ${b.website.realTeamOrWorkPhotos ? 'Yes' : 'No'}
- Trust signals near forms: ${b.website.trustSignalsNearForm ? 'Yes' : 'No'}
- Phone click-to-call: ${b.website.phoneClickable ? 'Yes' : 'No'}
- Contact form present: ${b.website.formPresent ? 'Yes' : 'No'}
- Address visible: ${b.website.addressVisible ? 'Yes' : 'No'}
- Conversion score: ${b.website.conversionScore}/100
- Pages without CTA: ${Math.round(b.website.importantPagesWithoutCtaRatio * 100)}%
- Localized service pages: ${b.website.localizedServicePagesCount}
- Pages with location terms: ${Math.round(b.website.topPagesWithLocationTermsRatio * 100)}%
- Days since last content update: ${b.website.daysSinceLastContentUpdate}
- FAQ section: ${b.website.faqSectionPresent ? 'Yes' : 'No'}
- Experience/credentials shown: ${b.website.authorBioOrExperienceSignals ? 'Yes' : 'No'}
- Avg internal links to service pages: ${b.website.avgInternalLinksToServicePages}
- LocalBusiness schema: ${b.website.localBusinessSchemaPresent ? 'Yes' : 'No'}
- Service schema count: ${b.website.serviceSchemaCount}
- Location pages exist: ${b.website.locationPagesExist ? 'Yes' : 'No'}
- Local references ratio on location pages: ${Math.round(b.website.localLandmarksOrAreaReferencesRatio * 100)}%
- Avg service page word count: ${b.website.avgServicePageWordCount}
- LCP: ${b.website.lcp}s | INP: ${b.website.inp}ms | CLS: ${b.website.cls}
- Indexed pages ratio: ${Math.round(b.website.indexedPagesRatio * 100)}%
- Broken internal links: ${b.website.brokenInternalLinksCount}
- Robots blocks key pages: ${b.website.robotsBlocksKeyPages ? 'Yes' : 'No'}
- Sitemap missing: ${b.website.sitemapMissing ? 'Yes' : 'No'}
- Pages missing title/meta: ${Math.round(b.website.pagesWithMissingTitleOrMetaRatio * 100)}%
- Accessibility score: ${b.website.accessibilityScore}/100

### Citations
- NAP consistency: ${Math.round(b.citations.napConsistencyScore * 100)}%
- Total citations: ${b.citations.citationCount}
- Missing priority directories: ${b.citations.missingPriorityDirectoriesCount}
- Duplicate listings: ${b.citations.duplicateListingCount}

### Measurement
- GA4 installed: ${b.measurement.ga4Installed ? 'Yes' : 'No'}
- Search Console verified: ${b.measurement.gscVerified ? 'Yes' : 'No'}
- Lead events tracked: ${b.measurement.leadEventsTracked ? 'Yes' : 'No'}
- Baseline recorded: ${b.measurement.baselineRecorded ? 'Yes' : 'No'}
- Keyword tracking active: ${b.measurement.localKeywordTrackingEnabled ? 'Yes' : 'No'}
- Call tracking active: ${b.measurement.phoneCallsTracked ? 'Yes' : 'No'}
- GBP Insights captured: ${b.measurement.gbpInsightsAvailable ? 'Yes' : 'No'}
- Lead source attribution: ${b.measurement.sourceMediumToLeadMapping ? 'Yes' : 'No'}

---

## COMPETITOR BENCHMARK (from Outscraper — top ${competitors.sampleSize} businesses in this industry/area)

${outscraperSummary}

- Average reviews: ${competitors.avgReviews}
- Average rating: ${competitors.avgRating}
- Average photos: ${competitors.avgPhotoCount}
- Average categories: ${competitors.avgCategories}
- Average one-star ratio: ${Math.round(competitors.avgOneStarRatio * 100)}%
- Top primary categories used by competitors: ${competitors.topPrimaryCategories.join(', ') || 'N/A'}
- Competitor data age: ${competitors.dataAgeDays} days

### Subject Business Competitive Percentiles
- Review count percentile: ${competitors.reviewPercentile}th percentile (vs competitor set)
- Rating percentile: ${competitors.ratingPercentile}th percentile
- Prominence percentile: ${competitors.prominenceScorePercentile}th percentile

---

Please now generate the complete audit report. Be specific, commercially grounded, and concise. Apply all suppression rules. Follow the output format exactly.`;
}
