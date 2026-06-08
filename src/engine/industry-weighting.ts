import { Finding, Industry } from '../types';
import industryProfiles from '../config/industry-profiles.json';

type IndustryProfile = Record<string, number>;

// Multiply a finding's base score impact by the industry-specific weight for that
// signal type. The weight amplifies or dampens how much a rule's impact contributes
// to the score — e.g., photos matter more for restaurants than law firms.
export function applyIndustryWeighting(findings: Finding[], industry: Industry): Finding[] {
  const profile = (industryProfiles as Record<string, IndustryProfile>)[industry]
    ?? (industryProfiles as Record<string, IndustryProfile>)['general'];

  return findings.map(finding => {
    const key = finding.industryWeightKey;
    const weight = key && profile[key] != null ? profile[key] : 1.0;
    const adjusted = Math.round(finding.baseScoreImpact * weight * 10) / 10;

    return { ...finding, adjustedScoreImpact: adjusted };
  });
}
