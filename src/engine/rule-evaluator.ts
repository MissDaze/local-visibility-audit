import { AuditInput, Finding, Rule } from '../types';

// Evaluate every rule against the input and return one Finding per triggered rule.
// Score adjustment and suppression happen in later pipeline stages.
export function evaluateRules(rules: Rule[], input: AuditInput): Finding[] {
  const findings: Finding[] = [];

  for (const rule of rules) {
    let triggered = false;
    try {
      triggered = rule.condition(input);
    } catch {
      // A condition that throws on missing data is treated as not triggered.
      triggered = false;
    }

    if (!triggered) continue;

    findings.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      baseScoreImpact: rule.baseScoreImpact,
      adjustedScoreImpact: rule.baseScoreImpact, // overwritten by industry-weighting stage
      dependencyStage: rule.dependencyStage,
      ease: rule.ease,
      industryWeightKey: rule.industryWeightKey,
      insight: rule.insight,
      recommendation: rule.recommendation,
      businessImpact: rule.businessImpactTemplate, // enriched by business-impact stage
      evidence: rule.evidenceExtractor(input),
      suppressed: false,
    });
  }

  return findings;
}
