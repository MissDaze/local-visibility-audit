import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../db/pool';

export const brandingRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — a letterhead/logo doesn't need to be bigger
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Logo must be a PNG, JPEG, or WEBP image.'));
  },
});

interface BrandingRow {
  company_name: string | null;
  brand_written_by: string | null;
  brand_logo: Buffer | null;
  brand_logo_mime: string | null;
}

async function loadBranding(tenantId: string): Promise<BrandingRow | null> {
  const { rows } = await pool.query<BrandingRow>(
    `SELECT company_name, brand_written_by, brand_logo, brand_logo_mime FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

brandingRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const row = await loadBranding(tenantId);
  if (!row) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({
    companyName: row.company_name,
    writtenBy: row.brand_written_by,
    logoDataUri: row.brand_logo
      ? `data:${row.brand_logo_mime};base64,${row.brand_logo.toString('base64')}`
      : null,
  });
});

brandingRouter.put('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const { companyName, writtenBy } = req.body as { companyName?: string; writtenBy?: string };

  await pool.query(
    `UPDATE tenants SET company_name = $2, brand_written_by = $3 WHERE id = $1`,
    [tenantId, companyName?.trim() || null, writtenBy?.trim() || null],
  );
  res.json({ ok: true });
});

brandingRouter.post('/logo', upload.single('logo'), async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  if (!req.file) {
    res.status(400).json({ error: 'No logo file uploaded.' });
    return;
  }
  await pool.query(
    `UPDATE tenants SET brand_logo = $2, brand_logo_mime = $3 WHERE id = $1`,
    [tenantId, req.file.buffer, req.file.mimetype],
  );
  res.json({
    ok: true,
    logoDataUri: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
  });
});

brandingRouter.delete('/logo', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  await pool.query(`UPDATE tenants SET brand_logo = NULL, brand_logo_mime = NULL WHERE id = $1`, [tenantId]);
  res.json({ ok: true });
});

// Multer errors (e.g. file too large / wrong type) reach here instead of the
// generic Express error handler because they're thrown inside the upload
// middleware before the route body runs.
brandingRouter.use((err: Error, _req: Request, res: Response, next: (e?: Error) => void) => {
  if (err instanceof multer.MulterError || /must be a PNG|JPEG|WEBP/.test(err.message)) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});
