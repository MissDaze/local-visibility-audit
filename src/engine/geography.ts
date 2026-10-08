import { OutscraperRecord } from '../types/outscraper';

export const LOCAL_RADIUS_KM = 15;
export const MIN_LOCAL_COMPETITORS = 3;

function words(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function countryCode(record: OutscraperRecord): string | null {
  const code = record.country_code?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? (code === 'UK' ? 'GB' : code) : null;
}

export function coordinates(record: OutscraperRecord): { lat: number; lng: number } | null {
  if (record.latitude === undefined || record.latitude === null || String(record.latitude).trim() === '' ||
      record.longitude === undefined || record.longitude === null || String(record.longitude).trim() === '') return null;
  const lat = Number(record.latitude), lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
      (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function distanceKm(a: OutscraperRecord, b: OutscraperRecord): number | null {
  const start = coordinates(a), end = coordinates(b);
  if (!start || !end) return null;
  const radians = (n: number) => n * Math.PI / 180;
  const dLat = radians(end.lat - start.lat), dLng = radians(end.lng - start.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(start.lat)) * Math.cos(radians(end.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function geographyExclusion(subject: OutscraperRecord, candidate: OutscraperRecord): string | null {
  const subjectCountry = countryCode(subject), candidateCountry = countryCode(candidate);
  if (!subjectCountry || !candidateCountry) return 'Country could not be verified';
  if (subjectCountry !== candidateCountry) return `Different country (${candidateCountry}; subject ${subjectCountry})`;
  const distance = distanceKm(subject, candidate);
  if (distance === null) return 'Valid coordinates unavailable; distance could not be verified';
  if (distance > LOCAL_RADIUS_KM) return `Outside local radius (${distance.toFixed(1)} km; maximum ${LOCAL_RADIUS_KM} km)`;
  if (!candidate.full_address?.trim()) return 'Business address unavailable';
  return null;
}

export function samePlace(a: OutscraperRecord, b: OutscraperRecord): boolean {
  if (a.place_id && b.place_id && a.place_id === b.place_id) return true;
  if (a.google_id && b.google_id && a.google_id === b.google_id) return true;
  const distance = distanceKm(a, b);
  return words(a.name || '') === words(b.name || '') && distance !== null && distance < 0.05;
}

export function uniquePlaces(records: OutscraperRecord[]): OutscraperRecord[] {
  return records.filter((r, i) => !records.slice(0, i).some(previous => samePlace(previous, r)));
}

function locationWords(value: string, country?: string | null): string[] {
  const aliases: Record<string, string> = {
    au: 'australia', aus: 'australia',
    ...(country === 'AU' ? { vic: 'victoria', nsw: 'new south wales', qld: 'queensland',
      sa: 'south australia', wa: 'western australia', tas: 'tasmania', nt: 'northern territory',
      act: 'australian capital territory' } : {}),
    us: 'united states', usa: 'united states', uk: 'united kingdom', gb: 'united kingdom',
    nz: 'new zealand',
  };
  return words(value).split(' ').flatMap(token => (aliases[token] || token).split(' ')).filter(Boolean);
}

// Accept ordinary possessive/plural variants and one small spelling error.
// Identity matching is separate from the mandatory country/address checks.
function nameTokens(value: string): string[] {
  return words(value).split(' ').filter(Boolean).map(token =>
    token.length > 3 && token.endsWith('s') && !/(ss|us|is)$/.test(token)
      ? token.slice(0, -1) : token);
}

function oneEditApart(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function businessNameScore(requested: string, candidate: string): number {
  const input = nameTokens(requested), listed = nameTokens(candidate);
  if (!input.length || !listed.length) return 0;
  if (input.join('') === listed.join('')) return 100;
  // Spacing differences (e.g. Fishbar / Fish Bar) are harmless.
  if (input.length > 1 && listed.join('').includes(input.join(''))) return 95;
  const remaining = [...listed];
  const unmatched: string[] = [];
  for (const token of input) {
    const index = remaining.indexOf(token);
    if (index === -1) unmatched.push(token);
    else remaining.splice(index, 1);
  }
  if (!unmatched.length) return 90;
  // Never fuzzy-match several words, or select solely on a short typo.
  if (unmatched.length !== 1 || (input.length === 1 && input[0].length < 6)) return 0;
  return remaining.some(token => oneEditApart(unmatched[0], token)) ? 70 : 0;
}

export function selectSubject(records: OutscraperRecord[], businessName: string, requestedLocation: string): OutscraperRecord {
  const matches = uniquePlaces(records).filter(record => {
    if (!record.name || !record.full_address || !coordinates(record) || !countryCode(record)) return false;
    const requestedWords = locationWords(requestedLocation, countryCode(record));
    const address = new Set(locationWords([record.full_address, record.city, record.state,
      record.postal_code, record.country, countryCode(record)].filter(Boolean).join(' '), countryCode(record)));
    const nameMatches = businessNameScore(businessName, record.name) > 0;
    return nameMatches && requestedWords.length > 0 && requestedWords.every(token => address.has(token));
  });
  const bestScore = Math.max(0, ...matches.map(record => businessNameScore(businessName, record.name)));
  const candidates = matches.filter(record => businessNameScore(businessName, record.name) === bestScore);
  if (candidates.length !== 1) {
    throw new Error(candidates.length
      ? 'More than one matching business was found. Enter the exact business name, suburb, state and country so the correct location can be verified.'
      : 'Could not verify this business at the requested location. Enter its Google Maps listing name, suburb, state and country. No benchmark report has been generated.');
  }
  if (/closed/i.test(candidates[0].business_status || '')) throw new Error('The selected business is marked closed. Please check its Google Maps listing before generating an assessment.');
  return candidates[0];
}
