import test from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '../src/generated/prisma/client';
import {maintenanceRunStatus,maintenanceScheduleCheck,collectHealthfix,healthfixAuthorized,healthfixManager,repairHealthfix,runHealthfixMaintenance} from '../src/lib/healthfix';
const now=new Date('2026-10-08T04:00:00Z');
const env={NODE_ENV:'production',VERCEL_ENV:'production',SESSION_SECRET:'fake-long-session-secret',PLATFORM_PROVISIONING_SECRET:'fake',RESEND_API_KEY:'fake',RECEIPT_EMAIL_FROM:'hostel@example.invalid',CRON_SECRET:'fake',BLOB_READ_WRITE_TOKEN:'fake-storage'};
function reads(failure?:string, warning=false){const calls:{model:string;where:Record<string,unknown>}[]=[];const d:Record<string,unknown>={$queryRaw:async()=>{if(failure==='database')throw Error('PRIVATE_DATABASE_ERROR');return [{count:0}]},organization:{findMany:async()=>[{id:'one',createdAt:new Date('2026-10-01')}]},auditLog:{findMany:async()=>[{organizationId:'one',createdAt:now,metadata:{status:'COMPLETED'}}]}};for(const model of ['visitorRequest','tenantRegistration','bookingRequest','property','propertyPhoto','student','occupancy','charge','payment','studentTermsAcceptance','tenantMessage','tenantConversation','tenantPortalInvitation'])d[model]={count:async({where}:{where:Record<string,unknown>})=>{calls.push({model,where});if(model===failure)throw Error('PRIVATE_DATABASE_ERROR');return warning&&where.status==='SENDING'?1:0}};return{db:d as unknown as PrismaClient,calls};}
test('connector authentication rejects missing and wrong secrets',()=>{assert.equal(healthfixAuthorized(undefined,'x'),false);assert.equal(healthfixAuthorized('x',null),false);assert.equal(healthfixAuthorized('x','xx'),false);assert.equal(healthfixAuthorized('x','x'),true)});
test('healthy configuration does not claim unverified workflows healthy',async()=>{const f=reads();const report=await collectHealthfix(f.db,'one',now,env);assert.equal(report.status,'UNKNOWN');assert.equal(report.modules.find(m=>m.code==='email')?.status,'UNKNOWN');assert.equal(report.modules.find(m=>m.code==='provisioning')?.status,'UNKNOWN');for(const call of f.calls)assert.equal(call.where.organizationId,'one');assert.ok(report.modules.every(m=>m.status!=='HEALTHY'||m.checks.every(c=>c.status==='PASSING')))});
test('failed module read preserves other checks without leaking database details',async()=>{const report=await collectHealthfix(reads('occupancy').db,'one',now,env);assert.equal(report.modules.find(m=>m.code==='bookings')?.status,'DEGRADED');assert.equal(report.modules.find(m=>m.code==='database')?.status,'HEALTHY');assert.equal(report.status,'DEGRADED');assert.ok(!JSON.stringify(report).includes('PRIVATE_DATABASE_ERROR'))});
test('database outage yields degraded report instead of an invented healthy result',async()=>{const report=await collectHealthfix(reads('database').db,undefined,now,env);assert.equal(report.modules.find(m=>m.code==='database')?.status,'DEGRADED');assert.equal(report.status,'DEGRADED')});
test('missing configuration fails explicitly and report contains no configuration values',async()=>{const report=await collectHealthfix(reads().db,'one',now,{});assert.equal(report.status,'DEGRADED');assert.ok(!JSON.stringify(await collectHealthfix(reads().db,'one',now,env)).includes('fake-long-session-secret'))});
test('interrupted sends create warnings while fresh send cutoff and scope are explicit',async()=>{const f=reads(undefined,true);const report=await collectHealthfix(f.db,'one',now,env);assert.equal(report.modules.find(m=>m.code==='delivery-queues')?.status,'DEGRADED');const q=f.calls.find(c=>c.model==='tenantPortalInvitation'&&c.where.status==='SENDING')!;assert.equal(q.where.usedAt,null);assert.deepEqual(q.where.OR,[{attemptedAt:null},{attemptedAt:{lte:new Date(now.getTime()-900000)}}])});
function repairs(allowed=true,counts=[1,2,3]){const changes:{where:Record<string,unknown>;data:Record<string,unknown>}[]=[],audits:unknown[]=[];let n=0;const tx={tenantRegistration:{updateMany:async(a:typeof changes[number])=>{changes.push(a);return{count:counts[n++]??0}}},user:{findFirst:async()=>allowed?{id:'owner'}:null},organization:{findFirst:async()=>({id:'one'})},$queryRaw:async()=>[],$executeRaw:async()=>0,tenantPortalInvitation:{updateMany:async(a:typeof changes[number])=>{changes.push(a);return{count:counts[n++]??0}}},tenantMessage:{updateMany:async(a:typeof changes[number])=>{changes.push(a);return{count:counts[n++]??0}}},auditLog:{create:async(a:unknown)=>{audits.push(a)}}};const db={...tx,$transaction:async(fn:(tx:unknown)=>unknown)=>fn(tx)} as unknown as PrismaClient;return{db,changes,audits};}
const owner={userId:'owner',organizationId:'one',role:'OWNER' as const,name:'Owner'};
test('repair refuses inactive or revoked management and foreign organization before writes',async()=>{const f=repairs(false);await assert.rejects(repairHealthfix(f.db,'one',owner,now));assert.equal(f.changes.length,0);const g=repairs();await assert.rejects(repairHealthfix(g.db,'two',owner,now));assert.equal(g.changes.length,0)});
test('repair preserves delivery evidence, activated accounts and financial fields',async()=>{const f=repairs();assert.deepEqual(await repairHealthfix(f.db,'one',owner,now),{expiredRegistrations:0,interruptedInvitations:1,interruptedEmails:2,expiredInvitations:3});assert.equal(f.audits.length,1);for(const c of f.changes)assert.equal(c.where.organizationId,'one');assert.equal(f.changes[0].data.status,'REVIEW');assert.equal(f.changes[1].data.emailStatus,'REVIEW');assert.equal(f.changes[2].data.tokenHash,null);assert.deepEqual(f.changes[2].where.status,{not:'ACTIVATED'});assert.equal(f.changes[2].where.usedAt,null);assert.deepEqual(Object.keys(f.changes[0].data).sort(),['error','status']);assert.deepEqual(Object.keys(f.changes[1].data).sort(),['emailError','emailStatus'])});
test('no change creates no misleading repair audit',async()=>{const f=repairs(true,[0,0,0]);await repairHealthfix(f.db,'one',owner,now);assert.equal(f.audits.length,0)});
test('management authorization is checked against current database role and scope',async()=>{let where:unknown;const db={user:{findFirst:async(a:{where:unknown})=>{where=a.where;return null}}} as unknown as PrismaClient;assert.equal(await healthfixManager(db,null),null);await healthfixManager(db,owner);assert.deepEqual(where,{id:'owner',organizationId:'one',active:true,role:{in:['OWNER','ADMIN']}})});
test('maintenance continues to later organizations when one repair fails',async()=>{let calls=0;const f=repairs(true,[0,0,0]);const db={...f.db,auditLog:{create:async()=>({id:"run"}),update:async()=>({})},organization:{findMany:async()=>[{id:'one'},{id:'two'}]},$transaction:async()=>{calls++;if(calls===1)throw Error('failure');return{interruptedInvitations:1,interruptedEmails:0,expiredInvitations:0}}} as unknown as PrismaClient;assert.deepEqual(await runHealthfixMaintenance(db,now),{checked:2,changed:1,failed:1})});

