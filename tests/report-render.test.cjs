// Run with: node --test tests/report-render.test.cjs
// Rendering-only regression checks. No API keys, paid audits or dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReportLayout, buildReportDocument, reportLetterheadHtml } = require('../public/report-render.js');
const fixture = '<h1>Example &amp; Co — Business Growth Assessment</h1><hr>' +
  '<h2>Business Archetype</h2><p><strong>Hidden Gem</strong></p><p>Original diagnosis.</p><hr>' +
  '<h2>Market Position</h2><p>Original market position.</p><hr>' +
  '<h2>Local Market Rankings</h2><table><thead><tr><th>Metric</th><th>This Business</th><th>Market Average</th><th>Rank</th></tr></thead><tbody>' +
  '<tr><td>Star Rating</td><td>4.6 / 5</td><td>4.2 / 5</td><td>#1 of 10</td></tr>' +
  '<tr><td>Review Count</td><td>12</td><td>100</td><td>Below all 10 benchmark competitors</td></tr></tbody></table><hr>' +
  '<h2>Confidence Score</h2><p><strong>Data Confidence: Medium</strong></p><p>Limited sample.</p>' +
  '<h2>Scorecard</h2><table><tr><td>Review Strength</td><td>0/10</td><td>6/10</td></tr><tr><td><strong>Overall</strong></td><td><strong>3.5/10</strong></td><td>6/10</td></tr></table>' +
  '<h2>Top Opportunities</h2><h3>First</h3><p>Keep this advice.</p><h3>Second</h3><p>Keep this too.</p>' +
  '<h2>Quick Wins</h2><ul><li>Original action.</li></ul>' +
  '<h2>How To Fix These Issues</h2><h3>Option 1 — Do It Yourself</h3><p>Original DIY.</p><hr><h3>Option 2 — Done For You</h3><p>Original managed option.</p>' +
  '<h2>Unexpected extra section</h2><p>Keep unknown content and <a href="https://example.org/">this link</a>.</p>';
function headings(html) {
  return Array.from(html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g), m => [m[1], m[2].replace(/<[^>]+>/g, '')]);
}
function cells(html) {
  return Array.from(html.matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1>/g), m => m[2].replace(/<[^>]+>/g, ''));
}
test('preserves every heading in its original order', () => {
  assert.deepEqual(headings(buildReportLayout(fixture)), headings(fixture));
});
test('retains all original table cells including corrected rank wording', () => {
  assert.deepEqual(cells(buildReportLayout(fixture)), cells(fixture));
});
test('keeps advice, links and unknown sections rather than dropping content', () => {
  const html = buildReportLayout(fixture);
  for (const text of ['Original diagnosis.', 'Original market position.', 'Keep this advice.', 'Keep this too.', 'Original action.', 'Original DIY.', 'Original managed option.', 'Keep unknown content', 'href="https://example.org/"']) assert.ok(html.includes(text));
});
test('enhancement is idempotent', () => {
  const html = buildReportLayout(fixture);
  assert.equal(buildReportLayout(html), html);
});
test('summary values come from existing tables; absent metrics are not invented', () => {
  const html = buildReportLayout(fixture);
  assert.ok(html.includes('Overall score 3.5 out of 10'));
  assert.ok(html.includes('Data confidence: Medium'));
  assert.ok(!html.includes('Photo Count'));
});
test('missing score data produces no gauge; zero remains a valid score', () => {
  assert.ok(!buildReportLayout('<h1>Example</h1><h2>Notes</h2><p>No scores.</p>').includes('class="report-ring"'));
  assert.ok(buildReportLayout(fixture.replace('<strong>3.5/10</strong>', '<strong>0/10</strong>')).includes('Overall score 0 out of 10'));
});
test('malformed or out-of-range scores are never plotted', () => {
  for (const value of ['N/A', '15/10', '-2/10']) assert.ok(!buildReportLayout(fixture.replace('<strong>3.5/10</strong>', value)).includes('class="report-ring"'));
});
test('blank and legacy reports retain their content', () => {
  assert.ok(buildReportLayout('').includes('report-layout'));
  assert.ok(buildReportLayout('<p>Legacy report</p>').includes('<p>Legacy report</p>'));
});
test('standalone HTML embeds its styling and keeps agency metadata escaped', () => {
  const doc = buildReportDocument('A & B', fixture, { companyName: '<Agency>', logoDataUri: 'data:image/png;base64,AAAA' }, 'A "Consultant"', '2026-09-14T00:00:00Z', '.report-layout{color:#123}');
  assert.ok(doc.includes('&lt;Agency&gt;'));
  assert.ok(doc.includes('A &quot;Consultant&quot;'));
  assert.ok(doc.includes('data:image/png;base64,AAAA'));
  assert.ok(doc.includes('<style>.report-layout{color:#123}</style>'));
  assert.ok(!doc.includes('<script'));
  assert.ok(!doc.includes('<link'));
});
test('branding is optional; no platform branding is injected', () => {
  const meta = reportLetterheadHtml(null, null, '2026-09-14');
  assert.ok(!meta.includes('Prepared by'));
  assert.ok(!meta.includes('NixSec'));
  assert.ok(meta.includes('Report generated:'));
});
