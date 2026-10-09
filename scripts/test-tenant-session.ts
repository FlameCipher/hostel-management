import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../src/generated/prisma/client';
import { currentTenantSession } from '../src/lib/tenant-session-access';

const claims = { studentId: 'student-a', organizationId: 'hostel-a', name: 'Old name', sessionVersion: 2 };
function fixture() {
  const row = { id: 'student-a', organizationId: 'hostel-a', fullName: 'Current name', portalSessionVersion: 2, portalEnabled: true, portalPasswordHash: 'test-only-hash', status: 'ACTIVE', organizationStatus: 'ACTIVE' };
  let reads = 0;
  const database = { student: { findFirst: async ({where}:{where:Record<string,unknown>}) => {
    reads++;
    assert.deepEqual(where, {id:claims.studentId, organizationId:claims.organizationId, portalEnabled:true, portalPasswordHash:{not:null}, status:{not:'ARCHIVED'}, organization:{status:'ACTIVE'}});
    return row.id === where.id && row.organizationId === where.organizationId && row.portalEnabled && row.portalPasswordHash && row.status !== 'ARCHIVED' && row.organizationStatus === 'ACTIVE' ? row : null;
  } } } as unknown as PrismaClient;
  return { row, database, get reads(){ return reads; } };
}
test('malformed tenant claims are rejected before database access', async () => {
  const f = fixture();
  for (const value of [null, {}, {...claims,studentId:''}, {...claims,organizationId:'x'.repeat(129)}, {...claims,sessionVersion:null}, {...claims,sessionVersion:-1}, {...claims,sessionVersion:1.5}]) assert.equal(await currentTenantSession(f.database,value),null);
  assert.equal(f.reads,0);
});
test('current tenant session returns the current account name and version', async () => {
  const f=fixture(); assert.deepEqual(await currentTenantSession(f.database,claims),{...claims,name:'Current name'});
});
for(const change of [{portalEnabled:false},{portalPasswordHash:null},{status:'ARCHIVED'},{organizationStatus:'SUSPENDED'},{organizationStatus:'CANCELLED'},{id:'foreign-student'},{organizationId:'foreign-hostel'}])test('unavailable or foreign tenant account is denied '+JSON.stringify(change),async()=>{
  const f=fixture();Object.assign(f.row,change);assert.equal(await currentTenantSession(f.database,claims),null);
});
test('older and future session versions cannot authenticate',async()=>{
  const f=fixture();for(const sessionVersion of [0,1,3,100])assert.equal(await currentTenantSession(f.database,{...claims,sessionVersion}),null);
});
test('legacy cookies work only for an unchanged version-zero account',async()=>{
  const f=fixture();const legacy={studentId:claims.studentId,organizationId:claims.organizationId,name:claims.name};
  f.row.portalSessionVersion=0;assert.ok(await currentTenantSession(f.database,legacy));
  f.row.portalSessionVersion=1;assert.equal(await currentTenantSession(f.database,legacy),null);
});
test('checked-out students retain permitted statement access when their portal remains enabled',async()=>{
  const f=fixture();f.row.status='CHECKED_OUT';assert.ok(await currentTenantSession(f.database,claims));
});
