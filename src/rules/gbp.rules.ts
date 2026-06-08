import { Rule } from '../types';

const C = -20;
const H = -12;
const M = -6;
const O = 4;

export const gbpRules: Rule[] = [
  {
    id: 'G1',
    name: 'Category Deficit',
    category: 'gbp',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business, competitors }) =>
      business.gbp.categories.length < competitors.avgCategories,
    insight:
      'The business uses fewer categories than local competitors, potentially missing relevant search appearances.',
    recommendation:
      'Review and expand business categories to match or exceed the competitive average.',
    businessImpactTemplate:
      'Each missing relevant category is a set of search queries where the business is invisible to prospects.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessCategories: business.gbp.categories.length,
      competitorAvgCategories: competitors.avgCategories,
    }),
  },
  {
    id: 'G2',
    name: 'Primary Category Misalignment',
    category: 'gbp',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business, competitors }) =>
      !competitors.topPrimaryCategories.includes(business.gbp.primaryCategory),
    insight:
      'The primary category may not align with how top-ranking competitors are positioned in local search.',
    recommendation:
      'Reassess the primary category against top-performing local competitors.',
    businessImpactTemplate:
      'The primary category is the most heavily weighted relevance signal. A mismatch means the business may never appear for the most valuable searches in the category.',
    evidenceExtractor: ({ business, competitors }) => ({
      currentPrimaryCategory: business.gbp.primaryCategory,
      topCompetitorCategories: competitors.topPrimaryCategories,
    }),
  },
  {
    id: 'G3',
    name: 'Missing Services',
    category: 'gbp',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business, competitors }) =>
      business.gbp.servicesCount < competitors.avgServicesCount,
    insight:
      'The profile lists fewer services than competitors, reducing relevance for service-specific searches.',
    recommendation:
      'Add every service the business offers, using specific language customers would search for.',
    businessImpactTemplate:
      'Missing services are missed search opportunities. Prospects searching for a specific service may see a competitor whose profile includes it.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessServicesCount: business.gbp.servicesCount,
      competitorAvgServicesCount: competitors.avgServicesCount,
    }),
  },
  {
    id: 'G4',
    name: 'Missing Business Hours',
    category: 'gbp',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) => !business.gbp.hoursConfigured,
    insight:
      'Missing hours reduce trust and may discourage calls. Google explicitly recommends keeping hours accurate.',
    recommendation:
      'Add accurate business hours and configure special hours for holidays.',
    businessImpactTemplate:
      'Prospects who cannot confirm opening hours often choose a competitor who has this information clearly displayed.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'G5',
    name: 'No Recent Google Posts',
    category: 'gbp',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'easy',
    condition: ({ business }) => business.gbp.daysSinceLastPost > 90,
    insight:
      'The profile appears inactive because no Google Posts have been published in over 90 days.',
    recommendation:
      'Publish regular Google Business Posts — offers, events, and updates — at least twice monthly.',
    businessImpactTemplate:
      'An inactive profile looks like a neglected business to prospects comparing options. Posts signal activity and give prospects additional reasons to choose.',
    evidenceExtractor: ({ business }) => ({
      daysSinceLastPost: business.gbp.daysSinceLastPost,
    }),
  },
  {
    id: 'G6',
    name: 'Missing Attributes',
    category: 'gbp',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) => business.gbp.attributesCompletionRate < 0.7,
    insight:
      'Profile attributes are less than 70% complete, missing relevance and trust signals.',
    recommendation:
      'Complete all applicable attributes including accessibility, payment methods, and service options.',
    businessImpactTemplate:
      'Attributes affect both relevance filtering (e.g. "open now", "wheelchair accessible") and the completeness signals that influence profile prominence.',
    evidenceExtractor: ({ business }) => ({
      completionRate: `${Math.round(business.gbp.attributesCompletionRate * 100)}%`,
    }),
  },
  {
    id: 'G7',
    name: 'Unverified Profile',
    category: 'gbp',
    severity: 'critical',
    baseScoreImpact: C,
    dependencyStage: 1,
    ease: 'easy',
    condition: ({ business }) => !business.gbp.verified,
    insight:
      'The Business Profile is unverified, which is a foundational local visibility risk.',
    recommendation:
      'Complete Google Business Profile verification immediately via postcard, phone, or video.',
    businessImpactTemplate:
      'An unverified profile may not appear in local search results or the map pack. No other optimisation work will have full effect until verification is completed.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'G8',
    name: 'Missing Q&A Seeding',
    category: 'gbp',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'easy',
    condition: ({ business }) => business.gbp.qaCount === 0,
    insight:
      'The profile has no seeded Q&A entries, missing an opportunity to address common pre-sale questions directly in search.',
    recommendation:
      'Seed the Q&A section with the most common customer questions and provide thorough answers.',
    businessImpactTemplate:
      'Seeded Q&As remove friction for prospects who have questions before contacting. They also appear in search results, improving conversion from impressions.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'G9',
    name: 'Messaging Disabled',
    category: 'gbp',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'easy',
    condition: ({ business }) => !business.gbp.messagingEnabled,
    insight:
      'The profile is not capturing leads via the direct messaging channel for high-intent users.',
    recommendation:
      'Enable messaging if the business can commit to responding within the same business day.',
    businessImpactTemplate:
      'Some prospects prefer messaging over calling. Disabling this channel loses a segment of high-intent enquiries who would not otherwise contact the business.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'G10',
    name: 'Profile Completeness Deficit',
    category: 'gbp',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) => business.gbp.completenessScore < 80,
    insight:
      'The Business Profile is materially less complete than strong local listings.',
    recommendation:
      'Fill every core field before secondary optimisation: description, hours, services, attributes, and photos.',
    businessImpactTemplate:
      'Profile completeness directly affects relevance ranking. Incomplete profiles are systematically outranked by competitors who have filled every field.',
    evidenceExtractor: ({ business }) => ({
      completenessScore: business.gbp.completenessScore,
      threshold: 80,
    }),
  },
  {
    id: 'G11',
    name: 'Missing Products',
    category: 'gbp',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'product_weight',
    condition: ({ business }) => business.gbp.isRetail && business.gbp.productsCount === 0,
    insight:
      'A retail business is missing product listings on the profile, limiting product-level search visibility.',
    recommendation:
      'Add top-selling or high-margin products with photos, descriptions, and prices.',
    businessImpactTemplate:
      'Product listings in Business Profiles surface in Google Shopping and Maps, giving retail businesses an additional organic visibility channel that competitors may already be using.',
    evidenceExtractor: () => ({}),
  },
];
