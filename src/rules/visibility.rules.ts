import { Rule } from '../types';

const H = -12; // high
const M = -6;  // medium
const S = 4;   // strength
const O = 4;   // opportunity

export const visibilityRules: Rule[] = [
  {
    id: 'V1',
    name: 'Review Volume Deficit',
    category: 'visibility',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.count < competitors.avgReviews * 0.5,
    insight:
      'The business has significantly fewer reviews than local competitors, reducing social proof and prominence.',
    recommendation:
      'Implement a review acquisition system and request reviews from recent customers.',
    businessImpactTemplate:
      'Potential customers are seeing competitors with stronger social proof, which may reduce clicks, calls, and trust at the moment of comparison.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessReviews: business.gbp.reviews.count,
      competitorAvgReviews: competitors.avgReviews,
      gap: Math.round(competitors.avgReviews - business.gbp.reviews.count),
    }),
  },
  {
    id: 'V2',
    name: 'Review Volume Advantage',
    category: 'visibility',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.count > competitors.avgReviews * 1.5,
    insight:
      'The business has substantially more reviews than competitors and should leverage this advantage in marketing.',
    recommendation:
      'Highlight review count across the website and advertising channels.',
    businessImpactTemplate:
      'This review advantage can be actively used to win comparisons at the moment a prospect chooses between businesses.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessReviews: business.gbp.reviews.count,
      competitorAvgReviews: competitors.avgReviews,
      advantage: Math.round(business.gbp.reviews.count - competitors.avgReviews),
    }),
  },
  {
    id: 'V3',
    name: 'Rating Deficit',
    category: 'visibility',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.rating < competitors.avgRating - 0.3,
    insight:
      'Customer satisfaction appears lower than competing businesses, which may deter prospects.',
    recommendation:
      'Review customer feedback themes and improve service delivery before increasing acquisition spend.',
    businessImpactTemplate:
      'A lower rating than competitors signals lower service quality to prospects actively comparing options, reducing click-through and enquiry rates.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      competitorAvgRating: competitors.avgRating,
      deficit: (competitors.avgRating - business.gbp.reviews.rating).toFixed(1),
    }),
  },
  {
    id: 'V4',
    name: 'Rating Strength',
    category: 'visibility',
    severity: 'strength',
    baseScoreImpact: S,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.rating > competitors.avgRating + 0.2,
    insight:
      'Customers rate this business more highly than local competitors, providing a clear trust advantage.',
    recommendation:
      'Feature ratings prominently in website copy, ads, and social content.',
    businessImpactTemplate:
      'A rating advantage over competitors is a tangible conversion signal that should appear at every point of comparison.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      competitorAvgRating: competitors.avgRating,
      advantage: (business.gbp.reviews.rating - competitors.avgRating).toFixed(1),
    }),
  },
  {
    id: 'V5',
    name: 'Review Response Gap',
    category: 'visibility',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'easy',
    condition: ({ business }) => business.gbp.reviews.responseRate < 0.5,
    insight:
      'The business responds to fewer than half of its reviews, weakening visible engagement and trust signals.',
    recommendation:
      'Respond to all new reviews within 48 hours, and backfill responses to high-value older reviews.',
    businessImpactTemplate:
      'Unanswered reviews signal low responsiveness to prospects who read them before making contact.',
    evidenceExtractor: ({ business }) => ({
      responseRate: `${Math.round(business.gbp.reviews.responseRate * 100)}%`,
    }),
  },
  {
    id: 'V6',
    name: 'Negative Review Concentration',
    category: 'visibility',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.oneStarRatio > competitors.avgOneStarRatio * 1.5,
    insight:
      'The business has a higher concentration of one-star reviews than competitors, which may actively discourage prospects.',
    recommendation:
      'Identify recurring complaint categories and address them operationally before requesting more reviews.',
    businessImpactTemplate:
      'Disproportionate negative reviews compared to competitors reduce the click-through rate from search results and increase abandonment on the profile page.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessOneStarRatio: `${Math.round(business.gbp.reviews.oneStarRatio * 100)}%`,
      competitorAvgOneStarRatio: `${Math.round(competitors.avgOneStarRatio * 100)}%`,
    }),
  },
  {
    id: 'V7',
    name: 'Review Recency Deficit',
    category: 'visibility',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ business }) => business.gbp.reviews.daysSinceLastReview > 45,
    insight:
      'The review profile may appear stale compared with competitors receiving fresh customer feedback.',
    recommendation:
      'Build a steady monthly review request workflow to maintain recency.',
    businessImpactTemplate:
      'Prospects often sort by recency. A stale review profile suggests inactive operations and reduces trust.',
    evidenceExtractor: ({ business }) => ({
      daysSinceLastReview: business.gbp.reviews.daysSinceLastReview,
    }),
  },
  {
    id: 'V8',
    name: 'Reputation Momentum',
    category: 'visibility',
    severity: 'strength',
    baseScoreImpact: S,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.reviewsLast90Days > competitors.avgReviews90d * 1.5,
    insight:
      'The business is gaining recent social proof faster than local competitors.',
    recommendation:
      'Use recent review momentum in website copy and ad creative.',
    businessImpactTemplate:
      'Rapid review growth is a visible trust signal that prospects and algorithms both reward.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessReviews90d: business.gbp.reviews.reviewsLast90Days,
      competitorAvgReviews90d: competitors.avgReviews90d,
    }),
  },
  {
    id: 'V9',
    name: 'Reputation Risk',
    category: 'visibility',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.count > competitors.avgReviews &&
      business.gbp.reviews.rating < competitors.avgRating,
    insight:
      'The business is visible but customer satisfaction may be limiting growth despite high review volume.',
    recommendation:
      'Address recurring customer complaints before increasing acquisition spend.',
    businessImpactTemplate:
      'High review volume with a below-average rating means the business is attracting attention but not converting it, likely losing prospects to competitors with better scores.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessReviews: business.gbp.reviews.count,
      businessRating: business.gbp.reviews.rating,
      competitorAvgRating: competitors.avgRating,
    }),
  },
  {
    id: 'V10',
    name: 'Hidden Gem Signal',
    category: 'visibility',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'review_weight',
    condition: ({ business, competitors }) =>
      business.gbp.reviews.rating >= 4.7 &&
      business.gbp.reviews.count < competitors.avgReviews * 0.5,
    insight:
      'Customers rate the business exceptionally highly, but low review volume is hiding this quality signal from prospects.',
    recommendation:
      'Focus on review generation to surface the quality that already exists.',
    businessImpactTemplate:
      'If more prospects knew about the satisfaction level, conversion rates would improve materially. The gap between quality and visibility is an untapped growth lever.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessRating: business.gbp.reviews.rating,
      businessReviews: business.gbp.reviews.count,
      competitorAvgReviews: competitors.avgReviews,
    }),
  },
];
