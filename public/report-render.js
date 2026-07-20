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
  const el = document.getElementById('report-content');

  el.querySelectorAll('li').forEach(li => {
    if (li.textContent.trim().startsWith('✓')) {
      li.classList.add('check-item');
      const ul = li.closest('ul');
      if (ul) ul.classList.add('check-list');
    }
  });

  el.querySelectorAll('h3').forEach(h3 => {
    const text = h3.textContent || '';
    if (/option\s*1/i.test(text)) {
      wrapToNextBlock(h3, ['H2', 'H3', 'HR'], 'impl-card impl-diy');
    } else if (/option\s*2/i.test(text)) {
      wrapToNextBlock(h3, ['H2', 'H3', 'HR'], 'impl-card impl-dfy');
    }
  });

  el.querySelectorAll('h2').forEach(h2 => {
    const text = h2.textContent || '';
    if (/next\s*step/i.test(text)) {
      styleSectionContent(h2, 'next-step-content');
    } else if (/what\s*success/i.test(text)) {
      styleSectionContent(h2, 'success-content');
    }
  });
}

// Renders the "letterhead" block (agency logo/name + written-by byline) at
// the top of the report card, if the tenant has set any branding.
function renderLetterhead(branding, writtenBy) {
  const container = document.getElementById('report-card');
  const existing = container.querySelector('.report-letterhead, .report-written-by');
  if (existing) existing.remove();

  const content = document.getElementById('report-content');
  const parts = [];

  if (branding && (branding.logoDataUri || branding.companyName)) {
    parts.push(`<div class="report-letterhead">
      ${branding.logoDataUri ? `<img src="${branding.logoDataUri}" alt="Logo" />` : ''}
      ${branding.companyName ? `<div class="company-name">${branding.companyName}</div>` : ''}
    </div>`);
  }
  if (writtenBy) {
    parts.push(`<div class="report-written-by">Prepared by ${writtenBy}</div>`);
  }
  if (parts.length) {
    const wrap = document.createElement('div');
    wrap.innerHTML = parts.join('');
    while (wrap.firstChild) content.parentNode.insertBefore(wrap.firstChild, content);
  }
}

// Bundles the rendered report (with letterhead + written-by) into a
// standalone HTML file so it can be emailed or handed to a client directly —
// no dependency on this page/server, opens and prints cleanly on its own.
function downloadReport(businessName, branding, writtenBy) {
  const reportHtml = document.getElementById('report-content').innerHTML;
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = (branding && branding.companyName) || 'Business Growth Assessment';

  const letterheadHtml = (branding && (branding.logoDataUri || branding.companyName))
    ? `<div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid #2e3347;">
        ${branding.logoDataUri ? `<img src="${branding.logoDataUri}" style="max-height:64px;max-width:220px;object-fit:contain" />` : ''}
        ${branding.companyName ? `<div style="font-size:16px;font-weight:800;">${branding.companyName}</div>` : ''}
      </div>`
    : '';
  const writtenByHtml = writtenBy ? `<div style="font-size:12px;color:#8892aa;margin-bottom:24px;">Prepared by ${writtenBy}</div>` : '';

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${businessName} — ${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;color:#e2e8f0;font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.8;padding:48px 24px}
  .wrap{max-width:720px;margin:0 auto;background:#1a1d27;border:1px solid #2e3347;border-radius:10px;padding:36px}
  #report-content h1{font-size:22px;font-weight:800;letter-spacing:-0.4px;margin-bottom:4px}
  #report-content h2{font-size:17px;font-weight:700;color:#6366f1;margin-top:36px;margin-bottom:14px;border-bottom:1px solid #2e3347;padding-bottom:8px}
  #report-content h3{font-size:15px;font-weight:700;margin-top:22px;margin-bottom:8px}
  #report-content p{margin-bottom:12px}
  #report-content ul,#report-content ol{padding-left:20px;margin-bottom:12px}
  #report-content li{margin-bottom:6px}
  #report-content table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px}
  #report-content th{background:#222534;padding:9px 14px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#8892aa;border-bottom:1px solid #2e3347}
  #report-content td{padding:10px 14px;border-bottom:1px solid #2e3347}
  #report-content strong{font-weight:700;color:#fff}
  #report-content em{color:#8892aa}
  #report-content hr{border:none;border-top:1px solid #2e3347;margin:28px 0}
  #report-content .impl-card{background:#222534;border:1px solid #2e3347;border-radius:8px;padding:20px 24px;margin:12px 0 20px}
  #report-content .impl-diy{border-left:3px solid #6366f1}
  #report-content .impl-dfy{border-left:3px solid #22c55e}
  #report-content .check-list{list-style:none;padding-left:0}
  #report-content .check-item{color:#22c55e}
  #report-content .next-step-content{background:#6366f112;border:1px solid #6366f135;border-radius:8px;padding:16px 20px;margin-bottom:10px}
  #report-content .success-content{background:#22c55e0d;border:1px solid #22c55e30;border-radius:8px;padding:16px 20px;margin-bottom:10px}
  @media print { body{background:#fff;color:#111;padding:0} .wrap{border:none;padding:0} #report-content h2{color:#111} }
</style>
</head>
<body>
<div class="wrap">
${letterheadHtml}
${writtenByHtml}
<div id="report-content">${reportHtml}</div>
</div>
</body>
</html>`;

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
