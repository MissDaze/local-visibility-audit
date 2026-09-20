// Shared between index.html (live streaming report) and report.html (viewing
// a saved report) — rendering the debug panel, post-render DOM enhancement
// of the markdown output, and building the branded standalone HTML download.

function renderDebugPanel(data) {
  const b = data.benchmarks;
  const panel = document.getElementById('debug-panel');
  panel.classList.add('visible');

  document.getElementById('debug-summary').innerHTML = [
    { label: 'Candidates fetched', value: b.totalCandidates },
    { label: 'Relevant included', value: b.included, green: true },
    { label: 'Excluded (unrelated)', value: b.excluded, red: b.excluded > 0 },
    { label: 'With websites', value: b.websiteSummary.match(/With websites: (\d+)/)?.[1] ?? '?' },
    { label: 'Avg rating', value: b.avgRating !== null ? b.avgRating + '★' : 'N/A' },
    { label: 'Avg reviews', value: b.avgReviews ?? 'N/A' },
    { label: 'Benchmark confidence', value: b.confidence + '%', color: b.confidence >= 70 ? 'var(--green)' : b.confidence >= 45 ? '#f59e0b' : 'var(--red)' },
  ].map(s => `
    <div class="debug-stat">
      <div class="ds-label">${s.label}</div>
      <div class="ds-value" style="color:${s.color || (s.green ? 'var(--green)' : s.red ? 'var(--red)' : 'var(--text)')}">
        ${s.value}
      </div>
    </div>`).join('');

  const confEl = document.getElementById('debug-confidence');
  if (b.confidenceReasons && b.confidenceReasons.length) {
    confEl.innerHTML = '<strong>Confidence notes:</strong> ' + b.confidenceReasons.join(' · ');
  } else {
    confEl.innerHTML = '<strong>Confidence:</strong> High — sample size and category match are strong.';
  }

  const constEl = document.getElementById('debug-constraints');
  const blockConstraints = (b.constraints || []).filter(c => c.startsWith('CONSTRAINT') || c.startsWith('CONTRADICTION'));
  if (blockConstraints.length) {
    constEl.style.display = '';
    constEl.innerHTML = '<strong>⚠ Active constraints sent to LLM:</strong><br>' +
      blockConstraints.map(c => `• ${c}`).join('<br>');
  }

  const tbody = document.getElementById('debug-table-body');
  tbody.innerHTML = data.competitors.map((c, i) => {
    const score = c.relevanceScore;
    const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
    const rowClass = c.included ? '' : 'excluded';
    const statusLabel = c.included
      ? '<span class="tag-included">✓ Included</span>'
      : '<span class="tag-excluded">✗ Excluded</span>';
    const websiteLabel = c.hasWebsite
      ? `<span class="tag-website-yes">✓ Yes</span>`
      : `<span class="tag-website-no">—</span>`;

    const bd = c.scoreBreakdown;
    const breakdownHtml = bd
      ? `Cat ${bd.categoryRaw}→${bd.categoryWeighted}/50 · ` +
        `Type ${bd.typeGroupRaw}→${bd.typeGroupWeighted}/25 · ` +
        `Kw ${bd.keywordRaw}→${bd.keywordWeighted}/15 · ` +
        `Dist ${bd.distanceRaw}→${bd.distanceWeighted}/10<br>` +
        `<span style="color:var(--muted)">weakest: ${bd.weakestFactor}</span>`
      : '—';

    return `<tr class="${rowClass}">
      <td>${i + 1}</td>
      <td><strong>${c.name || '—'}</strong></td>
      <td>${c.category || '—'}</td>
      <td>${c.typeGroup || '—'}</td>
      <td><span class="score-pill ${scoreClass}">${score}</span></td>
      <td>${c.categoryMatch || '—'}</td>
      <td>${statusLabel}</td>
      <td>${websiteLabel}</td>
      <td>${c.rating ?? '—'}</td>
      <td>${c.reviews ?? '—'}</td>
      <td style="font-size:11px;color:var(--muted)">${breakdownHtml}</td>
      <td style="font-size:11px;color:var(--muted)">${c.exclusionReason || ''}</td>
    </tr>`;
  }).join('');
}

