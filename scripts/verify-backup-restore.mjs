// Restores into a fresh, isolated in-memory PostgreSQL database. Never touches the source.
// Run: PGLITE_MODULE_ROOT=/path/to/node_modules node --import tsx scripts/verify-backup-restore.mjs /private/backup.json.gz
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {validateBackup,backupChecksum,identifier} from '../src/lib/production-backup.ts';
export async function verifyRestore(snapshot){
 const stats=validateBackup(snapshot);
 const dependency=process.env.PGLITE_MODULE_ROOT?pathToFileURL(`${process.env.PGLITE_MODULE_ROOT}/@electric-sql/pglite/dist/index.js`).href:'@electric-sql/pglite';
 const {PGlite}=await import(dependency),db=await PGlite.create();
 try{
  // SQL comes from the authenticated private backup of this application's own migrations.
  for(const migration of snapshot.schema)await db.exec(migration.sql);
  await db.exec(`TRUNCATE ${snapshot.tables.map(t=>identifier(t.name)).join(",")} CASCADE`);
  const constraints=await db.query(`SELECT conrelid::regclass::text AS tablename,conname FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace`);
  for(const row of constraints.rows)await db.exec(`ALTER TABLE ${row.tablename} ALTER CONSTRAINT ${identifier(row.conname)} DEFERRABLE INITIALLY DEFERRED`);
  await db.exec('BEGIN; SET CONSTRAINTS ALL DEFERRED');
  // Import the captured values without replaying application side effects. Foreign keys remain checked.
  for(const table of snapshot.tables)await db.exec(`ALTER TABLE ${identifier(table.name)} DISABLE TRIGGER USER`);
  for(const table of snapshot.tables){
   assert.equal(Number((await db.query(`SELECT count(*) n FROM ${identifier(table.name)}`)).rows[0].n),0,'Restore destination must be empty');
   for(const row of table.rows)await db.query(`INSERT INTO ${identifier(table.name)} SELECT * FROM json_populate_record(NULL::${identifier(table.name)},$1::json)`,[row]);
  }
  await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
  for(const table of snapshot.tables)await db.exec(`ALTER TABLE ${identifier(table.name)} ENABLE TRIGGER USER`);
  await db.exec('COMMIT');
  for(const table of snapshot.tables){const result=await db.query(`SELECT row_to_json(t)::text AS row FROM ${identifier(table.name)} t`);assert.equal(result.rows.length,table.rows.length,`${table.name}: row count`);assert.equal(backupChecksum(result.rows.map(r=>r.row)),table.checksum,`${table.name}: restored checksum`);}
  return {...stats,verified:true};
 }finally{await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const snapshot=JSON.parse(gunzipSync(await readFile(process.argv[2]),{maxOutputLength:150*1024*1024}).toString('utf8'));
 console.log(JSON.stringify(await verifyRestore(snapshot)));
}
