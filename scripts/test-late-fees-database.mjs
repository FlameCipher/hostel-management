import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client.ts';
import {readLateFees,runLateFees} from '../src/lib/late-fees.ts';
import {readArrears} from '../src/lib/arrears-reminders.ts';
import {currentTermsContext} from '../src/lib/hostel-terms/service.ts';
import {termsHash,TERMS_VERSION} from '../src/lib/hostel-terms/policy.ts';
const dep=name=>process.env.PGLITE_MODULE_ROOT?pathToFileURL(`${process.env.PGLITE_MODULE_ROOT}/@electric-sql/${name}/dist/index.js`).href:`@electric-sql/${name}`;
const {PGlite}=await import(dep('pglite'));
const {PGLiteSocketServer}=await import(dep('pglite-socket'));
const pg=await PGlite.create();
for(const name of (await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort())await pg.exec(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));
await pg.exec(`
INSERT INTO "Organization" (id,name,"ownerName",phone,"updatedAt") VALUES ('mama-mbugua-hostel','Late Fee Fixture','Owner','0714000001',now()),('other','Foreign Fixture','Owner','0714000002',now());
INSERT INTO "Property" (id,"organizationId",slug,name,"countryCode","timeZone","updatedAt") VALUES ('property','mama-mbugua-hostel','fee-fixture','Fixture','KE','Africa/Nairobi',now());
INSERT INTO "Student" (id,"organizationId","fullName",phone,"admittedAt","portalEnabled","portalPasswordHash","updatedAt") VALUES ('student','mama-mbugua-hostel','Fixture resident','0714000003',now(),true,'original',now());
INSERT INTO "RoomType" (id,"organizationId",name,"sharingMode","defaultCapacity","monthlyRate","semesterRate","updatedAt") VALUES ('type','mama-mbugua-hostel','Single','PRIVATE',1,6000,18000,now());
INSERT INTO "Room" (id,"organizationId","propertyId","roomTypeId",number,"numberKey","floorKey","updatedAt") VALUES ('room','mama-mbugua-hostel','property','type','1','1','',now());
INSERT INTO "Semester" (id,"organizationId",name,"startDate","endDate","updatedAt") VALUES ('term','mama-mbugua-hostel','Fixture term','2026-09-01','2026-12-31',now());
INSERT INTO "Occupancy" (id,"organizationId","semesterId","studentId","roomId","checkInAt","updatedAt") VALUES ('stay','mama-mbugua-hostel','term','student','room',now(),now());
`);
const server=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:55466,maxConnections:20});await server.start();
const db=new PrismaClient({adapter:new PrismaPg({connectionString:'postgresql://fixture:fixture@127.0.0.1:55466/fixture',max:1})});
const org='mama-mbugua-hostel',acceptDate=new Date('2026-11-01T06:00Z'),after=new Date('2026-11-11T05:00Z');
const pass=name=>console.log('PASS '+name);
try {
 await db.charge.create({data:{id:'rent',organizationId:org,studentId:'student',semesterId:'term',occupancyId:'stay',description:'Semester rent',amount:18000,dueDate:new Date('2026-10-05'),status:'OVERDUE'}});
 assert.equal((await readLateFees(db,org,after))[0].state,'Awaiting student acceptance');assert.equal((await runLateFees(db,after)).created,0);assert.deepEqual(await readLateFees(db,'other',after),[]);pass('no unsigned charges or foreign-hostel rules');
 const context=await currentTermsContext(db,{organizationId:org,studentId:'student',name:'Fixture'},acceptDate);
 const snapshot=context.snapshot,reference='FIXTURE-TERMS',signatureName='Fixture resident';
 await db.studentTermsAcceptance.create({data:{id:'terms',organizationId:org,studentId:'student',occupancyId:'stay',version:TERMS_VERSION,reference,signatureName,acceptedAt:acceptDate,snapshot,integrityHash:termsHash(snapshot,signatureName,acceptDate,reference)}});
 assert.equal((await runLateFees(db,new Date('2026-11-10T20:59:59Z'))).created,0);pass('no backdating and whole Nairobi deadline day respected');
 await db.student.update({where:{id:'student'},data:{paymentAgreedDate:new Date('2026-11-20')}});
 assert.equal((await runLateFees(db,after)).created,0);assert.equal((await readLateFees(db,org,after))[0].deadline,'2026-11-20');pass('approved extensions override automatic deadline');
 await db.student.update({where:{id:'student'},data:{paymentAgreedDate:null}});
 await db.payment.create({data:{id:'partial',organizationId:org,studentId:'student',chargeId:'rent',amount:4500,paidAt:acceptDate,method:'CASH',receiptNumber:'FIXTURE-PARTIAL'}});
 let rows=await readLateFees(db,org,after);assert.equal(rows[0].basis,13500);assert.equal(rows[0].fee,1350);
 // An invalid signature must never authorize charging.
 const hash=termsHash(snapshot,signatureName,acceptDate,reference);
 await db.studentTermsAcceptance.update({where:{id:'terms'},data:{integrityHash:'tampered'}});assert.equal((await runLateFees(db,after)).created,0);
 await db.studentTermsAcceptance.update({where:{id:'terms'},data:{integrityHash:hash}});pass('signed snapshot integrity and partial-payment basis');
 // A paid account is excluded even with an out-of-date OVERDUE status.
 await db.payment.create({data:{id:'settle',organizationId:org,studentId:'student',chargeId:'rent',amount:13500,paidAt:acceptDate,method:'CASH',receiptNumber:'FIXTURE-SETTLE'}});assert.equal((await runLateFees(db,after)).created,0);
 await db.payment.update({where:{id:'settle'},data:{reversedAt:after}});pass('cleared rent excluded and reversed payment not counted');
 await pg.exec(`CREATE FUNCTION fixture_fail_fee_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'RENT_LATE_FEE_APPLIED' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_fee_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fixture_fail_fee_audit();`);
 await assert.rejects(runLateFees(db,after));assert.equal(await db.charge.count({where:{lateFeeForChargeId:'rent'}}),0);
 await pg.exec('DROP TRIGGER fixture_fee_audit ON "AuditLog"; DROP FUNCTION fixture_fail_fee_audit();');pass('audit failure rolls back fee posting');
 await Promise.all([runLateFees(db,after),runLateFees(db,after)]);
 const fee=await db.charge.findUnique({where:{lateFeeForChargeId:'rent'}});assert.ok(fee);assert.equal(Number(fee.amount),1350);assert.equal(Number(fee.lateFeeBasis),13500);assert.equal(fee.type,'OTHER');assert.equal(fee.lateFeeTermsId,'terms');assert.equal(await db.auditLog.count({where:{action:'RENT_LATE_FEE_APPLIED'}}),1);
 assert.equal((await runLateFees(db,new Date('2027-02-11'))).created,0);pass('concurrent and later retries cannot duplicate or compound a fee');
 await db.charge.update({where:{id:fee.id},data:{status:'WAIVED'}});assert.equal((await runLateFees(db,after)).created,0);pass('waived fee never reappears');
 const notices=await readArrears(db,org,after);assert.match(notices.rows[0].message,/Notice date: 11 Nov 2026/);assert.match(notices.rows[0].message,/waived/);assert.doesNotMatch(notices.rows[0].message,/\[date\]|\[deadline\]/i);pass('live demand dates and fee status derive from ledger');
 await db.charge.create({data:{organizationId:org,studentId:'student',semesterId:'term',occupancyId:'stay',description:'Damage charge',type:'DAMAGE',amount:1000,dueDate:new Date('2026-10-05')}});assert.equal((await runLateFees(db,after)).created,0);pass('damage and other non-rent balances never attract fee');
} finally {await db.$disconnect();await server.stop();await pg.close();}
