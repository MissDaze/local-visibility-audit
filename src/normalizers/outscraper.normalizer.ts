import { CompetitorData, BusinessProfile } from '../types';
import { OutscraperRecord, NormalizedCompetitorRecord } from '../types/outscraper';

// Safely parse a value that may arrive as string or number from a CSV parser.
function toNum(v: string | number | undefined, fallback = 0): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Compute what percentile `value` is within `population` (0–100).
// Higher value = higher percentile.
function percentileOf(value: number, population: number[]): number {
  if (!population.length) return 50;
  const below = population.filter(v => v < value).length;
  return Math.round((below / population.length) * 100);
}

export function normalizeOutscraperRecord(raw: OutscraperRecord): NormalizedCompetitorRecord {
  const rating = toNum(raw.rating);
  const reviewCount = toNum(raw.reviews);
  const photoCount = toNum(raw.photos_count);
  const oneStar = toNum(raw.reviews_per_score_1);
  const oneStarRatio = reviewCount > 0 ? oneStar / reviewCount : 0;

  const primaryCategory = (raw.type ?? '').trim();
  const allCategories = primaryCategory
    ? [
        primaryCategory,
        ...(raw.subtypes ?? '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      ]
    : [];

  return {
    name: raw.name ?? '',
    rating,
    reviewCount,
    photoCount,
    primaryCategory,
    allCategories,
    hasWebsite: !!raw.site,
    hasHours: !!raw.working_hours,
    hasDescription: (raw.description ?? '').length > 50,
    isOperational: (raw.business_status ?? 'OPERATIONAL').toUpperCase() === 'OPERATIONAL',
    oneStarCount: oneStar,
    fiveStarCount: toNum(raw.reviews_per_score_5),
    oneStarRatio,
  };
}

// Primary export: convert an array of Outscraper records (top 20 competitors) into the
// CompetitorData shape the audit engine expects, plus percentile positioning for the
// subject business.
export function normalizeOutscraperData(
  rawRecords: OutscraperRecord[],
  business: BusinessProfile,
): CompetitorData {
  // Filter to operational businesses only
  const records = rawRecords
    .map(normalizeOutscraperRecord)
    .filter(r => r.isOperational);

  if (!records.length) {
    throw new Error('No operational competitor records found in Outscraper data.');
  }

  const ratings = records.map(r => r.rating).filter(r => r > 0);
  const reviews = records.map(r => r.reviewCount);
  const photos = records.map(r => r.photoCount);
  const categories = records.map(r => r.allCategories.length);
  const oneStarRatios = records.map(r => r.oneStarRatio);

  // Primary category frequency — pick the top 3 most common
  const categoryFreq: Record<string, number> = {};
  for (const r of records) {
    const cat = r.primaryCategory;
    if (cat) categoryFreq[cat] = (categoryFreq[cat] ?? 0) + 1;
  }
  const topPrimaryCategories = Object.entries(categoryFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // Percentile positioning: where does the subject business sit vs the competitor set?
  const businessReviews = business.gbp.reviews.count;
  const businessRating = business.gbp.reviews.rating;

  // Estimate a prominence score using review count + rating as a proxy
  const competitorProminenceScores = records.map(r => r.reviewCount * r.rating);
  const businessProminenceScore = businessReviews * businessRating;

  return {
    avgReviews: Math.round(avg(reviews)),
    avgRating: Number(avg(ratings).toFixed(1)),
    avgPhotoCount: Math.round(avg(photos)),
    avgCategories: Number(avg(categories).toFixed(1)),
    avgServicesCount: 0, // Outscraper does not expose service count directly
    avgCitationCount: 0, // Cannot derive from Outscraper — must be provided separately
    avgReviews90d: 0,    // Not available in Outscraper export
    avgOneStarRatio: Number(avg(oneStarRatios).toFixed(3)),
    topPrimaryCategories,
    avgVisibilityScore: 0, // Derived internally by the engine
    avgConversionScore: 0,
    avgTrustScore: 0,
    avgRatingScore: Number(avg(ratings).toFixed(1)),
    avgServicePageWordCount: 0, // Cannot derive from Outscraper
    sampleSize: records.length,
    dataAgeDays: 0, // Caller should set this based on export date
    prominenceScorePercentile: percentileOf(businessProminenceScore, competitorProminenceScores),
    reviewPercentile: percentileOf(businessReviews, reviews),
    ratingPercentile: percentileOf(businessRating, ratings),
  };
}

// Parse Outscraper CSV text into raw records.
// Handles quoted fields and standard CSV conventions.
export function parseOutscraperCsv(csvText: string): OutscraperRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records: OutscraperRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 2) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h.trim()] = (values[idx] ?? '').trim();
    });
    records.push(record as unknown as OutscraperRecord);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
