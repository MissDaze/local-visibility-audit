import { marked } from 'marked';
import { Branding } from '../db/tenants';

function slugifySection(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function styliseReportMarkup(html: string): string {
  const parts = html.split(/(?=<h2>)/g);
  const intro = parts.shift() || '';

  const cover = `<div class="report-cover">
    <div class="report-eyebrow">Local Visibility Audit</div>
    ${intro.replace(
      /<h1>([\s\S]*?)<\/h1>/i,
      (_m, title) => {
        const plain = String(title).replace(/<[^>]+>/g, '');
        const pieces = plain.split(' — ');
        if (pieces.length > 1) {
          const business = pieces.shift();
          return `<h1>${business}<span class="assessment-title">${pieces.join(' — ')}</span></h1>`;
        }
        return `<h1>${title}</h1>`;
      },
    )}
  </div>`;

  const sections = parts.map(part => {
    const match = part.match(/<h2>([\s\S]*?)<\/h2>/i);
    const slug = slugifySection(match?.[1] || 'section');
    return `<section class="report-section section-${slug}">${part}</section>`;
  }).join('');

  return cover + sections;
}

// Server-side mirror of public/report-render.js's downloadReport() —
// same styling, same letterhead treatment — so an emailed report looks
// identical to the one a tenant would download themselves.
export function renderBrandedReportHtml(
  businessName: string,
  markdown: string,
  branding: Branding | null,
  writtenBy: string | null,
  generatedAt: string,
): string {
  const reportHtml = styliseReportMarkup(marked.parse(markdown, { async: false }) as string);
  const title = branding?.companyName || 'Business Growth Assessment';
  const generatedAtLabel = new Date(generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const letterheadHtml = (branding && (branding.logoDataUri || branding.companyName))
    ? `<div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid #2e3347;">
        ${branding.logoDataUri ? `<img src="${branding.logoDataUri}" style="max-height:64px;max-width:220px;object-fit:contain" />` : ''}
        ${branding.companyName ? `<div style="font-size:16px;font-weight:800;">${branding.companyName}</div>` : ''}
      </div>`
    : '';
  const writtenByHtml = writtenBy ? `<div style="font-size:12px;color:#8892aa;">Prepared by ${writtenBy}</div>` : '';
  const generatedAtHtml = `<div style="font-size:12px;color:#8892aa;margin-bottom:24px;">Report generated: ${generatedAtLabel}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${businessName} — ${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1220;color:#15192b;font-family:Inter,Arial,Helvetica,sans-serif;line-height:1.62;padding:36px 18px}
  .wrap{max-width:900px;margin:0 auto;background:#f6f7fb;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(2,6,23,.25)}
  .report-letterhead{display:flex;align-items:center;gap:14px;padding:24px 42px 14px;background:#11172a;color:#fff}
  .report-letterhead img{max-height:44px;max-width:180px;object-fit:contain;border-radius:8px}
  .report-letterhead .company-name{font-size:15px;font-weight:800;color:#fff}
  .report-written-by{background:#11172a;color:#aeb7d2;padding:0 42px 2px;font-size:11px}
  .report-generated-at{background:#11172a;color:#7f8aa9;padding:0 42px 18px;font-size:11px}
  .report-cover{position:relative;overflow:hidden;min-height:300px;padding:44px 54px 50px;color:#fff;background:radial-gradient(circle at 68% 15%,rgba(111,76,255,.28),transparent 34%),radial-gradient(circle at 6% 92%,rgba(26,199,184,.16),transparent 27%),linear-gradient(145deg,#0c1222 0%,#141a31 58%,#161c35 100%);border-bottom:1px solid #28304a}
  .report-eyebrow{display:inline-flex;align-items:center;min-height:30px;padding:0 15px;margin-bottom:26px;border:1px solid rgba(124,100,255,.34);border-radius:999px;background:rgba(111,76,255,.11);color:#a99cff;font-size:10px;font-weight:800;letter-spacing:1.25px;text-transform:uppercase}
  .report-cover h1{max-width:760px;margin:0;color:#fff;font-size:38px;line-height:1.08;letter-spacing:-1.35px;font-weight:800}
  .report-cover h1 .assessment-title{display:block;color:#755cff}
  .report-cover hr{display:none}
  .report-section{max-width:800px;margin:0 auto;padding:38px 42px;border-bottom:1px solid #e8eaf2}
  .report-section:last-child{border-bottom:none;padding-bottom:54px}
  .report-section>h2{margin:0 0 18px;padding:0;border:0;color:#8992a9;font-size:10px;line-height:1.2;font-weight:800;letter-spacing:1.45px;text-transform:uppercase}
  .report-section h3{font-size:15px;color:#171b2d;margin:22px 0 8px}
  .report-section p{margin-bottom:12px;color:#4e566d}
  .report-section ul,.report-section ol{padding-left:20px;margin-bottom:12px;color:#4e566d}
  .report-section li{margin-bottom:6px}
  .report-section strong{font-weight:700;color:#171b2d}
  .report-section em{color:#7d879f}
  .section-business-archetype{margin-top:-24px;max-width:760px;padding:28px 30px 30px;background:#fff;border:1px solid #e3e6ef;border-radius:18px;box-shadow:0 12px 30px rgba(28,35,58,.09)}
  .section-business-archetype>p:first-of-type strong{display:block;margin:2px 0 8px;font-size:24px;line-height:1.15;letter-spacing:-.55px}
  .section-confidence-score p{padding:18px 20px;background:#f1efff;border:1px solid #ddd8ff;border-radius:14px}
  table{width:100%;margin:18px 0 8px;overflow:hidden;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e1e4ed;border-radius:16px;color:#30364a;font-size:12px}
  th{background:#eef0f6;color:#7d879f;border-bottom:1px solid #dfe3ec;padding:12px 14px;text-align:left;font-size:9px;letter-spacing:.95px;text-transform:uppercase;font-weight:800}
  td{padding:13px 14px;border-bottom:1px solid #eceef4;color:#4a5166}
  tr:last-child td{border-bottom:none}
  hr{border:none;border-top:1px solid #e8eaf2;margin:26px 0}
  @media(max-width:700px){body{padding:0}.wrap{border-radius:0}.report-letterhead{padding:20px 22px 12px}.report-written-by,.report-generated-at{padding-left:22px;padding-right:22px}.report-cover{padding:34px 26px 38px}.report-cover h1{font-size:30px}.report-section{padding:30px 24px}.section-business-archetype{margin:0 18px}}
  @media print{@page{size:A4;margin:12mm}body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{max-width:none;box-shadow:none;border-radius:0}.report-cover{min-height:250mm;break-after:page;page-break-after:always;display:flex;flex-direction:column;justify-content:center}.report-section{max-width:none;break-inside:avoid;page-break-inside:avoid;padding:14mm 8mm}table{break-inside:avoid;page-break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
${letterheadHtml}
${writtenByHtml}
${generatedAtHtml}
<div id="report-content">${reportHtml}</div>
</div>
</body>
</html>`;
}

// Short wrapper email — the full report goes as an attached HTML file
// (opens/prints cleanly on its own); the email body itself is a brief,
// branded cover note rather than the entire multi-page report inlined,
// since email clients render long custom HTML/CSS unreliably.
export function renderReportEmailBody(
  businessName: string,
  branding: Branding | null,
  writtenBy: string | null,
  message: string | undefined,
): string {
  const senderName = branding?.companyName || 'Local Visibility Audit';
  const byLine = writtenBy ? `<p style="color:#666;font-size:13px;">Prepared by ${writtenBy}</p>` : '';
  const customMessage = message ? `<p>${message}</p>` : '';

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">
  ${branding?.logoDataUri ? `<img src="${branding.logoDataUri}" style="max-height:56px;max-width:200px;object-fit:contain;margin-bottom:16px;" />` : ''}
  <h2 style="margin-bottom:12px;">Your ${businessName} Visibility Report</h2>
  ${customMessage}
  <p>Your business growth assessment for <strong>${businessName}</strong> is attached to this email.</p>
  ${byLine}
  <p style="color:#999;font-size:12px;margin-top:24px;">Sent by ${senderName}</p>
</body>
</html>`;
}
