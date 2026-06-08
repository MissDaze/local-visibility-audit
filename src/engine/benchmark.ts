import { OutscraperRecord } from '../types/outscraper';
import { ScoredCompetitor } from './relevance';

export interface BenchmarkData {
  // Sample
  totalCandidates: number;
  includedCount: number;
  excludedCount: number;

  // Website
  competitorsWithWebsites: number;
  competitorsWithoutWebsites: number;
  websiteValidationSummary: string;

  // Aggregate metrics (computed from included competitors only)
  avgRating: number | null;
  avgReviews: number | null;
  avgPhotos: number | null;
  maxRating: number | null;
  maxReviews: number | null;
  maxPhotos: number | null;
  percentWithHours: number | null;
  percentWithDescription: number | null;

  // Subject rankings within included competitors
  subjectRatingRank: number | null;
  subjectReviewRank: number | null;
  subjectPhotoRank: number | null;

  // Confidence
  benchmarkConfidence: number;
  confidenceReasons: string[];

  // Contradiction constraints (passed verbatim to LLM)
  constraints: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNum(v: number | string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function rankDesc(value: number | null, population: number[]): number | null {
  if (value === null || !population.length) return null;
  const sorted = [...population].sort((a, b) => b - a);
  // Find rank: how many competitors score strictly higher?
  const rank = sorted.filter(v => v > value).length + 1;
  return rank;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeBenchmarks(
  subject: OutscraperRecord | null,
  scoredCompetitors: ScoredCompetitor[],
): BenchmarkData {
  const included = scoredCompetitors.filter(c => c.included);
  const excludedCount = scoredCompetitors.length - included.length;

  // Website counts
  const withWebsites = included.filter(c => c.hasValidWebsite).length;
  const withoutWebsites = included.length - withWebsites;

  // Numeric populations
  const ratings = included
    .map(c => parseNum(c.record.rating))
    .filter((n): n is number => n !== null);
  const reviews = included
    .map(c => parseNum(c.record.reviews))
    .filter((n): n is number => n !== null);
  const photos = included
    .map(c => parseNum(c.record.photos_count))
    .filter((n): n is number => n !== null);

  const withHours = included.filter(c => c.record.working_hours).length;
  const withDesc = included.filter(c => c.record.description).length;

  const avgRating = avg(ratings);
  const avgReviews = avg(reviews);
  const avgPhotos = avg(photos);
  const maxRating = ratings.length ? Math.max(...ratings) : null;
  const maxReviews = reviews.length ? Math.max(...reviews) : null;
  const maxPhotos = photos.length ? Math.max(...photos) : null;
  const pctHours = included.length ? Math.round((withHours / included.length) * 100) : null;
  const pctDesc = included.length ? Math.round((withDesc / included.length) * 100) : null;

  // Subject metrics
  const subjRating = subject ? parseNum(subject.rating) : null;
  const subjReviews = subject ? parseNum(subject.reviews) : null;
  const subjPhotos = subject ? parseNum(subject.photos_count) : null;

  const subjectRatingRank = rankDesc(subjRating, ratings);
  const subjectReviewRank = rankDesc(subjReviews, reviews);
  const subjectPhotoRank = rankDesc(subjPhotos, photos);

  // ── Benchmark confidence ─────────────────────────────────────────────────
  const confidenceReasons: string[] = [];
  let confidence = 100;

  if (included.length === 0) {
    confidence = 0;
    confidenceReasons.push('No relevant competitors could be identified');
  } else if (included.length < 5) {
    confidence -= 30;
    confidenceReasons.push(`Only ${included.length} relevant competitors (low sample size)`);
  } else if (included.length < 10) {
    confidence -= 15;
    confidenceReasons.push(`${included.length} relevant competitors (moderate sample size)`);
  }

  const weakRelevance = included.filter(c => c.relevanceScore < 80).length;
  if (weakRelevance > 0) {
    const penalty = Math.min(20, weakRelevance * 3);
    confidence -= penalty;
    confidenceReasons.push(`${weakRelevance} included competitors have below-80 relevance scores`);
  }

  if (excludedCount > included.length) {
    confidence -= 10;
    confidenceReasons.push(`More competitors were excluded (${excludedCount}) than included (${included.length}) due to low relevance`);
  }

  const missingRatings = included.length - ratings.length;
  if (missingRatings > 2) {
    confidence -= 8;
    confidenceReasons.push(`${missingRatings} included competitors are missing rating data`);
  }

  confidence = Math.max(0, Math.min(100, confidence));

  const websiteValidationSummary =
    `Competitors analysed: ${included.length} | With websites: ${withWebsites} | Without websites: ${withoutWebsites}`;

  // ── Contradiction constraints (sent to LLM as hard rules) ───────────────
  const constraints: string[] = [];

  // Website
  if (withWebsites > 0) {
    constraints.push(
      `CONSTRAINT — WEBSITE: ${withWebsites} of ${included.length} relevant competitors have validated websites. ` +
      `Do NOT state that competitors lack websites or that "none have websites". ` +
      `The correct validated figure is ${withWebsites} with websites, ${withoutWebsites} without.`,
    );
  } else if (included.length > 0) {
    constraints.push(
      `VALIDATED — WEBSITE: 0 of ${included.length} included competitors have a detected website. ` +
      `This claim IS supported by the data.`,
    );
  }

  // Rating rank
  if (subjectRatingRank !== null && subjRating !== null && avgRating !== null) {
    if (subjectRatingRank <= 3 && subjRating < avgRating) {
      constraints.push(
        `CONTRADICTION DETECTED — RATING: Subject rated ${subjRating}★ is below the competitor ` +
        `average of ${avgRating}★, so it cannot rank #${subjectRatingRank}. Recalculate.`,
      );
    }
    constraints.push(
      `VALIDATED — RATING RANK: Subject (${subjRating}★) ranks #${subjectRatingRank} of ${ratings.length} competitors. ` +
      `Market average: ${avgRating}★. Market leader: ${maxRating}★.`,
    );
  }

  // Review rank
  if (subjectReviewRank !== null && subjReviews !== null && avgReviews !== null) {
    if (subjectReviewRank <= 3 && subjReviews < avgReviews) {
      constraints.push(
        `CONTRADICTION DETECTED — REVIEWS: Subject has ${subjReviews} reviews, below the average ` +
        `of ${avgReviews}, so it cannot rank #${subjectReviewRank}. Recalculate.`,
      );
    }
    if (subjectReviewRank > included.length - 2 && subjReviews > avgReviews) {
      constraints.push(
        `CONTRADICTION DETECTED — REVIEWS: Subject has ${subjReviews} reviews, above the average ` +
        `of ${avgReviews}, so it cannot rank near the bottom. Recalculate.`,
      );
    }
    constraints.push(
      `VALIDATED — REVIEW RANK: Subject (${subjReviews} reviews) ranks #${subjectReviewRank} of ` +
      `${reviews.length} competitors. Market average: ${avgReviews}. Market leader: ${maxReviews}.`,
    );
  }

  // Photo rank
  if (subjectPhotoRank !== null && subjPhotos !== null) {
    constraints.push(
      `VALIDATED — PHOTO RANK: Subject (${subjPhotos} photos) ranks #${subjectPhotoRank} of ` +
      `${photos.length} competitors. Market average: ${avgPhotos}. Market leader: ${maxPhotos}.`,
    );
  }

  return {
    totalCandidates: scoredCompetitors.length,
    includedCount: included.length,
    excludedCount,
    competitorsWithWebsites: withWebsites,
    competitorsWithoutWebsites: withoutWebsites,
    websiteValidationSummary,
    avgRating,
    avgReviews,
    avgPhotos,
    maxRating,
    maxReviews,
    maxPhotos,
    percentWithHours: pctHours,
    percentWithDescription: pctDesc,
    subjectRatingRank,
    subjectReviewRank,
    subjectPhotoRank,
    benchmarkConfidence: confidence,
    confidenceReasons,
    constraints,
  };
}
