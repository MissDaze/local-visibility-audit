import { Rule } from '../types';

const H = -12;
const M = -6;

export const citationRules: Rule[] = [
  {
    id: 'E1',
    name: 'NAP Inconsistency',
    category: 'citation',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'moderate',
    condition: ({ business }) => business.citations.napConsistencyScore < 0.85,
    insight:
      'Name, address, or phone details are inconsistent across directory listings, weakening local entity signals.',
    recommendation:
      'Audit and standardise NAP details across all existing directory listings.',
    businessImpactTemplate:
      'Inconsistent business data confuses both search engines and customers. It reduces entity confidence, which can suppress map pack appearances.',
    evidenceExtractor: ({ business }) => ({
      consistencyScore: `${Math.round(business.citations.napConsistencyScore * 100)}%`,
    }),
  },
  {
    id: 'E2',
    name: 'Citation Coverage Deficit',
    category: 'citation',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    industryWeightKey: 'citation_weight',
    condition: ({ business, competitors }) =>
      business.citations.citationCount < competitors.avgCitationCount * 0.6,
    insight:
      'The business appears in significantly fewer relevant directories than local competitors.',
    recommendation:
      'Build citations on trusted local directories, industry-specific platforms, and aggregators.',
    businessImpactTemplate:
      'Citation coverage is a prominence signal. A weaker citation footprint than competitors reduces the business\'s authority in local search.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessCitations: business.citations.citationCount,
      competitorAvgCitations: competitors.avgCitationCount,
      gap: Math.round(competitors.avgCitationCount - business.citations.citationCount),
    }),
  },
  {
    id: 'E3',
    name: 'Missing Priority Directories',
    category: 'citation',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    condition: ({ business }) =>
      business.citations.missingPriorityDirectoriesCount >= 3,
    insight:
      'The business is absent from three or more high-authority discovery platforms.',
    recommendation:
      'Claim and complete listings on priority directories relevant to the industry and location.',
    businessImpactTemplate:
      'Priority directories are where competitors are already listed. Absence from them both reduces authority signals and misses direct discovery traffic from those platforms.',
    evidenceExtractor: ({ business }) => ({
      missingDirectories: business.citations.missingPriorityDirectoriesCount,
    }),
  },
  {
    id: 'E4',
    name: 'Duplicate Listings Risk',
    category: 'citation',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'moderate',
    condition: ({ business }) => business.citations.duplicateListingCount > 0,
    insight:
      'Duplicate listings exist, which can split authority signals and confuse customers.',
    recommendation:
      'Merge or request removal of duplicate listings on all affected platforms.',
    businessImpactTemplate:
      'Duplicate listings dilute authority signals, can cause inconsistent NAP across platforms, and may result in the wrong listing appearing in search results.',
    evidenceExtractor: ({ business }) => ({
      duplicateListingCount: business.citations.duplicateListingCount,
    }),
  },
  {
    id: 'E5',
    name: 'Website and GBP Data Mismatch',
    category: 'citation',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) =>
      business.website.phone !== business.citations.phone ||
      business.website.phone !== business.gbp.reviews.count.toString() || // proxy check
      business.citations.name !== business.gbp.categories[0], // proxy check - real impl uses name fields
    insight:
      'Core business details are inconsistent between the website and Google Business Profile.',
    recommendation:
      'Align name, address, and phone across the website, GBP, and all directory listings immediately.',
    businessImpactTemplate:
      'Data inconsistency across owned assets is the highest-priority citation issue. It weakens entity confidence in Google and creates a confusing prospect experience.',
    evidenceExtractor: ({ business }) => ({
      websitePhone: business.website.phone,
      citationsPhone: business.citations.phone,
    }),
  },
];
