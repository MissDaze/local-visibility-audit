import { getBranding } from '../db/tenants';
import { renderBrandedReportHtml, renderReportEmailBody } from './renderReportHtml';
import { sendEmail, emailConfigured } from './resend';

export interface EmailableReport {
  business_name: string;
  status: string;
  markdown: string | null;
  written_by: string | null;
  created_at: string;
}

export async function sendReportEmail(
  tenantId: string,
  report: EmailableReport,
  recipientEmail: string,
  message?: string,
): Promise<void> {
  if (!emailConfigured()) throw new Error('Email sending is not configured on this deployment.');
  const markdown = report.markdown;
  if (report.status !== 'complete' || !markdown) {
    throw new Error('This report has not finished generating yet.');
  }

  const branding = await getBranding(tenantId);
  const writtenBy = report.written_by ?? branding?.writtenBy ?? null;

  const attachmentHtml = renderBrandedReportHtml(report.business_name, markdown, branding, writtenBy, report.created_at);
  const bodyHtml = renderReportEmailBody(report.business_name, branding, writtenBy, message);

  await sendEmail({
    to: recipientEmail,
    subject: `${report.business_name} — Business Growth Assessment`,
    html: bodyHtml,
    attachment: {
      filename: `${report.business_name.replace(/[^a-z0-9]+/gi, '-')}-visibility-report.html`,
      content: attachmentHtml,
    },
  });
}
