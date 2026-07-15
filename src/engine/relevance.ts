import { OutscraperRecord } from '../types/outscraper';

export interface ScoredCompetitor {
  record: OutscraperRecord;
  relevanceScore: number;
  included: boolean;
  exclusionReason: string | null;
  hasValidWebsite: boolean;
  categoryMatch: string;
  typeGroup: string | null;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'in', 'at', 'for', 'with', 'by',
  'to', 'on', 'is', 'its', 'near', 'local',
]);

function normalise(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenise(s: string): Set<string> {
  return new Set(
    normalise(s)
      .split(' ')
      .filter(w => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function getAllCategoryText(r: OutscraperRecord): string {
  return [r.type, r.subtypes].filter(Boolean).join(' ');
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

// ---------------------------------------------------------------------------
// Business type groups
// ---------------------------------------------------------------------------

const TYPE_GROUPS: { name: string; terms: string[] }[] = [
  {
    name: 'food_restaurant',
    terms: [
      'restaurant', 'pizzeria', 'pizza', 'diner', 'bistro', 'eatery', 'grill',
      'steakhouse', 'burger', 'sushi', 'noodle', 'taco', 'kebab', 'seafood',
      'vietnamese', 'thai', 'chinese', 'indian', 'mexican', 'italian', 'greek',
      'japanese', 'korean', 'turkish', 'lebanese', 'mediterranean', 'french',
      'american', 'cuisine', 'kitchen', 'brasserie', 'trattoria', 'osteria',
      'cantina', 'deli', 'takeaway', 'takeout', 'food court', 'fish',
    ],
  },
  {
    name: 'cafe',
    terms: [
      'cafe', 'coffee', 'coffeehouse', 'espresso', 'tea', 'brunch',
      'cafeteria', 'tearoom', 'kiosk',
    ],
  },
  {
    name: 'bakery_dessert',
    terms: [
      'bakery', 'pastry', 'patisserie', 'cake', 'dessert', 'donut',
      'doughnut', 'bread', 'sweet', 'confectionery', 'gelato', 'ice cream',
      'candy', 'chocolate',
    ],
  },
  {
    name: 'bar_nightlife',
    terms: [
      'bar', 'pub', 'tavern', 'lounge', 'nightclub', 'brewery', 'brewpub',
      'winery', 'cocktail', 'wine', 'spirits', 'taproom', 'saloon',
      'speakeasy', 'club',
    ],
  },
  {
    name: 'retail',
    terms: [
      'shop', 'store', 'boutique', 'clothing', 'apparel', 'fashion',
      'jewellery', 'jewelry', 'electronics', 'hardware', 'supermarket',
      'grocery', 'market', 'gift', 'toy', 'book', 'sport', 'outdoor',
    ],
  },
  {
    name: 'health_medical',
    terms: [
      'dentist', 'doctor', 'medical', 'clinic', 'pharmacy', 'physio',
      'physiotherapist', 'chiro', 'chiropractor', 'optom', 'optometrist',
      'health', 'hospital', 'specialist', 'gp', 'allied',
    ],
  },
  {
    name: 'beauty',
    terms: [
      'salon', 'barber', 'hair', 'nail', 'spa', 'beauty', 'skin',
      'wax', 'lash', 'brow', 'massage', 'tanning', 'makeup', 'aesthetics',
    ],
  },
  {
    name: 'auto',
    terms: [
      'mechanic', 'auto', 'automotive', 'car', 'vehicle', 'tyre', 'tire',
      'panel', 'smash', 'motor', 'garage', 'service center', 'detailing',
    ],
  },
  {
    name: 'fitness',
    terms: [
      'gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'personal trainer',
      'bootcamp', 'swim', 'swimming', 'martial arts', 'boxing', 'dance',
    ],
  },
  {
    name: 'accommodation',
    terms: [
      'hotel', 'motel', 'hostel', 'resort', 'bed and breakfast',
      'lodge', 'accommodation', 'inn', 'guesthouse', 'serviced apartments',
    ],
  },
  {
    name: 'professional',
    terms: [
      'lawyer', 'solicitor', 'accountant', 'financial', 'advisor',
      'consultant', 'agent', 'broker', 'insurance', 'real estate',
      'mortgage', 'law firm', 'legal',
    ],
  },
  {
    name: 'trades',
    terms: [
      'plumber', 'plumbing', 'electrician', 'electrical', 'builder',
      'building', 'carpenter', 'painter', 'landscap', 'gardener',
      'pest', 'cleaner', 'cleaning', 'handyman', 'roofing', 'air conditioning',
      'hvac', 'locksmith',
    ],
  },
];

// Groups that may partially compete (lower score, not zero)
const ADJACENT_GROUPS: Record<string, string[]> = {
  food_restaurant: ['cafe', 'bakery_dessert'],
  cafe: ['food_restaurant', 'bakery_dessert'],
  bakery_dessert: ['cafe', 'food_restaurant'],
  health_medical: ['beauty', 'fitness'],
  beauty: ['health_medical', 'fitness'],
  fitness: ['health_medical', 'beauty'],
};

function classifyGroup(tokens: Set<string>): string | null {
  let bestGroup: string | null = null;
  let bestScore = 0;

  for (const group of TYPE_GROUPS) {
    let matchScore = 0;
    for (const term of group.terms) {
      const termTokens = term.split(' ');
      // Check if any token in the business matches this term
      for (const token of tokens) {
        if (termTokens.some(t => token.includes(t) || t.includes(token))) {
          matchScore++;
        }
      }
    }
    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestGroup = group.name;
    }
  }

  return bestScore > 0 ? bestGroup : null;
}

// ---------------------------------------------------------------------------
// Core relevance scorer
// ---------------------------------------------------------------------------

function scoreRelevance(
  subject: OutscraperRecord,
  competitor: OutscraperRecord,
): { score: number; categoryMatch: string; typeGroup: string | null } {
  const subjectCatText = getAllCategoryText(subject);
  const competitorCatText = getAllCategoryText(competitor);

  const subjectCatTokens = tokenise(subjectCatText);
  const competitorCatTokens = tokenise(competitorCatText);
  const subjectNameTokens = tokenise(subject.name || '');
  const competitorNameTokens = tokenise(competitor.name || '');

  // --- 1. Category similarity (50%) ---
  const catJaccard = jaccardSimilarity(subjectCatTokens, competitorCatTokens);
  const catScore = catJaccard * 100;

  // Determine category match label
  let categoryMatch: string;
  if (catJaccard >= 0.8) categoryMatch = 'Exact match';
  else if (catJaccard >= 0.5) categoryMatch = 'Strong match';
  else if (catJaccard >= 0.2) categoryMatch = 'Partial match';
  else if (catJaccard > 0) categoryMatch = 'Weak match';
  else categoryMatch = 'No category overlap';

  // --- 2. Business type group similarity (25%) ---
  const subjectGroup = classifyGroup(new Set([...subjectCatTokens, ...subjectNameTokens]));
  const competitorGroup = classifyGroup(new Set([...competitorCatTokens, ...competitorNameTokens]));

  let typeScore: number;
  if (!subjectGroup || !competitorGroup) {
    typeScore = 50; // can't classify → neutral
  } else if (subjectGroup === competitorGroup) {
    typeScore = 100;
    if (categoryMatch === 'No category overlap') categoryMatch = 'Same industry group';
  } else if (ADJACENT_GROUPS[subjectGroup]?.includes(competitorGroup)) {
    typeScore = 35;
    if (categoryMatch === 'No category overlap') categoryMatch = 'Adjacent industry';
  } else {
    typeScore = 0;
    categoryMatch = `Incompatible (${competitorGroup} vs ${subjectGroup})`;
  }

  // --- 3. Keyword similarity — combined name + category (15%) ---
  const subjectAll = new Set([...subjectCatTokens, ...subjectNameTokens]);
  const competitorAll = new Set([...competitorCatTokens, ...competitorNameTokens]);
  const keywordScore = jaccardSimilarity(subjectAll, competitorAll) * 100;

  // --- 4. Distance (10%) — Outscraper already filters by area, use fixed 75 ---
  const distanceScore = 75;

  const finalScore = Math.round(
    catScore * 0.50 +
    typeScore * 0.25 +
    keywordScore * 0.15 +
    distanceScore * 0.10,
  );

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    categoryMatch,
    typeGroup: competitorGroup,
  };
}

// ---------------------------------------------------------------------------
// Website detection — checks site, booking link, and menu link fields.
// Outscraper often leaves site= empty even when a website exists; we check
// every URL-bearing field so we don't falsely conclude "no website".
// ---------------------------------------------------------------------------

function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  if (t.length < 5) return false;
  return /^https?:\/\/.{3,}/i.test(t) ||
    /^www\..{3,}/i.test(t) ||
    /^[a-z0-9][a-z0-9-]*\.[a-z]{2,}/i.test(t);
}

export function isValidWebsite(r: OutscraperRecord): boolean {
  return (
    looksLikeUrl(r.site || '') ||
    looksLikeUrl(r.booking_appointment_link || '') ||
    looksLikeUrl(r.menu_link || '')
  );
}

// ---------------------------------------------------------------------------
// Resolve the best available URL from an Outscraper record (shared helper)
// ---------------------------------------------------------------------------

export function resolveUrl(r: OutscraperRecord): string | null {
  const candidates = [r.site, r.booking_appointment_link, r.menu_link];
  for (const c of candidates) {
    const s = (c || '').trim();
    if (s.length > 5) return s.startsWith('http') ? s : `https://${s}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public: score and filter the full competitor candidate list
// ---------------------------------------------------------------------------

export function scoreAndFilterCompetitors(
  subject: OutscraperRecord,
  candidates: OutscraperRecord[],
  threshold = 45,
): ScoredCompetitor[] {
  return candidates.map(c => {
    const { score, categoryMatch, typeGroup } = scoreRelevance(subject, c);
    const hasValidWebsite = isValidWebsite(c);

    let exclusionReason: string | null = null;

    if (score < threshold) {
      exclusionReason = `Relevance score ${score} below threshold ${threshold}`;
    } else if (c.business_status === 'CLOSED_PERMANENTLY') {
      exclusionReason = 'Permanently closed';
    } else if (!c.name?.trim()) {
      exclusionReason = 'Missing business name';
    }

    return {
      record: c,
      relevanceScore: score,
      included: exclusionReason === null,
      exclusionReason,
      hasValidWebsite,
      categoryMatch,
      typeGroup,
    };
  });
}
