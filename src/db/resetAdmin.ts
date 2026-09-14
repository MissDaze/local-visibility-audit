import type { Pool } from 'pg';
import { hashPassword, verifyPassword } from '../auth/password';

// Explicitly armed by the operator; credentials never belong in source control.
// The durable receipt prevents a later restart from reusing the reset password.
export async function resetAdminOnce(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const resetId = env.ADMIN_RESET_ID?.trim();
  if (!resetId) return;
  const from = env.ADMIN_RESET_FROM_EMAIL?.trim().toLowerCase();
  const to = env.ADMIN_RESET_TO_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_RESET_PASSWORD;
  const admins = (env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase());
  if (!from || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !password || password.length < 8 || !admins.includes(to)) {
    throw new Error('Admin reset configuration is incomplete or target is not in ADMIN_EMAILS');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(183647, 1)");
    await client.query(`CREATE TABLE IF NOT EXISTS admin_reset_receipts (
      reset_id TEXT PRIMARY KEY,
      tenant_id UUID NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const receipt = await client.query('SELECT reset_id FROM admin_reset_receipts WHERE reset_id = $1', [resetId]);
    if (receipt.rowCount) {
      await client.query('COMMIT');
      return;
    }
    const source = await client.query('SELECT id FROM tenants WHERE lower(email) = $1 FOR UPDATE', [from]);
    if (source.rowCount !== 1) throw new Error('Admin reset requires exactly one matching existing source account');
    const tenantId = source.rows[0].id;
    const conflict = await client.query('SELECT id FROM tenants WHERE lower(email) = $1 AND id <> $2', [to, tenantId]);
    if (conflict.rowCount) throw new Error('Admin reset target email already belongs to another account');
    const hash = await hashPassword(password);
    await client.query('UPDATE tenants SET email = $1, password_hash = $2 WHERE id = $3', [to, hash, tenantId]);
    const check = await client.query('SELECT email, password_hash FROM tenants WHERE id = $1', [tenantId]);
    if (check.rows[0]?.email !== to || !(await verifyPassword(password, check.rows[0].password_hash))) {
      throw new Error('Admin reset verification failed');
    }
    // Invalidate this account's old sessions, without affecting other customers.
    const sessionTable = await client.query("SELECT to_regclass('public.session') AS name");
    if (sessionTable.rows[0]?.name) {
      await client.query('DELETE FROM "session" WHERE sess->>\'tenantId\' = $1', [tenantId]);
    }
    await client.query('INSERT INTO admin_reset_receipts (reset_id, tenant_id) VALUES ($1, $2)', [resetId, tenantId]);
    await client.query('COMMIT');
    console.log('[admin-reset] completed and verified; existing account and reports preserved');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
