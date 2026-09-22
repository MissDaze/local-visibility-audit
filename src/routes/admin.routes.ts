import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';

export const adminRouter = Router();

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) { res.status(401).json({ error: 'Login required.' }); return; }
  const { rows } = await pool.query<{ email: string }>('SELECT email FROM tenants WHERE id = $1', [tenantId]);
  const email = rows[0]?.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) { res.status(403).json({ error: 'Admin access required.' }); return; }
  next();
}

adminRouter.use(requireAdmin);

adminRouter.get('/analytics', async (_req, res) => {
  const [summary, signups, reportsByDay, recentAccounts, recentReports] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM tenants) AS total_accounts,
        (SELECT count(*)::int FROM tenants WHERE created_at >= now() - interval '7 days') AS signups_7d,
        (SELECT count(*)::int FROM tenants WHERE plan_tier = 'trial' AND trial_ends_at > now()) AS active_trials,
        (SELECT count(*)::int FROM reports) AS total_reports,
        (SELECT count(*)::int FROM reports WHERE created_at >= now() - interval '7 days') AS reports_7d,
        (SELECT count(*)::int FROM subscriptions WHERE status IN ('active','canceling')) AS paid_subscriptions,
        (SELECT count(DISTINCT tenant_id)::int FROM reports WHERE created_at >= now() - interval '7 days') AS active_report_users_7d
    `),
    pool.query(`
      SELECT d::date AS day, count(t.id)::int AS count
      FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d
      LEFT JOIN tenants t ON t.created_at >= d AND t.created_at < d + interval '1 day'
      GROUP BY d ORDER BY d
    `),
    pool.query(`
      SELECT d::date AS day, count(r.id)::int AS count
      FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') d
      LEFT JOIN reports r ON r.created_at >= d AND r.created_at < d + interval '1 day'
      GROUP BY d ORDER BY d
    `),
    pool.query(`
      SELECT t.email, t.company_name, t.plan_tier, t.trial_ends_at, t.created_at,
             count(r.id)::int AS reports_generated
      FROM tenants t LEFT JOIN reports r ON r.tenant_id = t.id
      GROUP BY t.id ORDER BY t.created_at DESC LIMIT 30
    `),
    pool.query(`
      SELECT r.id, r.business_name, r.city, r.status, r.created_at, r.completed_at,
             t.email, t.company_name
      FROM reports r JOIN tenants t ON t.id = r.tenant_id
      ORDER BY r.created_at DESC LIMIT 30
    `)
  ]);
  res.json({
    summary: summary.rows[0],
    signupsByDay: signups.rows,
    reportsByDay: reportsByDay.rows,
    recentAccounts: recentAccounts.rows,
    recentReports: recentReports.rows,
    generatedAt: new Date().toISOString()
  });
});
