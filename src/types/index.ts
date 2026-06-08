// Core domain types for the local business visibility audit engine.
// All layers of the pipeline consume and produce these shapes.

export type Industry =
  | 'restaurant'
  | 'law_firm'
  | 'home_services'
  | 'retail'
  | 'medical'
  | 'general';

export type Severity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'strength'
  | 'opportunity';

export type RuleCategory =
  | 'visibility'
  | 'trust'
  | 'competitive'
  | 'website'
  | 'gbp'
  | 'local'
  | 'citation'
  | 'technical'
  | 'measurement';

export type Priority = 'Do Now' | 'Do Next' | 'Schedule' | 'Lower Priority';

export type ArchetypeName =
  | 'Foundation Problem'
  | 'Market Leader'
  | 'Hidden Gem'
  | 'Leaky Bucket'
  | 'Credibility Gap'
  | 'Ready To Scale'
  | 'Unmeasured Performer'
  | 'Underdeveloped Presence';

// Stages sequence work from foundational to competitive:
// 1 = Profile access/verification
// 2 = Core business data accuracy
// 3 = Contact and trust foundations
// 4 = Technical health and tracking
// 5 = Visibility expansion
// 6 = Conversion refinement
// 7 = Competitive leverage
export type DependencyStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Ease = 'easy' | 'moderate' | 'hard';

// ---------------------------------------------------------------------------
// Raw business data shapes
// ---------------------------------------------------------------------------

export interface ReviewData {
  count: number;
  rating: number;
  responseRate: number;          // 0–1
  oneStarRatio: number;          // 0–1
  daysSinceLastReview: number;
  reviewsLast90Days: number;
}

export interface GBPData {
  verified: boolean;
  completenessScore: number;     // 0–100
  categories: string[];
  primaryCategory: string;
  servicesCount: number;
  hoursConfigured: boolean;
  daysSinceLastPost: number;
  attributesCompletionRate: number; // 0–1
  qaCount: number;
  messagingEnabled: boolean;
  productsCount: number;
  isRetail: boolean;
  photoCount: number;
  daysSinceLastPhoto: number;
  descriptionLength: number;
  reviews: ReviewData;
}

export interface WebsiteData {
  domain: string;
  ssl: boolean;
  mobileFriendly: boolean;
  mobileSpeedScore: number;            // 0–100
  contactPageMissing: boolean;
  servicePageCount: number;
  serviceAreasCount: number;
  locationPageCount: number;
  napInFooter: boolean;
  embeddedMapPresent: boolean;
  pricingInfoPresent: boolean;
  quoteProcessExplained: boolean;
  homepageValuePropLength: number;     // character count
  testimonialsPresent: boolean;
  reviewWidgetPresent: boolean;
  realTeamOrWorkPhotos: boolean;
  trustSignalsNearForm: boolean;
  phone: string;
  phoneClickable: boolean;
  formPresent: boolean;
  addressVisible: boolean;
  abnOrAcnVisible: boolean;           // Australian business number
  conversionScore: number;            // 0–100, pre-computed composite
  importantPagesWithoutCtaRatio: number; // 0–1
  localizedServicePagesCount: number;
  topPagesWithLocationTermsRatio: number; // 0–1
  daysSinceLastContentUpdate: number;
  faqSectionPresent: boolean;
  authorBioOrExperienceSignals: boolean;
  avgInternalLinksToServicePages: number;
  localBusinessSchemaPresent: boolean;
  serviceSchemaCount: number;
  locationPagesExist: boolean;
  localLandmarksOrAreaReferencesRatio: number; // 0–1
  avgServicePageWordCount: number;
  lcp: number;                        // seconds (Core Web Vital)
  inp: number;                        // milliseconds (Core Web Vital)
  cls: number;                        // score (Core Web Vital)
  indexedPagesRatio: number;          // 0–1
  brokenInternalLinksCount: number;
  redirectChainsCount: number;
  robotsBlocksKeyPages: boolean;
  sitemapMissing: boolean;
  pagesWithMissingTitleOrMetaRatio: number; // 0–1
  accessibilityScore: number;         // 0–100
}

