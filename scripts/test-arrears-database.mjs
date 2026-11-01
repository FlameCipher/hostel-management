import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client.ts';
import {readArrears,requestArrears,setArrearsAutomation,runArrearsAutomation} from '../src/lib/arrears-reminders.ts';
import {savePaymentAgreement} from '../src/lib/payment-agreements.ts';
import {actOnManualNotification} from '../src/lib/whatsapp-communications.ts';
import {runWhatsAppDelivery} from '../src/lib/whatsapp-cloud.ts';
import {sendCommunicationEmails} from '../src/lib/communication-email.ts';
const dep = name => process.env.PGLITE_MODULE_ROOT ? pathToFileURL(`${process.env.PGLITE_MODULE_ROOT}/@electric-sql/${name}/dist/index.js`).href : `@electric-sql/${name}`;
const { PGlite } = await import(dep('pglite'));
const { PGLiteSocketServer } = await import(dep('pglite-socket'));
const pg = await PGlite.create();
const migrations = (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort();
for (const name of migrations) await pg.exec(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
await pg.exec(`
INSERT INTO "Organization" (id,name,"ownerName",phone,"updatedAt") VALUES ('one','Recovery Fixture','Owner','0714000001',now()),('two','Other Fixture','Other owner','0714000002',now());
INSERT INTO "Property" (id,"organizationId",slug,name,"customDomain","publicListing","updatedAt") VALUES ('p-one','one','recovery','Recovery Fixture','recovery.studentshostels.com',true,now()),('p-two','two','other','Other Fixture','other.studentshostels.com',true,now());
INSERT INTO "User" (id,"organizationId",name,email,"passwordHash",role,"updatedAt") VALUES ('owner','one','Owner','owner@example.invalid','original','OWNER',now()),('staff','one','Staff','staff@example.invalid','original','MANAGER',now()),('other-owner','two','Other owner','owner@example.invalid','original','OWNER',now());
INSERT INTO "Student" (id,"organizationId","fullName",phone,email,"admittedAt","portalEnabled","portalPasswordHash","updatedAt") VALUES ('student','one','Fixture resident','0714000003','resident@example.invalid',now(),true,'original',now());
INSERT INTO "RoomType" (id,"organizationId",name,"sharingMode","defaultCapacity","monthlyRate","semesterRate","updatedAt") VALUES ('type','one','Single','PRIVATE',1,100,400,now());
INSERT INTO "Room" (id,"organizationId","propertyId","roomTypeId",number,"numberKey","floorKey","updatedAt") VALUES ('room','one','p-one','type','1','1','',now());
INSERT INTO "Semester" (id,"organizationId",name,"startDate","endDate","updatedAt") VALUES ('term','one','Fixture term',now(),now()+interval '3 months',now());
INSERT INTO "Occupancy" (id,"organizationId","semesterId","studentId","roomId","checkInAt","updatedAt") VALUES ('stay','one','term','student','room',now(),now());
`);
const server = new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:55464,maxConnections:20}); await server.start();
const db = new PrismaClient({adapter:new PrismaPg({connectionString:'postgresql://fixture:fixture@127.0.0.1:55464/recovery',max:1})});

