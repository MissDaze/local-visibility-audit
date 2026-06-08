import { Rule } from '../types';

const H = -12;
const M = -6;
const L = -3;
const O = 4;

export const localRules: Rule[] = [
  {
    id: 'L1',
    name: 'No Localized Service Pages',
    category: 'local',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'location_page_weight',
    condition: ({ business }) => business.website.localizedServicePagesCount === 0,
    insight:
      'The site has no pages that combine a specific service with a local area.',
    recommendation:
      'Build localized service pages for each priority market using unique content.',
    businessImpactTemplate:
      '"[Service] in [Suburb]" is the most common high-intent local search pattern. Without these pages, the business cannot rank for the queries that produce the highest-value enquiries.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'L2',
    name: 'Weak Local Keyword Alignment',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    condition: ({ business }) =>
      business.website.topPagesWithLocationTermsRatio < 0.3,
    insight:
      'Fewer than 30% of top pages use the local terms that customers search for.',
    recommendation:
      'Add natural service and location terms to priority pages without keyword stuffing.',
    businessImpactTemplate:
      'Local relevance signals help search engines confirm that this business genuinely serves the area. Weak alignment reduces ranking eligibility for local searches.',
    evidenceExtractor: ({ business }) => ({
      ratio: `${Math.round(business.website.topPagesWithLocationTermsRatio * 100)}%`,
    }),
  },
  {
    id: 'L3',
    name: 'Stale Content',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    condition: ({ business }) => business.website.daysSinceLastContentUpdate > 180,
    insight:
      'Website content has not been updated in over six months, which may signal a neglected site.',
    recommendation:
      'Refresh high-value service and location pages with current information, examples, and pricing guidance.',
    businessImpactTemplate:
      'Stale content may affect crawl priority and ranking freshness signals, while also reducing trust from prospects who notice outdated information.',
    evidenceExtractor: ({ business }) => ({
      daysSinceLastUpdate: business.website.daysSinceLastContentUpdate,
    }),
  },
  {
    id: 'L4',
    name: 'Missing FAQ Content',
    category: 'local',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 6,
    ease: 'easy',
    condition: ({ business }) => !business.website.faqSectionPresent,
    insight:
      'The site lacks FAQ content that addresses buyer objections and long-tail search intent.',
    recommendation:
      'Add FAQs covering pricing, process, timing, and local availability on key service pages.',
    businessImpactTemplate:
      'FAQs capture long-tail search traffic, reduce pre-contact friction, and appear in Google "People also ask" — a free visibility channel competitors may already be using.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'L5',
    name: 'Missing Experience Signals',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 3,
    ease: 'easy',
    industryWeightKey: 'authority_weight',
    condition: ({ business }) => !business.website.authorBioOrExperienceSignals,
    insight:
      'The website does not demonstrate enough expertise, authority, or years of experience.',
    recommendation:
      'Add qualifications, years in business, team bios, and relevant experience details to key pages.',
    businessImpactTemplate:
      'Prospects evaluating high-trust or high-value services need to see credentials. Missing experience signals increase comparison abandonment.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'L6',
    name: 'Internal Linking Deficit',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'easy',
    condition: ({ business }) =>
      business.website.avgInternalLinksToServicePages < 3,
    insight:
      'Service pages receive fewer than 3 average internal links, leaving them under-supported by site structure.',
    recommendation:
      'Improve internal linking from the homepage, service hubs, and related content pages.',
    businessImpactTemplate:
      'Poorly linked service pages are harder for search engines to discover and prioritise, and harder for prospects to navigate to from other parts of the site.',
    evidenceExtractor: ({ business }) => ({
      avgInternalLinks: business.website.avgInternalLinksToServicePages,
    }),
  },
  {
    id: 'L7',
    name: 'Missing LocalBusiness Schema',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 4,
    ease: 'moderate',
    condition: ({ business }) => !business.website.localBusinessSchemaPresent,
    insight:
      'Search engines lack structured data context about the business identity, location, and services.',
    recommendation:
      'Add LocalBusiness schema markup to the homepage and contact page.',
    businessImpactTemplate:
      'Schema markup helps search engines display rich results and strengthens entity understanding, which can improve local search eligibility.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'L8',
    name: 'Missing Service Schema Coverage',
    category: 'local',
    severity: 'low',
    baseScoreImpact: L,
    dependencyStage: 6,
    ease: 'moderate',
    condition: ({ business }) =>
      business.website.serviceSchemaCount <
      business.website.servicePageCount * 0.5,
    insight:
      'Fewer than half of service pages have structured markup declaring the service intent.',
    recommendation:
      'Add Service schema to each service page.',
    businessImpactTemplate:
      'Service schema gives search engines greater confidence in what the page is about, which can strengthen ranking eligibility for service-intent queries.',
    evidenceExtractor: ({ business }) => ({
      serviceSchemaCount: business.website.serviceSchemaCount,
      servicePageCount: business.website.servicePageCount,
    }),
  },
  {
    id: 'L9',
    name: 'Generic Location Pages',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'location_page_weight',
    condition: ({ business }) =>
      business.website.locationPagesExist &&
      business.website.localLandmarksOrAreaReferencesRatio < 0.2,
    insight:
      'Location pages exist but are too generic to compete effectively for local area searches.',
    recommendation:
      'Add unique local references, area-specific service examples, and locally relevant proof to each location page.',
    businessImpactTemplate:
      'Generic location pages are easily detected as thin content by search engines and prospects alike, reducing ranking potential and conversion rates.',
    evidenceExtractor: ({ business }) => ({
      locationPagesExist: business.website.locationPagesExist,
      localReferencesRatio: `${Math.round(
        business.website.localLandmarksOrAreaReferencesRatio * 100,
      )}%`,
    }),
  },
  {
    id: 'L10',
    name: 'Content Depth Deficit',
    category: 'local',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'content_depth_weight',
    condition: ({ business, competitors }) =>
      business.website.avgServicePageWordCount <
      competitors.avgServicePageWordCount * 0.6,
    insight:
      'Service pages are too thin to compete effectively against competitors with richer content.',
    recommendation:
      'Expand pages with process details, trust proof, FAQs, case studies, and outcome descriptions.',
    businessImpactTemplate:
      'Thin service pages rank lower and convert worse than comprehensive ones. Competitors with richer pages earn both the ranking position and the prospect trust.',
    evidenceExtractor: ({ business, competitors }) => ({
      avgWordCount: business.website.avgServicePageWordCount,
      competitorAvgWordCount: competitors.avgServicePageWordCount,
    }),
  },
];
