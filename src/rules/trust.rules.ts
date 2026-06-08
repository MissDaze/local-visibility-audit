import { Rule } from '../types';

const H = -12;
const M = -6;
const O = 4;

export const trustRules: Rule[] = [
  {
    id: 'T1',
    name: 'Photo Deficit',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'photo_weight',
    condition: ({ business, competitors }) =>
      business.gbp.photoCount < competitors.avgPhotoCount * 0.5,
    insight:
      'The business provides fewer visual trust signals than competitors on its profile.',
    recommendation:
      'Upload high-quality photos of completed work, staff, premises, and products.',
    businessImpactTemplate:
      'Searchers have less visual confidence in the business. Profiles with strong photo libraries attract more clicks from local search results.',
    evidenceExtractor: ({ business, competitors }) => ({
      businessPhotos: business.gbp.photoCount,
      competitorAvgPhotos: competitors.avgPhotoCount,
      gap: Math.round(competitors.avgPhotoCount - business.gbp.photoCount),
    }),
  },
  {
    id: 'T2',
    name: 'Inactive Profile Media',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'easy',
    industryWeightKey: 'photo_weight',
    condition: ({ business }) => business.gbp.daysSinceLastPhoto > 90,
    insight:
      'The profile appears inactive because visual content has not been updated in over 90 days.',
    recommendation: 'Publish fresh, authentic photos at least monthly.',
    businessImpactTemplate:
      'Stale profiles signal an inactive business. Prospects comparing multiple options favour businesses that show recent real activity.',
    evidenceExtractor: ({ business }) => ({
      daysSinceLastPhoto: business.gbp.daysSinceLastPhoto,
    }),
  },
  {
    id: 'T3',
    name: 'Missing Business Description',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) => business.gbp.descriptionLength < 100,
    insight:
      'The profile does not clearly explain what the business does or why it should be chosen.',
    recommendation:
      'Write a comprehensive, keyword-rich business description that addresses services, differentiators, and the area served.',
    businessImpactTemplate:
      'Without a compelling description, prospects cannot quickly understand what makes this business the right choice. This increases bounce and reduces enquiry rates.',
    evidenceExtractor: ({ business }) => ({
      descriptionLength: business.gbp.descriptionLength,
      recommended: 750,
    }),
  },
  {
    id: 'T4',
    name: 'Missing Website Testimonials',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 6,
    ease: 'easy',
    condition: ({ business }) =>
      !business.website.testimonialsPresent && !business.website.reviewWidgetPresent,
    insight:
      'The website does not reinforce reputation near conversion points with testimonials or live reviews.',
    recommendation:
      'Add testimonials or a review widget near service and contact sections.',
    businessImpactTemplate:
      'Prospects seeking reassurance before making contact find no social proof on the site, increasing the chance they return to search results and choose a competitor.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'T5',
    name: 'Missing Real Business Photography',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 3,
    ease: 'moderate',
    industryWeightKey: 'photo_weight',
    condition: ({ business }) => !business.website.realTeamOrWorkPhotos,
    insight:
      'The website lacks authentic photos of the team, premises, or completed work.',
    recommendation:
      'Add real photos of staff, the workplace, or finished jobs — avoid generic stock imagery.',
    businessImpactTemplate:
      'Generic sites feel low-trust. Real photography builds confidence and differentiates the business from competitors who look identical online.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'T6',
    name: 'Missing Trust Signals Near Conversion',
    category: 'trust',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 6,
    ease: 'easy',
    industryWeightKey: 'trust_weight',
    condition: ({ business }) => !business.website.trustSignalsNearForm,
    insight:
      'High-intent visitors do not see accreditations, guarantees, or social proof near enquiry forms or booking actions.',
    recommendation:
      'Add trust badges, guarantees, insurance details, or review excerpts near all conversion actions.',
    businessImpactTemplate:
      'Conversion rates near forms improve significantly when prospect anxiety is addressed with visible proof at the exact moment of decision.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'T7',
    name: 'Weak Contact Transparency',
    category: 'trust',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 3,
    ease: 'easy',
    condition: ({ business }) =>
      !business.website.phoneClickable ||
      !business.website.formPresent ||
      !business.website.addressVisible,
    insight:
      'Core contact paths are unclear, incomplete, or hard to use — reducing trust and enquiry rates.',
    recommendation:
      'Make phone numbers click-to-call, add a contact form, and display the address clearly on every page.',
    businessImpactTemplate:
      'When prospects cannot immediately see how to contact the business, they leave. Every friction point in the contact path costs enquiries.',
    evidenceExtractor: ({ business }) => ({
      phoneClickable: business.website.phoneClickable,
      formPresent: business.website.formPresent,
      addressVisible: business.website.addressVisible,
    }),
  },
  {
    id: 'T8',
    name: 'Missing Legitimacy Signals',
    category: 'trust',
    severity: 'opportunity',
    baseScoreImpact: O,
    dependencyStage: 3,
    ease: 'easy',
    condition: ({ business }) =>
      business.country === 'AU' && !business.website.abnOrAcnVisible,
    insight:
      'The website may be missing a credibility detail expected by some Australian buyers.',
    recommendation:
      'Display ABN, company registration details, and legitimacy signals in the footer.',
    businessImpactTemplate:
      'In Australia, visible ABN details increase trust for B2B and higher-value transactions by demonstrating legitimate business registration.',
    evidenceExtractor: ({ business }) => ({
      country: business.country,
    }),
  },
];
