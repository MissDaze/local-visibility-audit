import { Pool } from 'pg';

// Railway's internal Postgres connection doesn't present a publicly trusted
// cert chain — reject-unauthorized SSL breaks it. This matches the pattern
// used across this user's other Railway/Postgres projects.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal') || process.env.PGSSL === 'false'
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});