export interface CitationData {
  napConsistencyScore: number;        // 0–1
  citationCount: number;
  missingPriorityDirectoriesCount: number;
  duplicateListingCount: number;
  phone: string;
  address: string;
  name: string;
}

export interface MeasurementData {
  ga4Installed: boolean;
  gscVerified: boolean;
  leadEventsTracked: boolean;
  baselineRecorded: boolean;
  localKeywordTrackingEnabled: boolean;
  phoneCallsTracked: boolean;
  gbpInsightsAvailable: boolean;
  sourceMediumToLeadMapping: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  industry: Industry;
  country: string;
  gbp: GBPData;
  website: WebsiteData;
  citations: CitationData;
  measurement: MeasurementData;
}

// percentile fields represent the business's rank within the competitor sample (0–100)
export interface CompetitorData {
  avgReviews: number;
  avgRating: number;
  avgPhotoCount: number;
  avgCategories: number;
  avgServicesCount: number;
  avgCitationCount: number;
  avgReviews90d: number;
  avgOneStarRatio: number;
  topPrimaryCategories: string[];
  avgVisibilityScore: number;
  avgConversionScore: number;
  avgTrustScore: number;
  avgRatingScore: number;
  avgServicePageWordCount: number;
  sampleSize: number;
  dataAgeDays: number;
  prominenceScorePercentile: number;  // business's percentile vs competitors
  reviewPercentile: number;           // business's review count percentile
  ratingPercentile: number;           // business's rating percentile
}

export interface AuditInput {
  business: BusinessProfile;
  competitors: CompetitorData;
}

// ---------------------------------------------------------------------------
// Rule system
// ---------------------------------------------------------------------------

export interface Rule {
  id: string;
  name: string;
  category: RuleCategory;
  severity: Severity;
  baseScoreImpact: number;
  dependencyStage: DependencyStage;
  ease: Ease;
  industryWeightKey?: string;
  condition: (input: AuditInput) => boolean;
  insight: string;
  recommendation: string;
  businessImpactTemplate: string;
  evidenceExtractor: (input: AuditInput) => Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Engine outputs
// ---------------------------------------------------------------------------

export interface Finding {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  severity: Severity;
  baseScoreImpact: number;
  adjustedScoreImpact: number;
  dependencyStage: DependencyStage;
  ease: Ease;
  industryWeightKey?: string;
  insight: string;
  recommendation: string;
  businessImpact: string;
  priority?: Priority;
  priorityScore?: number;
  evidence: Record<string, unknown>;
  suppressed: boolean;
  suppressedBy?: string;
}

export interface Scores {
  overall: number;
  visibility: number;
  trust: number;
  conversion: number;
  technical: number;
  gbp: number;
  entity: number;
  content: number;
  marketPosition: number;
  measurementReadiness: number;
  confidence: number;
}

export interface ArchetypeResult {
  name: ArchetypeName;
  summary: string;
  whyItMatters: string;
  primaryFocus: string;
}

export interface ExecutiveSummary {
  archetypeSentence: string;
  marketPositionSummary: string;
  primaryConstraint: string;
  primaryStrength: string;
  topPriorityAction: string;
  expectedOutcome: string;
}

export interface ActionPlanItem {
  ruleId: string;
  ruleName: string;
  recommendation: string;
  businessImpact: string;
  priority: Priority;
  priorityScore: number;
  dependencyStage: DependencyStage;
  severity: Severity;
}

export interface AuditReport {
  businessId: string;
  businessName: string;
  industry: Industry;
  generatedAt: string;
  scores: Scores;
  archetype: ArchetypeResult;
  topRisks: Finding[];
  topOpportunities: Finding[];
  topStrengths: Finding[];
  quickWins: Finding[];
  allFindings: Finding[];
  executiveSummary: ExecutiveSummary;
  actionPlan: ActionPlanItem[];
  confidenceStatement: string;
}
