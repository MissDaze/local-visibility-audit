import { AuditInput, Finding, RuleCategory, Scores } from '../types';

// Maps each rule category to the score dimension it affects.
// visibility rules affect the visibility score, website rules affect conversion, etc.
const CATEGORY_TO_DIMENSION: Record<RuleCategory, keyof Omit<Scores, 'overall' | 'confidence'>> = {
  visibility:   'visibility',
  trust:        'trust',
  competitive:  'marketPosition',
  website:      'conversion',
  gbp:          'gbp',
  local:        'content',
  citation:     'entity',
  technical:    'technical',
  measurement:  'measurementReadiness',
};

// Overall score weights matching the product spec:
//   Visibility & Reputation       25%
//   GBP Completeness & Activity   20%
//   Website Conversion & Trust    20%
//   Technical & UX Health         15%
//   Citation & Entity             10%
//   Local Content                  5%
//   Measurement & Readiness        5%
const OVERALL_WEIGHTS: Record<keyof Omit<Scores, 'overall' | 'confidence'>, number> = {
  visibility:          0.25,
  gbp:                 0.20,
  conversion:          0.20,
  technical:           0.15,
  entity:              0.10,
  content:             0.05,
  measurementReadiness: 0.05,
  trust:               0,    // reported separately, not in overall formula
  marketPosition:      0,    // reported separately
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Confidence score captures uncertainty from data gaps.
function computeConfidence(input: AuditInput): number {
  let score = 100;
  if (input.competitors.sampleSize < 3)       score -= 15;
  if (input.competitors.dataAgeDays > 30)      score -= 10;
  if (!input.business.measurement.ga4Installed) score -= 10;
  if (input.business.gbp.completenessScore < 50) score -= 10;
  if (input.business.gbp.reviews.count < 5)   score -= 5;
  return clamp(score);
}

export function computeScores(findings: Finding[], input: AuditInput): Scores {
  // Start every dimension at 100, then subtract/add based on triggered findings.
  const raw: Record<string, number> = {
    visibility:          100,
    trust:               100,
    conversion:          100,
    technical:           100,
    gbp:                 100,
    entity:              100,
    content:             100,
    marketPosition:      100,
    measurementReadiness: 100,
  };

  for (const finding of findings) {
    if (finding.suppressed) continue;
    const dim = CATEGORY_TO_DIMENSION[finding.category];
    raw[dim] += finding.adjustedScoreImpact;
  }

  // Clamp all dimensions.
  const clamped = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, clamp(v)]),
  ) as Record<string, number>;

  // Weighted overall.
  const overall = Object.entries(OVERALL_WEIGHTS).reduce((sum, [dim, weight]) => {
    return sum + (clamped[dim] ?? 0) * weight;
  }, 0);

  return {
    overall:             clamp(overall),
    visibility:          clamped['visibility'],
    trust:               clamped['trust'],
    conversion:          clamped['conversion'],
    technical:           clamped['technical'],
    gbp:                 clamped['gbp'],
    entity:              clamped['entity'],
    content:             clamped['content'],
    marketPosition:      clamped['marketPosition'],
    measurementReadiness: clamped['measurementReadiness'],
    confidence:          computeConfidence(input),
  };
}
