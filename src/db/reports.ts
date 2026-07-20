import { randomUUID } from 'crypto';
import { pool } from './pool';

export interface ReportRow {
  id: string;
  tenant_id: string;
  business_name: string;
  city: string;
  industry: string | null;
  status: 'running' | 'complete' | 'error';
  markdown: string | null;
  debug_json: unknown;
  error: string | null;
  written_by: string | null;
  batch_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createRunningReport(
  tenantId: string,
  businessName: string,
  city: string,
  industry: string | undefined,
  writtenBy: string | null,
  batchId?: string,
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO reports (id, tenant_id, business_name, city, industry, status, written_by, batch_id)
     VALUES ($1, $2, $3, $4, $5, 'running', $6, $7)`,
    [id, tenantId, businessName.trim(), city.trim(), industry?.trim() || null, writtenBy, batchId ?? null],
  );
  return id;
}

export async function completeReport(id: string, markdown: string, debugJson: unknown): Promise<void> {
  await pool.query(
    `UPDATE reports SET status = 'complete', markdown = $2, debug_json = $3, completed_at = now() WHERE id = $1`,
    [id, markdown, JSON.stringify(debugJson)],
  );
}

export async function failReport(id: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE reports SET status = 'error', error = $2, completed_at = now() WHERE id = $1`,
    [id, error.slice(0, 2000)],
  );
}

export async function listReportsForTenant(tenantId: string, limit = 100): Promise<ReportRow[]> {
  const { rows } = await pool.query<ReportRow>(
    `SELECT id, tenant_id, business_name, city, industry, status, error, written_by, batch_id, created_at, completed_at
     FROM reports WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit],
  );
  return rows;
}

export async function getReportForTenant(tenantId: string, reportId: string): Promise<ReportRow | null> {
  const { rows } = await pool.query<ReportRow>(
    `SELECT * FROM reports WHERE id = $1 AND tenant_id = $2`,
    [reportId, tenantId],
  );
  return rows[0] ?? null;
}
