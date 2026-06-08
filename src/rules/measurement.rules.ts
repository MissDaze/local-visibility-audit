import { Rule } from '../types';

const H = -12;
const M = -6;
const O = 4;

export const measurementRules: Rule[] = [
  {
    id: 'M1',
    name: 'No Baseline Snapshot',
    category: 'measurement',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => !business.measurement.baselineRecorded,
    insight:
      'The business has no recorded baseline, making it impossible to prove progress over time.',
    recommendation:
      'Save baseline visibility, review count, traffic, and conversion metrics at the time of audit.',
    businessImpactTemplate:
      'Without a starting point, any improvement is invisible. Clients and decision-makers cannot see the return on work done.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'M2',
    name: 'No Keyword Tracking',
    category: 'measurement',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => !business.measurement.localKeywordTrackingEnabled,
    insight:
      'The business has no visibility into ranking movement for its target local keywords.',
    recommendation:
      'Track core service-plus-location keywords and map pack presence monthly.',
    businessImpactTemplate:
      'Without rank tracking, improvements to the website and profile cannot be confirmed as effective, making it harder to justify ongoing investment.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'M3',
    name: 'No Call Tracking',
    category: 'measurement',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => !business.measurement.phoneCallsTracked,
    insight:
      'Phone calls from local search are not being measured, leaving a major lead source unattributed.',
    recommendation:
      'Enable call tracking or phone click event tracking via GA4 or a call tracking platform.',
    businessImpactTemplate:
      'For most local businesses, phone calls are the primary lead type. Not tracking them means the true return on local search investment is understated or invisible.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'M4',
    name: 'No GBP Insights Capture',
    category: 'measurement',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 4,
    ease: 'easy',
    condition: ({ business }) => !business.measurement.gbpInsightsAvailable,
    insight:
      'Google Business Profile interaction data — calls, direction requests, and profile views — is not being captured.',
    recommendation:
      'Pull and store GBP Insights data monthly to track profile engagement trends.',
    businessImpactTemplate:
      'GBP Insights reveal whether profile changes are driving more calls and direction requests. Without them, profile investment cannot be measured.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'M5',
    name: 'No Lead Source Attribution',
    category: 'measurement',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 6,
    ease: 'moderate',
    condition: ({ business }) => !business.measurement.sourceMediumToLeadMapping,
    insight:
      'Leads cannot be attributed to their traffic source, making it impossible to know which channels are delivering business.',
    recommendation:
      'Attribute form and call leads to source, medium, and landing page using UTM parameters and GA4 events.',
    businessImpactTemplate:
      'Without lead source attribution, marketing budget cannot be optimised. High-performing channels are invisible alongside low-performing ones.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'M6',
    name: 'Stale Competitor Snapshot',
    category: 'measurement',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 7,
    ease: 'easy',
    condition: ({ competitors }) => competitors.dataAgeDays > 30,
    insight:
      'The competitor benchmark data may be outdated in a changing local market.',
    recommendation:
      'Refresh Outscraper competitor data monthly to maintain accurate benchmarking.',
    businessImpactTemplate:
      'Stale competitor data means the business may be optimising against benchmarks that no longer reflect the real competitive landscape.',
    evidenceExtractor: ({ competitors }) => ({
      dataAgeDays: competitors.dataAgeDays,
    }),
  },
];