type RunAudit = { data: { organizationId?: string; metadata: Record<string, unknown> }; where?: { id: string } };
test('daily no-op run persists start and completion with zero counts',async()=>{
 const f=repairs(true,[0,0,0]); const records: RunAudit[]=[];
 const db={...f.db,organization:{findMany:async()=>[{id:'one'}]},auditLog:{create:async(a:RunAudit)=>{records.push(a);return{id:'run-one'}},update:async(a:RunAudit)=>{records.push(a);return{}}}} as unknown as PrismaClient;
 assert.deepEqual(await runHealthfixMaintenance(db,now),{checked:1,changed:0,failed:0});
 assert.equal(records[0].data.organizationId,'one'); assert.equal(records[0].data.metadata.status,'RUNNING');
 assert.equal(records[1].where!.id,'run-one'); assert.equal(records[1].data.metadata.status,'COMPLETED'); assert.equal(records[1].data.metadata.expiredInvitations,0);
});
test('failed repairs persist sanitized failure and continue processing',async()=>{
 const records:RunAudit[]=[]; let calls=0;
 const db={organization:{findMany:async()=>[{id:'one'},{id:'two'}]},auditLog:{create:async(a:RunAudit)=>({id:a.data.organizationId}),update:async(a:RunAudit)=>{records.push(a);return{}}},$transaction:async()=>{if(++calls===1)throw Error('SECRET_CONNECTION');return{interruptedInvitations:0,interruptedEmails:0,expiredInvitations:0}}} as unknown as PrismaClient;
 assert.deepEqual(await runHealthfixMaintenance(db,now),{checked:2,changed:0,failed:1});assert.equal(records[0].data.metadata.status,'FAILED');assert.equal(records[1].data.metadata.status,'COMPLETED');assert.ok(!JSON.stringify(records).includes('SECRET_CONNECTION'));
});
test('unavailable start receipt prevents unrecorded repairs',async()=>{
 let repaired=false;const db={organization:{findMany:async()=>[{id:'one'}]},auditLog:{create:async()=>{throw Error('unavailable')}},$transaction:async()=>{repaired=true}} as unknown as PrismaClient;
 assert.deepEqual(await runHealthfixMaintenance(db,now),{checked:1,changed:0,failed:1});assert.equal(repaired,false);
});

