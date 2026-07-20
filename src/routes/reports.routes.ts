import { Router, Request, Response } from 'express';
import { listReportsForTenant, getReportForTenant } from '../db/reports';
import { sendReportEmail } from '../email/sendReportEmail';
import { emailConfigured } from '../email/resend';

export const reportsRouter = Router();

reportsRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const reports = await listReportsForTenant(tenantId);
  res.json({ reports });
});

reportsRouter.get('/:id', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const report = await getReportForTenant(tenantId, req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }
  res.json({ report });
});

reportsRouter.post('/:id/email', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const { to, message } = req.body as { to?: string; message?: string };

  if (!emailConfigured()) {
    res.status(503).json({ error: 'Email sending is not configured on this deployment.' });
    return;
  }
  if (!to?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    res.status(400).json({ error: 'A valid recipient email is required.' });
    return;
  }

  const report = await getReportForTenant(tenantId, req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  try {
    await sendReportEmail(tenantId, report, to.trim(), message?.trim());
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to send email.' });
  }
});
