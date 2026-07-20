import { Router, Request, Response } from 'express';
import { createBatch, getBatchForTenant, listBatchesForTenant, BatchItemInput } from '../db/batches';
import { findTenantById } from '../db/tenants';
import { processBatch } from '../engine/batchProcessor';
import { checkAndReserveQuota } from '../db/usage';

export const batchRouter = Router();

// Hard cap for the initial release — see pricing doc: batches ship capped at
// 5 businesses per run regardless of subscription tier, raised later once
// this is validated in production.
const MAX_BATCH_SIZE = 5;

batchRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const batches = await listBatchesForTenant(tenantId);
  res.json({ batches });
});

batchRouter.post('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const { items, writtenBy } = req.body as { items?: BatchItemInput[]; writtenBy?: string };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one business is required.' });
    return;
  }
  if (items.length > MAX_BATCH_SIZE) {
    res.status(400).json({ error: `Batches are capped at ${MAX_BATCH_SIZE} businesses right now.` });
    return;
  }
  for (const item of items) {
    if (!item.businessName?.trim() || !item.city?.trim()) {
      res.status(400).json({ error: 'Every row needs a business name and city.' });
      return;
    }
  }

  if (process.env.BILLING_ENABLED === 'true') {
    const quota = await checkAndReserveQuota(tenantId, items.length);
    if (!quota.allowed) {
      res.status(402).json({ error: quota.reason || 'Quota exceeded.' });
      return;
    }
  }

  const tenant = await findTenantById(tenantId);
  const resolvedWrittenBy = writtenBy?.trim() || tenant?.brand_written_by || null;

  const batchId = await createBatch(tenantId, items);

  // Kick off processing in the background — the client polls GET /:id for
  // progress rather than holding one long-lived request open per batch.
  processBatch(tenantId, batchId, resolvedWrittenBy).catch((e) => {
    console.error(`[batch] processBatch crashed for batch ${batchId}:`, e);
  });

  res.json({ batchId });
});

batchRouter.get('/:id', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const data = await getBatchForTenant(tenantId, req.params.id);
  if (!data) {
    res.status(404).json({ error: 'Batch not found.' });
    return;
  }
  res.json(data);
});
