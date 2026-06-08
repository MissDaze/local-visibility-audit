import { Rule } from '../types';

const H = -12;
const M = -6;
const L = -3;

export const technicalRules: Rule[] = [
  {
    id: 'X1',
    name: 'Mobile Usability Risk',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'hard',
    industryWeightKey: 'mobile_speed_weight',
    condition: ({ business }) => !business.website.mobileFriendly,
    insight:
      'The site is not mobile-friendly, which directly reduces leads from local search traffic.',
    recommendation:
      'Fix responsiveness, tap target sizes, font sizes, and mobile layout breakpoints.',
    businessImpactTemplate:
      'The majority of local searches happen on mobile. A non-mobile-friendly site loses most of its potential traffic before any content is consumed.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'X2',
    name: 'Core Web Vitals Risk',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'hard',
    condition: ({ business }) =>
      business.website.lcp > 2.5 ||
      business.website.inp > 200 ||
      business.website.cls > 0.1,
    insight:
      'One or more Core Web Vitals scores fall below Google\'s recommended thresholds.',
    recommendation:
      'Optimise LCP (largest image/text load), reduce INP (interaction delay), and fix CLS (layout shifts).',
    businessImpactTemplate:
      'Poor Core Web Vitals create a measurably worse user experience that increases bounce rates and reduces Google\'s confidence in the site quality.',
    evidenceExtractor: ({ business }) => ({
      lcp: `${business.website.lcp}s (threshold: 2.5s)`,
      inp: `${business.website.inp}ms (threshold: 200ms)`,
      cls: `${business.website.cls} (threshold: 0.1)`,
    }),
  },
  {
    id: 'X3',
    name: 'Indexation Risk',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'moderate',
    condition: ({ business }) => business.website.indexedPagesRatio < 0.8,
    insight:
      'More than 20% of pages may not be eligible to rank due to indexation issues.',
    recommendation:
      'Audit noindex tags, robots.txt directives, canonicals, and sitemap coverage.',
    businessImpactTemplate:
      'If important service or location pages are not indexed, they cannot appear in search results regardless of other optimisation work.',
    evidenceExtractor: ({ business }) => ({
      indexedPagesRatio: `${Math.round(business.website.indexedPagesRatio * 100)}%`,
    }),
  },
  {
    id: 'X4',
    name: 'Broken Internal Links',
    category: 'technical',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => business.website.brokenInternalLinksCount > 0,
    insight:
      'Broken internal links hurt user experience and signal poor site maintenance.',
    recommendation:
      'Repair or redirect all broken internal URLs.',
    businessImpactTemplate:
      'Broken links create dead ends for both visitors and search engines. They reduce crawl efficiency and damage trust with prospects who encounter them.',
    evidenceExtractor: ({ business }) => ({
      brokenLinksCount: business.website.brokenInternalLinksCount,
    }),
  },
  {
    id: 'X5',
    name: 'Redirect Chain Waste',
    category: 'technical',
    severity: 'low',
    baseScoreImpact: L,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => business.website.redirectChainsCount > 0,
    insight:
      'Redirect chains create unnecessary page load delays and crawl inefficiency.',
    recommendation:
      'Flatten redirect paths to single-hop redirects.',
    businessImpactTemplate:
      'Each redirect hop adds latency. Chains increase page load time and reduce the share of PageRank passed to destination pages.',
    evidenceExtractor: ({ business }) => ({
      redirectChainsCount: business.website.redirectChainsCount,
    }),
  },
  {
    id: 'X6',
    name: 'Missing Analytics Foundation',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) =>
      !business.measurement.ga4Installed || !business.measurement.gscVerified,
    insight:
      'The business cannot measure search or website performance without GA4 and Search Console.',
    recommendation:
      'Install GA4 and verify Search Console as the first measurement action.',
    businessImpactTemplate:
      'Without measurement, the business cannot prove that any visibility work is generating leads or revenue. Decisions are made blind.',
    evidenceExtractor: ({ business }) => ({
      ga4Installed: business.measurement.ga4Installed,
      gscVerified: business.measurement.gscVerified,
    }),
  },
  {
    id: 'X7',
    name: 'Missing Conversion Tracking',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'moderate',
    condition: ({ business }) => !business.measurement.leadEventsTracked,
    insight:
      'The business cannot prove whether visibility improvements are producing leads.',
    recommendation:
      'Track calls, form submissions, bookings, and key CTA clicks as conversion events.',
    businessImpactTemplate:
      'Without conversion tracking, it is impossible to calculate return on any marketing investment or to identify which channels are actually producing business.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'X8',
    name: 'Crawlability Risk',
    category: 'technical',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'moderate',
    condition: ({ business }) =>
      business.website.robotsBlocksKeyPages || business.website.sitemapMissing,
    insight:
      'Search engines may struggle to crawl or index key pages due to robots rules or a missing sitemap.',
    recommendation:
      'Fix any robots.txt rules blocking important pages and submit a clean XML sitemap.',
    businessImpactTemplate:
      'If the crawl is blocked, rankings cannot improve regardless of content or link quality. This is a foundational technical issue that overrides all other optimisation.',
    evidenceExtractor: ({ business }) => ({
      robotsBlocksKeyPages: business.website.robotsBlocksKeyPages,
      sitemapMissing: business.website.sitemapMissing,
    }),
  },
  {
    id: 'X9',
    name: 'Missing Meta Coverage',
    category: 'technical',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    condition: ({ business }) =>
      business.website.pagesWithMissingTitleOrMetaRatio > 0.3,
    insight:
      'More than 30% of pages are missing title tags or meta descriptions.',
    recommendation:
      'Write unique, compelling titles and meta descriptions for all priority pages.',
    businessImpactTemplate:
      'Missing or auto-generated meta descriptions reduce click-through rates from search results. Every missing title is a missed opportunity to win a click over a competitor.',
    evidenceExtractor: ({ business }) => ({
      missingMetaRatio: `${Math.round(
        business.website.pagesWithMissingTitleOrMetaRatio * 100,
      )}%`,
    }),
  },
  {
    id: 'X10',
    name: 'Accessibility Trust Gap',
    category: 'technical',
    severity: 'low',
    baseScoreImpact: -3,
    dependencyStage: 6,
    ease: 'moderate',
    condition: ({ business }) => business.website.accessibilityScore < 80,
    insight:
      'Accessibility issues may create usability friction and a trust problem for some visitor segments.',
    recommendation:
      'Improve labels, colour contrast, heading structure, and keyboard accessibility.',
    businessImpactTemplate:
      'Poor accessibility reduces usability for a meaningful share of users and may expose the business to compliance risk in some jurisdictions.',
    evidenceExtractor: ({ business }) => ({
      accessibilityScore: business.website.accessibilityScore,
    }),
  },
];
