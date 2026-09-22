import { OutscraperRecord } from '../types/outscraper';

// Outscraper's async=false (synchronous) mode holds a concurrency slot open
// for the full scrape duration. It has proven unreliable under load — it can
// hang with no response at all, or return "Too many requests" — even while
// Outscraper's own dashboard keeps working fine. The dashboard (and this
// async=true mode) go through Outscraper's normal job-queue pipeline instead:
// submit the job, then poll the returned results_location until it's done.
export async function outscraperSearch(query: string, limit = 20, maxWaitMs = 120000, coordinates?: string, region = 'AU'): Promise<OutscraperRecord[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY is not set.');

  const submitUrl =
    `https://api.app.outscraper.com/maps/search-v3` +
    `?query=${encodeURIComponent(query)}&limit=${limit}&async=true&language=en` +
    `&region=${encodeURIComponent(region)}` +
    (coordinates ? `&coordinates=${encodeURIComponent(coordinates)}` : '');

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
      data?: OutscraperRecord[][];
      message?: string;
    };

    if (pollBody.status === 'Success') {
      return pollBody.data?.[0] ?? [];
    }
    if (pollBody.status !== 'Pending') {
      throw new Error(pollBody.message || `Outscraper job ended with status "${pollBody.status}".`);
    }
    // else still Pending — keep polling
  }

  throw new Error(`Outscraper job timed out after ${maxWaitMs}ms waiting for results.`);
}


export interface OutscraperReviewRecord {
  review_rating?: number | string;
  review_timestamp?: number | string;
  review_datetime_utc?: string;
  owner_answer?: string;
  owner_answer_timestamp?: number | string;
}

export async function outscraperReviews(query: string, reviewsLimit: number, cutoffUnix?: number, maxWaitMs = 120000): Promise<OutscraperReviewRecord[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error('OUTSCRAPER_API_KEY is not set.');
  const params = new URLSearchParams({
    query,
    reviewsLimit: String(reviewsLimit),
    sort: 'newest',
    async: 'true',
    language: 'en',
  });
  if (cutoffUnix) params.set('cutoff', String(cutoffUnix));
  const submitRes = await fetch('https://api.app.outscraper.com/maps/reviews-v2?' + params.toString(), {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });
  if (!submitRes.ok) throw new Error('Outscraper Reviews ' + submitRes.status + ': ' + (await submitRes.text()).slice(0,200));
  const submitBody = await submitRes.json() as { status:string; results_location?:string; id?:string; request_id?:string; message?:string };
  let pollUrl = submitBody.results_location;
  const requestId = submitBody.id || submitBody.request_id;
  if (!pollUrl && requestId) pollUrl = 'https://api.app.outscraper.com/requests/' + encodeURIComponent(requestId);
  if (!pollUrl) throw new Error(submitBody.message || 'Outscraper Reviews did not return a results location.');
  const deadline=Date.now()+maxWaitMs;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,4000));
    const poll=await fetch(pollUrl,{headers:{'X-API-KEY':apiKey,Accept:'application/json'}});
    if(!poll.ok) continue;
    const body=await poll.json() as any;
    if(body.status==='Success'){
      const place=body.data?.[0]?.[0] ?? body.data?.[0] ?? {};
      return Array.isArray(place.reviews_data) ? place.reviews_data : Array.isArray(place.reviews) ? place.reviews : [];
    }
    if(body.status!=='Pending') throw new Error(body.message || 'Outscraper Reviews job ended with status '+body.status);
  }
  throw new Error('Outscraper Reviews job timed out.');
}
