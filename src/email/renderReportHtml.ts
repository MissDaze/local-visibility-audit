import { marked } from 'marked';
import { Branding } from '../db/tenants';

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
  const reportHtml = marked.parse(markdown, { async: false }) as string;
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
  @media print { body{background:#fff;color:#111;padding:0} .wrap{border:none;padding:0} #report-content h2{color:#111} }
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