test('daily receipt checks use Nairobi schedule and grace, including first missing run',()=>{
 const created=new Date('2026-10-01');
 assert.equal(maintenanceRunStatus(created,undefined,new Date('2026-10-08T07:00:00Z')),'WARNING');
 const yesterday={createdAt:new Date('2026-10-07T05:00:00Z'),metadata:{status:'COMPLETED'}};
 assert.equal(maintenanceRunStatus(created,yesterday,new Date('2026-10-08T06:59:59Z')),'PASSING');
 assert.equal(maintenanceRunStatus(created,yesterday,new Date('2026-10-08T07:00:00Z')),'WARNING');
 assert.equal(maintenanceRunStatus(new Date('2026-10-08T06:00:00Z'),undefined,new Date('2026-10-08T07:00:00Z')),'PASSING');
 for(const [metadata,expected] of [[{status:'FAILED'},'FAILING'],[{status:'RUNNING'},'WARNING'],[{status:'INVALID'},'UNKNOWN'],[{status:'COMPLETED'},'PASSING']] as const)
 assert.equal(maintenanceRunStatus(created,{createdAt:new Date('2026-10-08T05:00:00Z'),metadata},new Date('2026-10-08T07:00:00Z')),expected);
});
test('schedule report isolates landlords and fails unknown when receipt reads fail',async()=>{
 let orgWhere:unknown,runWhere:unknown;
 const db={organization:{findMany:async(a:{where:unknown})=>{orgWhere=a.where;return[{id:'one',createdAt:new Date('2026-10-01')}]}},auditLog:{findMany:async(a:{where:unknown})=>{runWhere=a.where;return[]}}} as unknown as PrismaClient;
 assert.equal((await maintenanceScheduleCheck(db,'one',now)).status,'WARNING');
 assert.deepEqual(orgWhere,{status:'ACTIVE',id:'one'});assert.deepEqual(runWhere,{organizationId:{in:['one']},action:'HEALTHFIX_MAINTENANCE_RUN'});
 const failing={organization:{findMany:async()=>{throw Error('PRIVATE')}}} as unknown as PrismaClient;
 assert.equal((await maintenanceScheduleCheck(failing,'one',now)).status,'UNKNOWN');
});
test('integrity anomalies warn without exposing record identities',async()=>{
 const f=reads();f.db.$queryRaw=(async(strings:TemplateStringsArray,...values:unknown[])=>{if(strings.join('').includes('COUNT')){assert.deepEqual(values,['one','one']);return[{count:1}]};return[]}) as typeof f.db.$queryRaw;
 const report=await collectHealthfix(f.db,'one',now,env);
 assert.equal(report.modules.find(m=>m.code==='record-integrity')?.status,'DEGRADED');
 assert.ok(!JSON.stringify(report).includes('studentId'));
});

test('expired registration credentials are cleared without touching activated tenant accounts',async()=>{const f=repairs(true,[0,0,0,2]);const result=await repairHealthfix(f.db,'one',owner,now);assert.equal(result.expiredRegistrations,2);assert.deepEqual(f.changes[3],{where:{organizationId:'one',status:'PENDING',expiresAt:{lte:now}},data:{status:'EXPIRED',passwordHash:null}})});
