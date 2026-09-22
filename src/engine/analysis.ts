import { OutscraperRecord } from '../types/outscraper';
import { ScoredCompetitor } from './relevance';
import { BenchmarkData } from './benchmark';

export interface CompetitorEvidence {
  name: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  relevanceScore: number;
  categoryMatch: string;
  included: boolean;
  inclusionReason: string | null;
  exclusionReason: string | null;
  reviews: number | null;
  rating: number | null;
  photos: number | null;
}

export interface CanonicalAnalysis {
  version: '2.0';
  subject: {
    name: string;
    placeId: string | null;
    latitude: number | null;
    longitude: number | null;
    category: string | null;
    subtypes: string[];
  } | null;
  set: {
    candidateCount: number;
    n: number;
    members: CompetitorEvidence[];
    excluded: CompetitorEvidence[];
  };
  benchmarks: BenchmarkData;
  visibility: null;
  overallExcludes: ['visibility'];
}

const num = (v: number | string | undefined): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function haversineKm(a: OutscraperRecord, b: OutscraperRecord): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat/2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon/2) ** 2;
  return Math.round((6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))) * 10) / 10;
}

export function buildCanonicalAnalysis(subject: OutscraperRecord | null, scored: ScoredCompetitor[], benchmarks: BenchmarkData): CanonicalAnalysis {
  const evidence = scored.map(c => {
    const distanceKm = subject ? haversineKm(subject, c.record) : null;
    const inclusionReason = c.included
      ? [c.categoryMatch, distanceKm !== null ? distanceKm + ' km' : null, 'relevance ' + c.relevanceScore + '/100'].filter(Boolean).join(', ')
      : null;
    return {
      name: c.record.name || 'Unknown',
      category: c.record.type || null,
      latitude: c.record.latitude ?? null,
      longitude: c.record.longitude ?? null,
      distanceKm,
      relevanceScore: c.relevanceScore,
      categoryMatch: c.categoryMatch,
      included: c.included,
      inclusionReason,
      exclusionReason: c.exclusionReason,
      reviews: num(c.record.reviews),
      rating: num(c.record.rating),
      photos: num(c.record.photos_count),
    };
  });
  return {
    version: '2.0',
    subject: subject ? {
      name: subject.name,
      placeId: subject.place_id || null,
      latitude: subject.latitude ?? null,
      longitude: subject.longitude ?? null,
      category: subject.type || null,
      subtypes: String(subject.subtypes || '').split(',').map(s => s.trim()).filter(Boolean),
    } : null,
    set: {
      candidateCount: scored.length,
      n: evidence.filter(e => e.included).length,
      members: evidence.filter(e => e.included),
      excluded: evidence.filter(e => !e.included),
    },
    benchmarks,
    visibility: null,
    overallExcludes: ['visibility'],
  };
}

export function validateCanonicalAnalysis(a: CanonicalAnalysis): void {
  const errors: string[] = [];
  if (a.set.members.some(m => !m.included)) errors.push('excluded competitor present in members');
  if (a.set.excluded.some(m => m.included)) errors.push('included competitor present in exclusions');
  if (a.set.n !== a.set.members.length) errors.push('competitor set count mismatch');
  for (const rank of [a.benchmarks.subjectRatingRank, a.benchmarks.subjectReviewRank, a.benchmarks.subjectPhotoRank]) {
    if (rank !== null && (rank < 1 || rank > a.set.n + 1)) errors.push('rank outside subject+competitor population');
  }
  if (errors.length) throw new Error('Analysis QA failed: ' + [...new Set(errors)].join('; '));
}
