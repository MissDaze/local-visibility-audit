import { Rule } from '../types';

const C = -20; // critical
const H = -12;
const M = -6;
const L = -3;

export const websiteRules: Rule[] = [
  {
    id: 'W1',
    name: 'Slow Mobile Website',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 4,
    ease: 'hard',
    industryWeightKey: 'mobile_speed_weight',
    condition: ({ business }) => business.website.mobileSpeedScore < 60,
    insight:
      'Visitors may abandon the site before it fully loads. Mobile speed is a core website health factor.',
    recommendation:
      'Optimise images, defer non-critical scripts, and review hosting performance.',
    businessImpactTemplate:
      'A slow mobile site loses a significant share of local traffic before a single prospect can read the offer or make contact. Every second of load time increases bounce rate.',
    evidenceExtractor: ({ business }) => ({
      mobileSpeedScore: business.website.mobileSpeedScore,
      threshold: 60,
    }),
  },
  {
    id: 'W2',
    name: 'Missing Contact Page',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 3,
    ease: 'easy',
    condition: ({ business }) => business.website.contactPageMissing,
    insight:
      'The website has no clear contact page, making it difficult for prospects to reach the business.',
    recommendation:
      'Create a dedicated contact page with phone, form, address, map, and hours.',
    businessImpactTemplate:
      'Without a clear contact path, interested prospects abandon rather than enquire. This is a direct conversion loss.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'W3',
    name: 'Service Page Deficit',
    category: 'website',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'moderate',
    condition: ({ business }) => business.website.servicePageCount < 3,
    insight:
      'The website may not be targeting enough service-related searches to maximise local visibility.',
    recommendation:
      'Create dedicated pages for each major service with unique content, FAQs, and local relevance.',
    businessImpactTemplate:
      'Each missing service page is a missed opportunity to rank for high-intent searches and capture prospects comparing options.',
    evidenceExtractor: ({ business }) => ({
      servicePageCount: business.website.servicePageCount,
    }),
  },
  {
    id: 'W4',
    name: 'No SSL Certificate',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 3,
    ease: 'easy',
    condition: ({ business }) => !business.website.ssl,
    insight:
      'The website is not served over HTTPS. Browsers display a security warning to visitors.',
    recommendation:
      'Install and configure an SSL certificate — most hosts include this at no cost.',
    businessImpactTemplate:
      'A "Not Secure" browser warning causes immediate abandonment from a large share of visitors, especially before sharing contact details.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'W5',
    name: 'Weak CTA Coverage',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 6,
    ease: 'moderate',
    industryWeightKey: 'conversion_path_weight',
    condition: ({ business }) => business.website.importantPagesWithoutCtaRatio > 0.5,
    insight:
      'More than half of important pages lack a clear call to action, leaving visitors without a next step.',
    recommendation:
      'Add a clear quote, booking, call, or enquiry action on every key page.',
    businessImpactTemplate:
      'Pages without CTAs are conversion dead-ends. Traffic reaching these pages does not become leads.',
    evidenceExtractor: ({ business }) => ({
      pagesWithoutCtaRatio: `${Math.round(business.website.importantPagesWithoutCtaRatio * 100)}%`,
    }),
  },
  {
    id: 'W6',
    name: 'Missing NAP in Footer',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 2,
    ease: 'easy',
    condition: ({ business }) => !business.website.napInFooter,
    insight:
      'Business name, address, and phone are not consistently displayed across the site footer.',
    recommendation:
      'Add consistent NAP details to the global footer.',
    businessImpactTemplate:
      'Missing NAP in the footer weakens local entity signals and prevents prospects from finding contact details on non-contact pages.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'W7',
    name: 'Missing Map Embed',
    category: 'website',
    severity: 'low',
    baseScoreImpact: -3,
    dependencyStage: 6,
    ease: 'easy',
    condition: ({ business }) => !business.website.embeddedMapPresent,
    insight:
      'The contact page is missing an embedded map, which is a useful local trust and location cue.',
    recommendation:
      'Embed a Google Map on the contact page.',
    businessImpactTemplate:
      'A map embed reinforces local presence and helps prospects confirm the business is genuinely nearby.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'W8',
    name: 'Missing Pricing or Quote Clarity',
    category: 'website',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 6,
    ease: 'moderate',
    condition: ({ business }) =>
      !business.website.pricingInfoPresent && !business.website.quoteProcessExplained,
    insight:
      'Buyers may hesitate because the pricing expectation or quote process is unclear.',
    recommendation:
      'Add pricing guidance, starting rates, or a clear explanation of the quote process.',
    businessImpactTemplate:
      'Price anxiety is the most common reason enquiry-ready prospects abandon. Removing that uncertainty increases form submissions and calls.',
    evidenceExtractor: () => ({}),
  },
  {
    id: 'W9',
    name: 'Thin Homepage Value Proposition',
    category: 'website',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 3,
    ease: 'moderate',
    condition: ({ business }) => business.website.homepageValuePropLength < 80,
    insight:
      'The homepage does not clearly explain what the business does or why a prospect should choose it.',
    recommendation:
      'Rewrite above-the-fold messaging to clearly state the service, location, and key differentiator.',
    businessImpactTemplate:
      'A weak homepage proposition causes visitors to leave before engaging with any other content, wasting traffic from all sources.',
    evidenceExtractor: ({ business }) => ({
      currentLength: business.website.homepageValuePropLength,
    }),
  },
  {
    id: 'W10',
    name: 'Location Page Deficit',
    category: 'website',
    severity: 'medium',
    baseScoreImpact: M,
    dependencyStage: 5,
    ease: 'hard',
    industryWeightKey: 'location_page_weight',
    condition: ({ business }) =>
      business.website.serviceAreasCount >= 3 &&
      business.website.locationPageCount < business.website.serviceAreasCount * 0.5,
    insight:
      'The business serves multiple areas but lacks the location pages needed to rank locally across them.',
    recommendation:
      'Build unique location pages for the highest-priority service areas.',
    businessImpactTemplate:
      'Without location pages, the business cannot rank for "[service] in [suburb]" searches in its full service area, leaving demand uncaptured.',
    evidenceExtractor: ({ business }) => ({
      serviceAreasCount: business.website.serviceAreasCount,
      locationPageCount: business.website.locationPageCount,
    }),
  },
  {
    id: 'W11',
    name: 'Conversion Readiness Deficit',
    category: 'website',
    severity: 'high',
    baseScoreImpact: H,
    dependencyStage: 6,
    ease: 'moderate',
    industryWeightKey: 'conversion_path_weight',
    condition: ({ business }) => business.website.conversionScore < 70,
    insight:
      'The website is under-prepared to convert local search traffic into calls or leads.',
    recommendation:
      'Improve CTA visibility, contact trust signals, and mobile conversion paths as a priority.',
    businessImpactTemplate:
      'A low conversion score means money spent on visibility is being wasted — traffic is arriving but not turning into enquiries.',
    evidenceExtractor: ({ business }) => ({
      conversionScore: business.website.conversionScore,
      threshold: 70,
    }),
  },
];
