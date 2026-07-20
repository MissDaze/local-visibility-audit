import { randomUUID } from 'crypto';
import { pool } from './pool';

export interface Tenant {
  id: string;
  email: string;
  password_hash: string;
  company_name: string | null;
  plan_tier: string;
  trial_ends_at: string;
  brand_written_by: string | null;
  created_at: string;
}

export async function findTenantByEmail(email: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>(
    `SELECT id, email, password_hash, company_name, plan_tier, trial_ends_at, brand_written_by, created_at
     FROM tenants WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  const { rows } = await pool.query<Tenant>(
    `SELECT id, email, password_hash, company_name, plan_tier, trial_ends_at, brand_written_by, created_at
     FROM tenants WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createTenant(email: string, passwordHash: string, companyName?: string): Promise<Tenant> {
  const id = randomUUID();
  const { rows } = await pool.query<Tenant>(
    `INSERT INTO tenants (id, email, password_hash, company_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password_hash, company_name, plan_tier, trial_ends_at, brand_written_by, created_at`,
    [id, email.trim().toLowerCase(), passwordHash, companyName?.trim() || null],
  );
  return rows[0];
}

export interface Branding {
  companyName: string | null;
  writtenBy: string | null;
  logoDataUri: string | null;
}

// Shared by the branding settings page and the report-email feature — both
// need the same "how does this tenant's branding render" logic.
export async function getBranding(tenantId: string): Promise<Branding | null> {
  const { rows } = await pool.query<{ company_name: string | null; brand_written_by: string | null; brand_logo: Buffer | null; brand_logo_mime: string | null }>(
    `SELECT company_name, brand_written_by, brand_logo, brand_logo_mime FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    companyName: row.company_name,
    writtenBy: row.brand_written_by,
    logoDataUri: row.brand_logo ? `data:${row.brand_logo_mime};base64,${row.brand_logo.toString('base64')}` : null,
  };
}
