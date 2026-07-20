import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../db/pool';
import { getBranding } from '../db/tenants';

export const brandingRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB — a letterhead/logo doesn't need to be bigger
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Logo must be a PNG, JPEG, or WEBP image.'));
  },
});

brandingRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.session.tenantId!;
  const branding = await getBranding(tenantId);
  if (!branding) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json(branding);
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
