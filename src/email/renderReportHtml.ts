import { marked } from 'marked';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Branding } from '../db/tenants';

// Share the browser renderer and local CSS. No change to delivery, stored
// Markdown, branding settings, or the short email cover note below.
const { buildReportDocument } = require('../../public/report-render.js') as {
  buildReportDocument: (
    businessName: string, html: string, branding: Branding | null,
    writtenBy: string | null, generatedAt: string, css: string,
  ) => string;
};

export function renderBrandedReportHtml(
  businessName: string,
  markdown: string,
  branding: Branding | null,
  writtenBy: string | null,
  generatedAt: string,
): string {
  const reportHtml = marked.parse(markdown, { async: false }) as string;
  const css = readFileSync(join(__dirname, '../../public/report.css'), 'utf8');
  return buildReportDocument(businessName, reportHtml, branding, writtenBy, generatedAt, css);
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
