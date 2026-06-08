import { Rule } from '../types';

const H = -12;
const S = 4;
const O = 4;

export const competitiveRules: Rule[] = [
  {
    id: 'C1',
    name: 'Bottom Quartile Reviews',
    category: 'competitive',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ competitors }) => competitors.reviewPercentile < 25,
    insight:
      'The business ranks in the bottom 25% of the local competitor set for review volume.',
    recommendation:
      'Prioritise review generation immediately — this is the highest-leverage visibility action.',
    businessImpactTemplate:
      'Being in the bottom quartile for reviews means the business is easily beaten in head-to-head comparisons on the primary trust signal that prospects use.',
    evidenceExtractor: ({ competitors }) => ({
      reviewPercentile: competitors.reviewPercentile,
      sampleSize: competitors.sampleSize,
    }),
  },
  {
    id: 'C2',
    name: 'Top Quartile Rating',
    category: 'competitive',
    severity: 'strength',
    baseScoreImpact: S,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'review_weight',
    condition: ({ competitors }) => competitors.ratingPercentile > 75,
    insight:
      'Customer satisfaction exceeds most local competitors.',
    recommendation:
      'Feature rating comparisons in marketing materials and Google Ads extensions.',
    businessImpactTemplate:
      'A top-quartile rating is a competitive advantage that prospects respond to during comparison. Amplify it across every touchpoint.',
    evidenceExtractor: ({ competitors, business }) => ({
      businessRating: business.gbp.reviews.rating,
      ratingPercentile: competitors.ratingPercentile,
    }),
  },
  {
    id: 'C3',
    name: 'Visibility Mismatch',
    category: 'competitive',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.rating > competitors.avgRating &&
      business.gbp.reviews.count < competitors.avgReviews,
    insight:
      'Customers love the business, but too few potential customers see that proof.',
    recommendation:
      'Increase review volume to surface the quality that already exists.',
    businessImpactTemplate:
      'This business is underperforming on visibility despite delivering above-average service quality. Closing this gap could produce disproportionate growth.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      businessReviews: business.gbp.reviews.count,
      competitorAvgReviews: competitors.avgReviews,
    }),
  },
  {
    id: 'C4',
    name: 'Market Leader',
    category: 'competitive',
    severity: 'strength',
    baseScoreImpact: S,
    dependencyStage: 7,
    ease: 'easy',
    condition: ({ competitors }) =>
      competitors.reviewPercentile > 90 && competitors.ratingPercentile > 90,
    insight:
      'The business is among the strongest performers in its local market on both volume and quality.',
    recommendation:
      'Focus on conversion optimisation and retention rather than chasing more visibility.',
    businessImpactTemplate:
      'Market leadership on reviews and rating is the strongest competitive position in local search. Protecting and extending this lead should be the primary strategic priority.',
    evidenceExtractor: ({ competitors }) => ({
      reviewPercentile: competitors.reviewPercentile,
      ratingPercentile: competitors.ratingPercentile,
    }),
  },
  {
    id: 'C5',
    name: 'Weak Prominence Position',
    category: 'competitive',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'hard',
    condition: ({ competitors }) => competitors.prominenceScorePercentile < 30,
    insight:
      'The business is underperforming in overall local prominence compared with competitors.',
    recommendation:
      'Improve review volume, citation coverage, backlinks, and wider local mentions to build prominence.',
    businessImpactTemplate:
      'Prominence is a core Google local ranking factor. A weak prominence position limits how often the business appears in the map pack, reducing impression share and clicks.',
    evidenceExtractor: ({ competitors }) => ({
      prominencePercentile: competitors.prominenceScorePercentile,
    }),
  },
  {
    id: 'C6',
    name: 'Conversion Opportunity Leader',
    category: 'competitive',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 6,
    ease: 'moderate',
    industryWeightKey: 'conversion_path_weight',
    condition: ({ business, competitors }) =>
      business.website.conversionScore > competitors.avgConversionScore &&
      competitors.avgVisibilityScore < business.website.conversionScore,
    insight:
      'The website is stronger on conversion than the competitive average, creating an opportunity to increase traffic.',
    recommendation:
      'Increase visibility investment — the conversion infrastructure is ready to handle more traffic.',
    businessImpactTemplate:
      'When conversion foundations are already strong, adding more top-of-funnel traffic produces better returns than continuing to refine conversion alone.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessConversionScore: business.website.conversionScore,
      competitorAvgConversionScore: competitors.avgConversionScore,
    }),
  },
  {
    id: 'C7',
    name: 'Trust Gap vs Visibility',
    category: 'competitive',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'trust_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.count >= competitors.avgReviews &&
      business.gbp.reviews.rating < competitors.avgRating,
    insight:
      'The business is being seen but not trusted as strongly as competitors at the moment of comparison.',
    recommendation:
      'Improve review response behaviour, address complaint patterns, and strengthen trust proof across the site.',
    businessImpactTemplate:
      'Visibility without trust means the business is attracting interest but losing enquiries to competitors who rate higher. This is a revenue leak that grows as visibility increases.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      competitorAvgRating: competitors.avgRating,
    }),
  },
  {
    id: 'C8',
    name: 'Underdeveloped Challenger',
    category: 'competitive',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.count < competitors.avgReviews &&
      business.gbp.reviews.rating > competitors.avgRating,
    insight:
      'Strong customer satisfaction but weaker discoverability than the quality deserves.',
    recommendation:
      'Improve GBP categories, citation coverage, service completeness, and review generation.',
    businessImpactTemplate:
      'This business is delivering better service than its visibility suggests. Closing the discoverability gap could produce significant growth without any change to operations.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      competitorAvgRating: competitors.avgRating,
      businessReviews: business.gbp.reviews.count,
      competitorAvgReviews: competitors.avgReviews,
    }),
  },
];
