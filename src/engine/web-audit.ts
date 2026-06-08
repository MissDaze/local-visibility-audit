/**
 * Website discovery and content audit engine.
 *
 * For the subject business:
 *   1. Use Outscraper site field if present
 *   2. Otherwise search DuckDuckGo to find the URL
 *   3. Fetch the homepage and run a full content audit
 *
 * For competitors:
 *   1. Use Outscraper site / booking / menu links
 *   2. Fetch homepage and run a lightweight content check
 *   3. Run the top-10 competitors in parallel (capped to keep latency reasonable)
 */

import { OutscraperRecord } from '../types/outscraper';
import { resolveUrl } from './relevance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubjectWebsiteAudit {
  url: string;
  reachable: boolean;
  ssl: boolean;
  loadTimeMs: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  topHeadings: string[];
  hasPhone: boolean;
  hasEmail: boolean;
  hasBooking: boolean;
  hasOnlineOrdering: boolean;
  hasMenu: boolean;
  hasPricingOrRates: boolean;
  hasTestimonials: boolean;
  hasContactPage: boolean;
  hasMobileViewport: boolean;
  detectedCTAs: string[];
  qualityScore: number;
  qualityNotes: string[];
  error: string | null;
}

export interface CompetitorWebsiteCheck {
  name: string;
  url: string | null;
  reachable: boolean;
  ssl: boolean | null;
  title: string | null;
  hasBooking: boolean;
  hasOnlineOrdering: boolean;
  hasMenu: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url: string, timeoutMs = 7000): Promise<{ html: string; loadTimeMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return { html, loadTimeMs: Date.now() - start };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// DuckDuckGo search — finds a website URL for a business when Outscraper
// doesn't return one. Parses the uddg= parameter from DDG HTML results.
// ---------------------------------------------------------------------------

export async function searchForWebsite(
  businessName: string,
  city: string,
): Promise<string | null> {
  const query = `"${businessName}" "${city}" website`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const { html } = await fetchHtml(searchUrl, 5000);

    // DuckDuckGo embeds destination URLs as uddg= parameters
    const matches = [...html.matchAll(/uddg=(https?[^&"'\s]+)/g)];
    for (const m of matches) {
      const candidate = decodeURIComponent(m[1]);
      // Skip social media, map sites, review aggregators
      if (/facebook\.com|google\.com\/maps|yelp\.com|tripadvisor\.com|yellowpages|white-?pages|instagram|twitter|linkedin|duckduckgo\.com/i.test(candidate)) {
        continue;
      }
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML content parsers (regex-based, no external deps)
// ---------------------------------------------------------------------------

function extractTag(html: string, tag: string): string | null {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]{1,300}?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : null;
}

function extractMeta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    // name= or property= attribute before or after content=
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']{1,300})["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']{1,300})["'][^>]+(?:name|property)=["']${name}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return m[1].trim();
    }
  }
  return null;
}

function extractH2s(html: string): string[] {
  return [...html.matchAll(/<h2[^>]*>([\s\S]{1,150}?)<\/h2>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

function hasKeyword(html: string, ...terms: string[]): boolean {
  const lower = html.toLowerCase();
  return terms.some(t => lower.includes(t));
}

function hasPattern(html: string, re: RegExp): boolean {
  return re.test(html);
}

function detectCTAs(html: string): string[] {
  const ctaKeywords = ['book now', 'book online', 'reserve', 'get a quote', 'request a quote',
    'order online', 'order now', 'call us', 'contact us', 'get started', 'free quote',
    'schedule', 'appointment', 'buy now', 'shop now', 'enquire', 'get in touch'];
  const lower = html.toLowerCase();
  return ctaKeywords.filter(k => lower.includes(k));
}

function computeQualityScore(audit: Omit<SubjectWebsiteAudit, 'qualityScore' | 'qualityNotes'>): {
  score: number;
  notes: string[];
} {
  let score = 0;
  const notes: string[] = [];

  if (audit.ssl) { score += 10; } else { notes.push('No HTTPS detected'); }
  if (audit.hasMobileViewport) { score += 10; } else { notes.push('No mobile viewport meta tag'); }
  if (audit.title && audit.title.length > 10) { score += 10; } else { notes.push('Missing or weak page title'); }
  if (audit.metaDescription && audit.metaDescription.length > 30) { score += 10; } else { notes.push('Missing meta description'); }
  if (audit.h1) { score += 5; } else { notes.push('No H1 heading found'); }
  if (audit.hasPhone) { score += 15; } else { notes.push('No phone number detected on homepage'); }
  if (audit.hasContactPage) { score += 10; } else { notes.push('No contact page detected'); }
  if (audit.hasBooking) { score += 15; } else { notes.push('No booking or appointment system detected'); }
  if (audit.hasMenu || audit.hasPricingOrRates) { score += 10; } else { notes.push('No menu, services list, or pricing found'); }
  if (audit.hasTestimonials) { score += 5; } else { notes.push('No testimonials or social proof found'); }
  if (audit.detectedCTAs.length > 0) { score += 5; }
  if (audit.reachable && audit.loadTimeMs !== null && audit.loadTimeMs < 3000) { score += 5; }

  return { score: Math.min(100, score), notes };
}

// ---------------------------------------------------------------------------
// Full subject website audit
// ---------------------------------------------------------------------------

export async function auditSubjectWebsite(
  url: string,
): Promise<SubjectWebsiteAudit> {
  const ssl = url.startsWith('https://');

  try {
    const { html, loadTimeMs } = await fetchHtml(url);
    const lower = html.toLowerCase();

    const title = extractTag(html, 'title');
    const metaDescription = extractMeta(html, 'description', 'og:description', 'twitter:description');
    const h1 = extractTag(html, 'h1');
    const topHeadings = extractH2s(html);

    const hasPhone = hasPattern(html, /\(?\+?[0-9]{2,4}\)?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}/);
    const hasEmail = hasPattern(html, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const hasBooking = hasKeyword(lower, 'book now', 'book online', 'book an appointment',
      'schedule', 'reserve a table', 'make a booking', 'request appointment',
      'book a table', 'online booking', 'calendly', 'appointy', 'acuity');
    const hasOnlineOrdering = hasKeyword(lower, 'order online', 'order now', 'add to cart',
      'checkout', 'uber eats', 'doordash', 'menulog', 'deliveroo', 'seamless');
    const hasMenu = hasKeyword(lower, 'our menu', 'view menu', 'see menu', 'full menu',
      'our services', 'what we offer', 'service list', 'our rates', 'packages');
    const hasPricingOrRates = hasKeyword(lower, 'price', 'pricing', 'rate', 'cost', 'fee',
      'per hour', 'from $', 'starting at', 'quote');
    const hasTestimonials = hasKeyword(lower, 'testimonial', 'what our customer', 'review',
      'client said', 'customer feedback', 'google review');
    const hasContactPage = hasKeyword(lower, 'contact us', 'get in touch', 'contact page',
      'href="/contact"', "href='/contact'", 'href="#contact"');
    const hasMobileViewport = hasKeyword(lower, 'name="viewport"', "name='viewport'");
    const detectedCTAs = detectCTAs(html);

    const partial = {
      url, reachable: true, ssl, loadTimeMs,
      title, metaDescription, h1, topHeadings,
      hasPhone, hasEmail, hasBooking, hasOnlineOrdering,
      hasMenu, hasPricingOrRates, hasTestimonials,
      hasContactPage, hasMobileViewport, detectedCTAs, error: null,
    };

    const { score, notes } = computeQualityScore(partial);
    return { ...partial, qualityScore: score, qualityNotes: notes };

  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    const partial = {
      url, reachable: false, ssl, loadTimeMs: null,
      title: null, metaDescription: null, h1: null, topHeadings: [],
      hasPhone: false, hasEmail: false, hasBooking: false, hasOnlineOrdering: false,
      hasMenu: false, hasPricingOrRates: false, hasTestimonials: false,
      hasContactPage: false, hasMobileViewport: false, detectedCTAs: [], error,
    };
    const { score, notes } = computeQualityScore(partial);
    return { ...partial, qualityScore: score, qualityNotes: notes };
  }
}

// ---------------------------------------------------------------------------
// Lightweight competitor website check
// ---------------------------------------------------------------------------

async function checkCompetitorWebsite(
  name: string,
  url: string,
): Promise<CompetitorWebsiteCheck> {
  const ssl = url.startsWith('https://');
  try {
    const { html } = await fetchHtml(url, 5000);
    const lower = html.toLowerCase();
    return {
      name, url, reachable: true, ssl,
      title: extractTag(html, 'title'),
      hasBooking: hasKeyword(lower, 'book', 'appointment', 'reserve', 'schedule', 'calendly', 'acuity'),
      hasOnlineOrdering: hasKeyword(lower, 'order online', 'add to cart', 'uber eats', 'menulog', 'deliveroo'),
      hasMenu: hasKeyword(lower, 'menu', 'services', 'what we offer'),
      error: null,
    };
  } catch (e: unknown) {
    return {
      name, url, reachable: false, ssl, title: null,
      hasBooking: false, hasOnlineOrdering: false, hasMenu: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Public: audit all relevant competitor websites in parallel
// Caps at 10 to limit total latency. Returns results for those audited.
// ---------------------------------------------------------------------------

export async function auditCompetitorWebsites(
  competitors: Array<{ record: OutscraperRecord; relevanceScore: number }>,
): Promise<CompetitorWebsiteCheck[]> {
  // Sort by relevance, take top 10 that have a detected URL
  const candidates = competitors
    .filter(c => resolveUrl(c.record) !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);

  const results = await Promise.allSettled(
    candidates.map(c =>
      checkCompetitorWebsite(c.record.name, resolveUrl(c.record)!),
    ),
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          name: candidates[i].record.name,
          url: resolveUrl(candidates[i].record),
          reachable: false,
          ssl: null,
          title: null,
          hasBooking: false,
          hasOnlineOrdering: false,
          hasMenu: false,
          error: r.reason instanceof Error ? r.reason.message : 'fetch failed',
        },
  );
}
