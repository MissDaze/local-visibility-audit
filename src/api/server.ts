import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { initSchema } from '../db/schema';
import { sessionMiddleware } from '../auth/session';
import { requireAuth } from '../middleware/requireAuth';
import { authRouter } from '../routes/auth.routes';
import { reportsRouter } from '../routes/reports.routes';
import { batchRouter } from '../routes/batch.routes';
import { brandingRouter } from '../routes/branding.routes';
import { runAudit } from '../engine/runAudit';
import { createRunningReport, completeReport, failReport } from '../db/reports';
import { findTenantById } from '../db/tenants';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); // Railway sits behind a proxy — needed for secure cookies to work correctly

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, '../../public')));

app.use('/api/auth', authRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/batch', requireAuth, batchRouter);
app.use('/api/branding', requireAuth, brandingRouter);

// ---------------------------------------------------------------------------
// POST /api/audit/stream — single interactive audit, streamed to the browser
// ---------------------------------------------------------------------------
app.post('/api/audit/stream', requireAuth, async (req: Request, res: Response) => {
  console.log('[audit] request received', new Date().toISOString());
  const tenantId = req.session.tenantId!;
  const { businessName, city, industry, writtenBy } = req.body as {
    businessName: string;
    city: string;
    industry?: string;
    writtenBy?: string;
  };

  if (!businessName?.trim() || !city?.trim()) {
    res.status(400).json({ error: 'businessName and city are required.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (payload: object) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  // SSE keepalive: the Outscraper async submit+poll can take up to ~2
  // minutes per call now, during which no application data is sent. A
  // periodic comment ping keeps the connection from looking idle to any
  // intermediary (proxy, browser) that might otherwise time it out.
  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);

  const tenant = await findTenantById(tenantId);
  const resolvedWrittenBy = writtenBy?.trim() || tenant?.brand_written_by || null;
  const reportId = await createRunningReport(tenantId, businessName, city, industry, resolvedWrittenBy);

  try {
    const result = await runAudit(businessName.trim(), city.trim(), industry?.trim(), send);
    await completeReport(reportId, result.markdown, result.debug);
    send({ done: true, reportId });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Audit stream error:', msg);
    await failReport(reportId, msg);
    send({ error: msg });
    res.end();
  } finally {
    clearInterval(keepAlive);
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

async function start() {
  try {
    await initSchema();
  } catch (e) {
    console.error('[db] schema init failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Local Audit Engine → http://localhost:${PORT}`);
    if (!process.env.OUTSCRAPER_API_KEY) console.warn('⚠  OUTSCRAPER_API_KEY not set');
    if (!process.env.OPENROUTER_API_KEY) console.warn('⚠  OPENROUTER_API_KEY not set');
    if (!process.env.DATABASE_URL) console.warn('⚠  DATABASE_URL not set');
    if (!process.env.SESSION_SECRET) console.warn('⚠  SESSION_SECRET not set — using an insecure dev default');
  });
}

start();

export default app;
