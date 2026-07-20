export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachment?: { filename: string; content: string }; // content = HTML string, base64-encoded below
}

// Raw REST call to Resend (https://resend.com/docs/api-reference/emails/send-email)
// — same fetch-based pattern as Outscraper/Square rather than adding an SDK.
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.');

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const body: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.attachment) {
    body.attachments = [{
      filename: params.attachment.filename,
      content: Buffer.from(params.attachment.content, 'utf8').toString('base64'),
    }];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as any;
  if (!res.ok) {
    throw new Error(`Resend API error: ${json.message || `HTTP ${res.status}`}`);
  }
}
