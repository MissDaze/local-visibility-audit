import { randomUUID } from 'crypto';
import { pool } from './pool';

export interface BatchItemInput {
  businessName: string;
  city: string;
  industry?: string;
  recipientEmail?: string;
}

export interface BatchItemRow {
  id: string;
  batch_id: string;
  report_id: string | null;
  business_name: string;
  city: string;
  industry: string | null;
  recipient_email: string | null;
  status: 'queued' | 'running' | 'complete' | 'error';
  status_detail: string | null;
  position: number;
}

export interface BatchRow {
  id: string;
  tenant_id: string;
  status: 'running' | 'complete' | 'error';
  total: number;
  completed: number;
  created_at: string;
}

export async function createBatch(tenantId: string, items: BatchItemInput[]): Promise<string> {
  const batchId = randomUUID();
  await pool.query(
    `INSERT INTO batches (id, tenant_id, status, total, completed) VALUES ($1, $2, 'running', $3, 0)`,
    [batchId, tenantId, items.length],
  );

  let position = 0;
  for (const item of items) {
    await pool.query(
      `INSERT INTO batch_items (id, batch_id, business_name, city, industry, recipient_email, status, position)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7)`,
      [randomUUID(), batchId, item.businessName.trim(), item.city.trim(), item.industry?.trim() || null, item.recipientEmail?.trim() || null, position],
    );
    position += 1;
  }

  return batchId;
}

export async function getBatchForTenant(tenantId: string, batchId: string): Promise<{ batch: BatchRow; items: BatchItemRow[] } | null> {
  const { rows: batchRows } = await pool.query<BatchRow>(
    `SELECT id, tenant_id, status, total, completed, created_at FROM batches WHERE id = $1 AND tenant_id = $2`,
    [batchId, tenantId],
  );
  const batch = batchRows[0];
  if (!batch) return null;

  const { rows: items } = await pool.query<BatchItemRow>(
    `SELECT id, batch_id, report_id, business_name, city, industry, recipient_email, status, status_detail, position
     FROM batch_items WHERE batch_id = $1 ORDER BY position ASC`,
    [batchId],
  );

  return { batch, items };
}

export async function listBatchesForTenant(tenantId: string, limit = 50): Promise<BatchRow[]> {
  const { rows } = await pool.query<BatchRow>(
    `SELECT id, tenant_id, status, total, completed, created_at FROM batches
     WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

export async function updateBatchItem(
  itemId: string,
  fields: Partial<Pick<BatchItemRow, 'status' | 'status_detail' | 'report_id'>>,
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [itemId];
  let i = 2;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    values.push(value);
    i += 1;
  }
  if (!sets.length) return;
  await pool.query(`UPDATE batch_items SET ${sets.join(', ')} WHERE id = $1`, values);
}

export async function incrementBatchCompleted(batchId: string): Promise<void> {
  await pool.query(`UPDATE batches SET completed = completed + 1 WHERE id = $1`, [batchId]);
}

export async function setBatchStatus(batchId: string, status: 'complete' | 'error'): Promise<void> {
  await pool.query(`UPDATE batches SET status = $2 WHERE id = $1`, [batchId, status]);
}
