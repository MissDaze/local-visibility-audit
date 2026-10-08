import { OutscraperRecord } from '../types/outscraper';


/**
 * Maps v3 returns address/website; older exports used full_address/site.
 * Normalize at the provider boundary so subject validation, competitor
 * filtering and report generation all consume the same field names.
 */
function normalizeMapsRecord(record: OutscraperRecord): OutscraperRecord {
  const raw = record as OutscraperRecord & {
    address?: string;
    website?: string;
    category?: string;
    reviews_per_score?: Record<string, number | string>;
  };
  const text = (...values: unknown[]): string | undefined => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };
  return {
    ...record,
    full_address: text(record.full_address, raw.address),
    site: text(record.site, raw.website),
    type: text(record.type, raw.category),
    reviews_per_score_1: record.reviews_per_score_1 ?? raw.reviews_per_score?.['1'],
    reviews_per_score_2: record.reviews_per_score_2 ?? raw.reviews_per_score?.['2'],
    reviews_per_score_3: record.reviews_per_score_3 ?? raw.reviews_per_score?.['3'],
    reviews_per_score_4: record.reviews_per_score_4 ?? raw.reviews_per_score?.['4'],
    reviews_per_score_5: record.reviews_per_score_5 ?? raw.reviews_per_score?.['5'],
  };
}

// Outscraper's async=false (synchronous) mode holds a concurrency slot open
// for the full scrape duration. It has proven unreliable under load — it can
// hang with no response at all, or return "Too many requests" — even while
// Outscraper's own dashboard keeps working fine. The dashboard (and this
// async=true mode) go through Outscraper's normal job-queue pipeline instead:
// submit the job, then poll the returned results_location until it's done.
export async function outscraperSearch(query: string, limit = 20, maxWaitMs = 120000, location?: { coordinates: string; region: string }): Promise<OutscraperRecord[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY is not set.');

  // Maps URLs are a documented coordinate-query format for Maps scraping.
  // Include one as well as the location parameters, so v3 cannot interpret
  // a coordinate string as ordinary business-name search text.
  const searchQuery = location
    ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/${location.coordinates}`
    : query;
  const submitUrl =
    `https://api.app.outscraper.com/maps/search-v3` +
    `?query=${encodeURIComponent(searchQuery)}&limit=${limit}&async=true&language=en` +
    (location ? `&coordinates=${encodeURIComponent(location.coordinates)}&region=${encodeURIComponent(location.region)}` : "");

  console.log(`[outscraper] fetch → ${submitUrl}`);
  const submitRes = await fetch(submitUrl, {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });
  console.log(`[outscraper] submit response status: ${submitRes.status}`);

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`Outscraper ${submitRes.status}: ${text.slice(0, 200)}`);
  }

  const submitBody = await submitRes.json() as {
    status: string;
    results_location?: string;
    message?: string;
  };
  console.log(`[outscraper] submit body:`, JSON.stringify(submitBody).slice(0, 300));

  if (!submitBody.results_location) {
    throw new Error(submitBody.message || 'Outscraper did not return a results_location.');
  }

  const pollIntervalMs = 4000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const pollRes = await fetch(submitBody.results_location, {
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    });

    if (!pollRes.ok) continue; // transient — keep polling until the deadline

    const pollBody = await pollRes.json() as {
      status: string;
      data?: OutscraperRecord[][] | OutscraperRecord[];
      message?: string;
    };

    if (pollBody.status === 'Success') {
      const data = pollBody.data ?? [];
      const records = (Array.isArray(data[0]) ? data[0] : data) as OutscraperRecord[];
      return records.map(normalizeMapsRecord);
    }
    if (pollBody.status !== 'Pending') {
      throw new Error(pollBody.message || `Outscraper job ended with status "${pollBody.status}".`);
    }
    // else still Pending — keep polling
  }

  throw new Error(`Outscraper job timed out after ${maxWaitMs}ms waiting for results.`);
}
