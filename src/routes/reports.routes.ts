import { Router, Request, Response } from 'express';
import { listReportsForTenant, getReportForTenant } from '../db/reports';

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
