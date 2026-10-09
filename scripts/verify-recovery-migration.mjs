// Verify this transactional migration without committing schema or record changes.
// This runs only in the trusted deployment build, using its existing database binding.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { execFileSync } from 'node:child_process';
const migration = '20261009110000_account_recovery_and_hostel_names';
const client = new pg.Client({ connectionString: process.env.DB_DATABASE_URL_UNPOOLED ?? process.env.DB_DATABASE_URL ?? process.env.DATABASE_URL });
try {
  await client.connect();
  const history = await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists");
  if (!history.rows[0].exists) { console.log('Fresh database; the normal migration sequence will initialize the schema.'); await client.end(); process.exit(0); }
  const previous = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE migration_name=$1 AND finished_at IS NOT NULL', ['20261009100000_property_photo_categories']);
  if (!previous.rows.length) { console.log('Earlier schema migrations are pending; apply the normal ordered migration sequence.'); await client.end(); process.exit(0); }
  const applied = await client.query('SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1 ORDER BY started_at DESC LIMIT 1', [migration]);
  if (applied.rows[0]?.finished_at) console.log('Recovery/name migration already applied.');
  else {
    const sql = (await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8')).replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
    await client.query('BEGIN');
    try { await client.query(sql); console.log('Recovery/name migration dry run passed; rolling back verification.'); }
    finally { await client.query('ROLLBACK'); }
    if (applied.rows.length && !applied.rows[0].rolled_back_at) {
      const artifacts = await client.query(`SELECT to_regclass('public."PasswordRecovery"') IS NOT NULL OR to_regclass('public."RecoveryRateLimit"') IS NOT NULL OR to_regprocedure('public.hostel_name_key(text)') IS NOT NULL AS present`);
      if (artifacts.rows[0].present) throw Error('RECOVERY_MIGRATION_PARTIAL_STATE_REQUIRES_REVIEW');
      // Only this known transactional migration may be reconciled, and only after
      // a successful rolled-back verification and confirmation of absent artifacts.
      console.log('Verified prior recovery migration rolled back completely; reconciling its failed marker.');
      execFileSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','resolve','--rolled-back',migration,'--config','prisma.config.ts'], {stdio:'inherit'});
    }
  }
} catch (error) {
  console.error('Recovery/name migration verification failed:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally { await client.end(); }