function toggleDebug() {
  document.getElementById('debug-body').classList.toggle('open');
  document.getElementById('debug-toggle').classList.toggle('open');
}

function wrapToNextBlock(startEl, stopTags, className) {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  startEl.parentNode.insertBefore(wrapper, startEl);
  wrapper.appendChild(startEl);
  let sib = wrapper.nextSibling;
  while (sib) {
    if (stopTags.includes(sib.nodeName)) break;
    const next = sib.nextSibling;
    wrapper.appendChild(sib);
    sib = next;
  }
}

function styleSectionContent(h2El, className) {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  const parent = h2El.parentNode;
  let sib = h2El.nextSibling;
  const children = [];
  while (sib) {
    if (['H1', 'H2', 'HR'].includes(sib.nodeName)) break;
    children.push(sib);
    sib = sib.nextSibling;
  }
  if (!children.length) return;
  parent.insertBefore(wrapper, children[0]);
  children.forEach(c => wrapper.appendChild(c));
}

function enhanceReport() {
  // A queued streaming paint must not overwrite the completed presentation.
  if (typeof renderTimer !== 'undefined' && renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  const el = document.getElementById('report-content');
  if (!el || el.querySelector('[data-report-layout]')) return;
  el.innerHTML = buildReportLayout(el.innerHTML);
}

// Human-readable "data as of" stamp — directly answers the most common
// buyer objection (see target-customer doc): "how do I know this is
// accurate?" A visible run date positions the report as a live snapshot,
// not a stale template.
function formatGeneratedAt(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Renders the "letterhead" block (agency logo/name, written-by byline, and
// generation timestamp) at the top of the report card.
function renderLetterhead(branding, writtenBy, generatedAt) {
  const container = document.getElementById('report-card');
  if (!container) return;
  // Remove only legacy letterhead nodes, never agency settings or report copy.
  Array.from(container.children).filter(el => el.matches('.report-letterhead, .report-written-by, .report-generated-at')).forEach(el => el.remove());
  const slot = container.querySelector('.report-meta-slot');
  if (slot) slot.innerHTML = reportLetterheadHtml(branding, writtenBy, generatedAt);
}

// Bundles the rendered report (with letterhead + written-by) into a
// standalone HTML file so it can be emailed or handed to a client directly —
// no dependency on this page/server, opens and prints cleanly on its own.
function downloadReport(businessName, branding, writtenBy, generatedAt) {
  const content = document.getElementById('report-content').cloneNode(true);
  content.querySelectorAll('.report-meta-slot').forEach(slot => { slot.innerHTML = ''; });
  // Embed the same local stylesheet, so the file remains usable offline.
  const sheet = Array.from(document.styleSheets).find(s => s.href && /\/report\.css(?:[?#]|$)/.test(s.href));
  let css;
  try {
    if (!sheet) throw new Error('Report stylesheet is not loaded.');
    css = Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
  } catch {
    alert('The report styling has not loaded. Reload the page and try downloading again.');
    return;
  }
  const doc = buildReportDocument(businessName, content.innerHTML, branding, writtenBy, generatedAt, css);
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([doc], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${businessName.replace(/[^a-z0-9]+/gi, '-')} - Visibility Report - ${dateStr}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Prompts for a recipient and sends the already-saved report via
// POST /api/reports/:id/email — the server renders the branded HTML and
// sends it through Resend, so no report content needs to travel through
// this call beyond the report ID.
async function emailReport(reportId) {
  if (!reportId) { alert('This report hasn\'t finished saving yet — try again in a moment.'); return; }

  const to = window.prompt('Send this report to (client email address):');
  if (!to) return;
  const message = window.prompt('Optional short note to include (leave blank to skip):') || undefined;

  try {
    const res = await fetch(`/api/reports/${reportId}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send email.');
    alert(`Report sent to ${to}.`);
  } catch (e) {
    alert(e.message);
  }
}

// Presentation only: wrap the existing rendered Markdown, never regenerate
// audit copy, scores or rankings. Also used server-side for HTML attachments.
function reportEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function reportText(html) {
  return String(html).replace(/<\/(?:p|div|section|h[1-6]|li|tr)>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (entity, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : entity)
    .replace(/&#x([0-9a-f]+);/gi, (entity, n) => parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : entity)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function reportSections(html, level) {
  const headings = Array.from(html.matchAll(new RegExp(`<h${level}\\b[^>]*>[\\s\\S]*?<\\/h${level}>`, 'gi')));
  return {
    intro: html.slice(0, headings.length ? headings[0].index : html.length),
    sections: headings.map((match, index) => ({
      heading: match[0],
      title: reportText(match[0]),
      body: html.slice(match.index + match[0].length, index + 1 < headings.length ? headings[index + 1].index : html.length)
    }))
  };
}

function reportTableRows(html) {
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i);
  if (!table) return [];
  return Array.from(table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .filter(row => !/<th\b/i.test(row[1]))
    .map(row => Array.from(row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), cell => reportText(cell[1])));
}

function reportScore(value) {
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)\s*\/\s*10$/);
  return match && Number(match[1]) <= 10 ? Number(match[1]) : null;
}

function reportSummary(sections) {
  const rankings = sections.find(s => /^local market rankings$/i.test(s.title));
  const scorecard = sections.find(s => /^scorecard$/i.test(s.title));
  const confidence = sections.find(s => /^confidence score$/i.test(s.title));
  const metrics = reportTableRows(rankings?.body || '').filter(row =>
    row.length >= 2 && /^(star rating|review count|photo count)$/i.test(row[0]));
  const overall = reportTableRows(scorecard?.body || '').find(row => /^overall$/i.test(row[0]));
  const score = overall ? reportScore(overall[1]) : null;
  const metricHtml = metrics.length ? `<div class="report-metrics" data-report-summary="true">${metrics.map(row =>
    `<div class="report-metric"><span class="report-label">${reportEscape(row[0])}</span><strong>${reportEscape(row[1])}</strong>${row[2] ? `<small>Market average: ${reportEscape(row[2])}</small>` : ''}</div>`
  ).join('')}</div>` : '';
  const conf = reportText(confidence?.body || '').match(/Data Confidence\s*:\s*(High|Medium|Low)\b/i);
  const scoreHtml = score !== null ? `<aside class="report-overall" data-report-summary="true" aria-label="Overall score ${score} out of 10">
    <div class="report-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-value" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${score * 10} 100"/></svg><div><strong>${score}</strong><span>Overall / 10</span></div></div>
    ${overall[2] ? `<p>Market average: <strong>${reportEscape(overall[2])}</strong></p>` : ''}
    ${conf ? `<small>Data confidence: ${reportEscape(conf[1])}</small>` : ''}
  </aside>` : '';
  return { metricHtml, scoreHtml };
}

function reportSectionStyle(title) {
  if (/^business archetype$/i.test(title)) return 'archetype';
  if (/^market position$/i.test(title)) return 'position';
  if (/^local market rankings$/i.test(title)) return 'rankings';
  if (/^confidence score$/i.test(title)) return 'confidence';
  if (/^scorecard$/i.test(title)) return 'scorecard';
  if (/^executive summary$/i.test(title)) return 'executive';
  if (/^top risks$/i.test(title)) return 'risks';
  if (/^top opportunities$/i.test(title)) return 'opportunities';
  if (/^top strengths$/i.test(title)) return 'strengths';
  if (/^quick wins$/i.test(title)) return 'wins';
  if (/^how to fix/i.test(title)) return 'implementation';
  if (/^next step$/i.test(title)) return 'next';
  if (/^what success/i.test(title)) return 'success';
  return 'findings';
}

function decorateReportSection(section) {
  const kind = reportSectionStyle(section.title);
  let body = section.body;
  const groups = reportSections(body, 3);
  if (groups.sections.length && ['risks', 'opportunities', 'strengths', 'implementation', 'findings'].includes(kind)) {
    body = groups.intro + `<div class="report-items">${groups.sections.map((item, i) =>
      `<div class="report-item" data-item-number="${String(i + 1).padStart(2, '0')}">${item.heading}${item.body}</div>`
    ).join('')}</div>`;
  }
  // Original score labels and every table cell remain intact; bars are decorative.
  if (kind === 'scorecard') {
    body = body.replace(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi, (cell, attrs, value) => {
      const score = reportScore(reportText(value));
      return score === null ? cell : `<td${attrs}>${value}<span class="report-meter" aria-hidden="true"><span style="width:${score * 10}%"></span></span></td>`;
    });
  }
  body = body.replace(/<table\b[\s\S]*?<\/table>/gi, table => `<div class="report-table-wrap">${table}</div>`);
  return `<section class="report-section report-section-${kind}">${section.heading}<div class="report-section-body">${body}</div></section>`;
}

function buildReportLayout(html) {
  html = String(html || '');
  if (/data-report-layout="reference-v1"/.test(html)) return html;
  const parsed = reportSections(html, 2);
  const hasCover = /<h1\b/i.test(parsed.intro);
  const first = parsed.sections[0];
  const isArchetype = hasCover && first && /^business archetype$/i.test(first.title);
  const hasCoverPosition = isArchetype && parsed.sections[1] && /^market position$/i.test(parsed.sections[1].title);
  const summary = reportSummary(parsed.sections);
  let intro = parsed.intro;
  // Keep the exact title text; only give its existing subtitle a separate line.
  intro = intro.replace(/([—–-]|&mdash;|&ndash;)\s*Business Growth Assessment/gi,
    '<span class="report-subtitle">$&</span>');
  let cover = '';
  if (hasCover) {
    cover = `<div class="report-cover"><div class="report-meta-slot"></div><div class="report-eyebrow" data-report-summary="true">Local Visibility Audit</div>${intro}`;
    if (isArchetype) {
      cover += `<div class="report-cover-grid${summary.scoreHtml ? '' : ' report-cover-single'}"><div class="report-diagnosis">${first.heading}${first.body}${summary.metricHtml}</div>${summary.scoreHtml}</div>`;
    } else {
      cover += summary.metricHtml + summary.scoreHtml;
    }
    if (hasCoverPosition) {
      const position = parsed.sections[1];
      cover += `<section class="report-cover-position">${position.heading}${position.body}</section>`;
    }
    cover += '</div>';
  } else {
    cover = `<div class="report-plain-intro"><div class="report-meta-slot"></div>${intro}</div>`;
  }
  const sections = parsed.sections.slice(isArchetype ? (hasCoverPosition ? 2 : 1) : 0);
  return `<div class="report-layout" data-report-layout="reference-v1">${cover}<div class="report-body">${sections.map(decorateReportSection).join('')}</div></div>`;
}

function reportLetterheadHtml(branding, writtenBy, generatedAt) {
  const logo = branding?.logoDataUri;
  const company = branding?.companyName;
  return `<div class="report-meta"><div class="report-letterhead">${logo ? `<img src="${reportEscape(logo)}" alt="Agency logo" />` : ''}${company ? `<div class="company-name">${reportEscape(company)}</div>` : ''}</div><div class="report-meta-detail">${writtenBy ? `<div class="report-written-by">Prepared by ${reportEscape(writtenBy)}</div>` : ''}<div class="report-generated-at">Report generated: ${reportEscape(formatGeneratedAt(generatedAt))}</div></div></div>`;
}

function buildReportDocument(businessName, html, branding, writtenBy, generatedAt, css) {
  const title = branding?.companyName || 'Business Growth Assessment';
  const layout = buildReportLayout(html).replace('<div class="report-meta-slot"></div>',
    () => `<div class="report-meta-slot">${reportLetterheadHtml(branding, writtenBy, generatedAt)}</div>`);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${reportEscape(businessName)} — ${reportEscape(title)}</title>
<style>${String(css).replace(/<\/style/gi, '<\\/style')}</style></head>
<body class="report-document"><div class="report-card visible" id="report-card"><div id="report-content">${layout}</div></div></body></html>`;
}

// Only the dependency-free presentation helpers are exposed to the email renderer.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildReportLayout, buildReportDocument, reportLetterheadHtml };
}
