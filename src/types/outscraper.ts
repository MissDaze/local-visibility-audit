// Matches the column layout of a standard Outscraper Google Maps export.
// Not all columns are present in every export plan — optional fields handle that.
export interface OutscraperRecord {
  // Core identity
  name: string;
  full_address?: string;
  city?: string;
  state?: string;
  country_code?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;

  // Contact
  phone?: string;
  site?: string;          // website URL

  // Category
  type?: string;          // primary category
  subtypes?: string;      // comma-separated additional categories

  // Reputation
  rating?: number | string;
  reviews?: number | string;           // total review count
  reviews_per_score_1?: number | string;
  reviews_per_score_2?: number | string;
  reviews_per_score_3?: number | string;
  reviews_per_score_4?: number | string;
  reviews_per_score_5?: number | string;

  // Content signals
  photos_count?: number | string;
  description?: string;
  working_hours?: string;             // JSON string or human-readable

  // Activity signals
  booking_appointment_link?: string;
  menu_link?: string;
  business_status?: string;           // OPERATIONAL | CLOSED_PERMANENTLY | CLOSED_TEMPORARILY

  // Additional
  range?: string;                     // price range
  about?: string;                     // additional attributes JSON
  posts?: number | string;            // recent Google posts count
  owner_id?: string;
  verified?: boolean | string;
}

// A cleaned, normalised version of a single Outscraper record after parsing
export interface NormalizedCompetitorRecord {
  name: string;
  rating: number;
  reviewCount: number;
  photoCount: number;
  primaryCategory: string;
  allCategories: string[];
  hasWebsite: boolean;
  hasHours: boolean;
  hasDescription: boolean;
  isOperational: boolean;
  oneStarCount: number;
  fiveStarCount: number;
  oneStarRatio: number;
}
