// Verify this transactional migration without committing schema or record changes.
// This runs only in the trusted deployment build, using its existing database binding.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
const migration = '20261009110000_account_recovery_and_hostel_names';
const client = new pg.Client({ connectionString: process.env.DB_DATABASE_URL_UNPOOLED ?? process.env.DB_DATABASE_URL ?? process.env.DATABASE_URL });
try {
  await client.connect();
  const applied = await client.query('SELECT finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1 ORDER BY started_at DESC LIMIT 1', [migration]);
  if (applied.rows[0]?.finished_at) console.log('Recovery/name migration already applied.');
  else {
    const conflicts = await client.query(`
      WITH names AS (
        SELECT 'workspace' source,id, id organization, name, NULL::text domain, status::text state FROM "Organization"
        UNION ALL SELECT 'property',id,"organizationId",name,"customDomain",CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END FROM "Property"
      ), keyed AS (SELECT *,lower(regexp_replace(normalize(name,NFKC),'[^[:alnum:]]','','g')) key FROM names), conflicts AS (
        SELECT key FROM keyed GROUP BY key HAVING COUNT(DISTINCT organization)>1 OR COUNT(*) FILTER (WHERE source='property')>1
      ) SELECT source,name,domain,state,
        (SELECT COUNT(*)::int FROM "User" u WHERE u."organizationId"=k.organization) users,
        (SELECT COUNT(*)::int FROM "Student" s WHERE s."organizationId"=k.organization) students,
        (SELECT COUNT(*)::int FROM "Room" r WHERE r."organizationId"=k.organization) rooms
        FROM keyed k JOIN conflicts c USING (key) ORDER BY key,source LIMIT 30
    `);
    if (conflicts.rows.length) console.log('HOSTEL_NAME_CONFLICTS',JSON.stringify(conflicts.rows));
    const sql = (await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8')).replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '');
    await client.query('BEGIN');
    try { await client.query(sql); console.log('Recovery/name migration dry run passed; rolling back verification.'); }
    finally { await client.query('ROLLBACK'); }
    if (applied.rows.length && !applied.rows[0].rolled_back_at) throw Error('RECOVERY_MIGRATION_FAILED_RECORD_REQUIRES_ROLLBACK_RECONCILIATION');
  }
} catch (error) {
  console.error('Recovery/name migration verification failed:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally { await client.end(); }
