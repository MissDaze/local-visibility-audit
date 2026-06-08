import { Finding } from '../types';

// Maps a triggering rule ID → rule IDs it suppresses.
// Suppression prevents noisy reports where a foundational issue is triggered
// alongside lower-priority related findings that only make sense once the
// foundational issue is resolved.
const SUPPRESSION_MAP: Record<string, string[]> = {
  // Unverified profile overrides all profile-level optimisation findings.
  G7: ['G1', 'G3', 'G5', 'G6', 'G8', 'G9', 'G10', 'G11'],

  // No SSL — suppress cosmetic trust refinements; security takes precedence.
  W4: ['T6', 'T4'],

  // Missing contact page suppresses the softer CTA-coverage warning on contact paths.
  W2: ['W5'],

  // Missing analytics foundation suppresses all measurement-refinement rules.
  X6: ['M2', 'M4', 'M5'],

  // Missing conversion tracking suppresses lead-source attribution finding.
  X7: ['M5'],

  // Core data mismatch suppresses lighter NAP presentation warnings.
  E5: ['W6'],

  // Critical technical issue suppresses lower-priority UX refinements.
  X8: ['X4', 'X5', 'X9', 'X10'],
};

export function applySuppression(findings: Finding[]): Finding[] {
  const triggeredIds = new Set(findings.map(f => f.ruleId));

  return findings.map(finding => {
    for (const [suppressorId, suppressedIds] of Object.entries(SUPPRESSION_MAP)) {
      if (triggeredIds.has(suppressorId) && suppressedIds.includes(finding.ruleId)) {
        return { ...finding, suppressed: true, suppressedBy: suppressorId };
      }
    }
    return finding;
  });
}