const now=new Date(), old=new Date(now.getTime()-86400000*10), owner={userId:'owner',organizationId:'one',name:'Owner',role:'OWNER',sessionVersion:0};
const pass=name=>console.log('PASS '+name);
const pay=amount=>db.payment.create({data:{organizationId:'one',studentId:'student',chargeId:'charge',amount,paidAt:now,method:'CASH',receiptNumber:randomUUID(),createdAt:new Date(old.getTime()-1)}});
async function payload(extra={}){const row=(await readArrears(db,'one',now)).rows[0];return{requestId:randomUUID(),recipients:[{studentId:row.studentId,fingerprint:row.fingerprint}],whatsapp:true,email:true,...extra};}
try{
 await db.property.update({where:{id:'p-one'},data:{countryCode:'KE',timeZone:'Africa/Nairobi'}});
 await db.charge.create({data:{id:'charge',organizationId:'one',studentId:'student',semesterId:'term',description:'Fixture rent',type:'SEMESTER_RENT',amount:18000,dueDate:old,status:'OVERDUE'}});
 await pay(4500);
 let list=await readArrears(db,'one',now);assert.equal(list.rows.length,1);assert.equal(list.rows[0].amount,13500);assert.equal((await readArrears(db,'two',now)).rows.length,0);pass('register uses actual ledger and isolates hostel scope');
 const stale=await payload();await pay(1000);assert.match((await requestArrears(db,owner,stale,now)).error,/changed/);assert.equal(await db.tenantMessage.count(),0);pass('payment after preview rejects stale request');
 const current=await payload();assert.ok((await requestArrears(db,null,current,now)).error);assert.ok((await requestArrears(db,{...owner,organizationId:'two'},current,now)).error);assert.ok((await requestArrears(db,{...owner,sessionVersion:1},current,now)).error);assert.equal(await db.tenantMessage.count(),0);pass('auth, hostel and revoked-session guards');
 const pair=await Promise.all([requestArrears(db,owner,current,now),requestArrears(db,owner,current,now)]);assert.ok(pair.every(p=>!p.error));assert.equal(await db.tenantMessage.count(),1);assert.equal(await db.notification.count(),1);pass('concurrent repeated requests create one notice and one WhatsApp copy');
 let note=await db.notification.findFirst();await pay(500);const opened=await actOnManualNotification(db,owner,note.id,'OPEN');assert.ok(opened.url);assert.match(decodeURIComponent(opened.url),/KES 12,000.00/);pass('manual WhatsApp refreshes the latest partial balance');
 await pay(12000);await db.notification.update({where:{id:note.id},data:{status:'QUEUED'}});assert.ok((await actOnManualNotification(db,owner,note.id,'OPEN')).error);assert.equal((await db.notification.findUnique({where:{id:note.id}})).status,'CANCELLED');
 let emails=0;const fetcher=async()=>{emails++;return Response.json({id:'mock-email'});};await sendCommunicationEmails(db,now,fetcher,{apiKey:'fixture',from:'hostel@example.invalid'});assert.equal(emails,0);assert.equal((await db.tenantMessage.findFirst()).emailStatus,'CANCELLED');pass('paid account cancels queued WhatsApp and email without contacting providers');
 await setArrearsAutomation(db,owner,{enabled:true,whatsapp:true,email:false});assert.equal((await runArrearsAutomation(db,new Date(now.getTime()+86400000))).created,0);pass('automatic requests stop when paid');
 await db.payment.updateMany({where:{amount:12000},data:{reversedAt:now}});
 assert.equal((await runArrearsAutomation(db,new Date(now.getTime()+6*86400000))).created,0);
 assert.equal((await runArrearsAutomation(db,new Date(now.getTime()+7*86400000))).created,1);assert.equal((await runArrearsAutomation(db,new Date(now.getTime()+7*86400000))).created,0);pass('weekly automation respects recent manual requests and deduplicates cron retries');
 const notices=await db.tenantMessage.findMany({orderBy:{createdAt:'asc'}});assert.equal(notices.length,2);
 // Test the real cloud queue with a fake provider. Old notices are eligible by sender/consent dates but expire before sending.
 Object.assign(process.env,{WHATSAPP_APP_SECRET:'fixture',WHATSAPP_WEBHOOK_VERIFY_TOKEN:'fixture',SERVICE_ENCRYPTION_KEY:'11'.repeat(32)});
 await db.whatsAppConnection.create({data:{organizationId:'one',phoneNumberId:'fixture-phone',displayPhone:'+254714000001',apiVersion:'v24.0',businessAccountId:'fixture',accessToken:'unused-fake-provider',templateName:'fixture',enabled:true,verifiedAt:old}});
 await db.whatsAppConsent.create({data:{id:'consent',organizationId:'one',accountId:'student',audience:'tenant',phone:'254714000003',enabled:true,consentText:'Fixture only',updatedAt:old}});
 let sends=0;const sender=async(_connection,_recipient,message)=>{sends++;assert.match(message,/KES 12,000.00/);return 'fixture-provider-'+sends;};
 await db.notification.update({where:{id:note.id},data:{status:'QUEUED'}});
 await runWhatsAppDelivery(db,sender,new Date(now.getTime()+7*86400000+10000));assert.equal(sends,1);assert.equal((await db.notification.findUnique({where:{id:note.id}})).status,'CANCELLED');
 await runWhatsAppDelivery(db,sender,new Date(now.getTime()+7*86400000+20000));assert.equal(sends,1);pass('cloud delivery discards stale backlog and sends a fresh request only once');
 // A portal-only request can be forwarded later without duplicating the inbox notice.
 await db.tenantMessage.deleteMany();await db.notification.deleteMany();await db.whatsAppDelivery.deleteMany();
 await requestArrears(db,owner,await payload({whatsapp:false,email:false}),now);assert.equal(await db.notification.count(),0);
 const forward=await requestArrears(db,owner,await payload({manual:true,email:false}),now);assert.ok(forward.notificationId);assert.equal(await db.tenantMessage.count(),1);assert.equal(await db.notification.count(),1);pass('later WhatsApp forwarding adds the missing copy to the existing notice');

 const beforeAgreement=await payload();
 const agreement={studentId:'student',date:new Date(now.getTime()+2*86400000).toISOString().slice(0,10),note:'Student and management agreed to the new date.',expectedUpdatedAt:'',clear:false,confirmed:true};
 assert.ok((await savePaymentAgreement(db,null,agreement,now)).error);
 assert.ok((await savePaymentAgreement(db,{...owner,organizationId:'two'},agreement,now)).error);
 assert.ok((await savePaymentAgreement(db,{...owner,sessionVersion:1},agreement,now)).error);
 assert.ok((await savePaymentAgreement(db,owner,{...agreement,confirmed:false},now)).error);
 assert.ok((await savePaymentAgreement(db,owner,agreement,now)).success);
 assert.ok((await savePaymentAgreement(db,owner,agreement,now)).error);
 const deferred=await readArrears(db,'one',now);assert.equal(deferred.rows.length,0);assert.equal(deferred.deferred.length,1);assert.equal(deferred.deferred[0].agreedDate,agreement.date);
 assert.ok((await requestArrears(db,owner,beforeAgreement,now)).error);
 assert.equal((await runArrearsAutomation(db,now)).created,0);
 const messagesBefore=await db.tenantMessage.count();
 await db.tenantMessage.updateMany({data:{emailCopy:true,emailStatus:'QUEUED'}});
 let agreementEmails=0;await sendCommunicationEmails(db,now,async()=>{agreementEmails++;return Response.json({id:'must-not-send'});},{apiKey:'fixture',from:'hostel@example.invalid'});
 assert.equal(agreementEmails,0);
 assert.ok((await actOnManualNotification(db,owner,forward.notificationId,'OPEN')).error);
 assert.equal((await db.notification.findUnique({where:{id:forward.notificationId}})).status,'CANCELLED');
 assert.equal(await db.tenantMessage.count(),messagesBefore);
 assert.equal((await readArrears(db,'one',new Date(now.getTime()+3*86400000))).rows.length,1);
 assert.equal(await db.auditLog.count({where:{action:'PAYMENT_AGREEMENT_RECORDED',entityId:'student'}}),1);
 assert.ok((await savePaymentAgreement(db,owner,{...agreement,clear:true,expectedUpdatedAt:now.toISOString(),note:'Arrangement removed by management.'},new Date(now.getTime()+1))).success);
 assert.equal((await readArrears(db,'one',now)).rows.length,1);
 pass('approved dates enforce auth, scope, stale-review rejection, automatic exclusion, queued email and WhatsApp cancellation, expiry and audited removal');
 await db.occupancy.update({where:{id:'stay'},data:{status:'CHECKED_OUT'}});assert.equal((await readArrears(db,'one',now)).rows.length,0);assert.ok((await actOnManualNotification(db,owner,forward.notificationId,'OPEN')).error);pass('former tenant is excluded and pending forwarding is cancelled');
 console.log('All arrears integration checks passed; only synthetic records and mocked delivery providers were used.');
}finally{await db.$disconnect();await server.stop();await pg.close();}
