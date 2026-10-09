import test from 'node:test';
import assert from 'node:assert/strict';
import { hostelTimeZone, visitLocalTime, visitorOverdue, visitTransition } from '../src/lib/resident-policy';
import { systemGuide, searchSystemGuide } from '../src/lib/system-guide';
import { residentStaff, residentTenant } from '../src/lib/resident-access';
import type { PrismaClient } from '../src/generated/prisma/client';
test('visitor times use the property zone, including non-hour offsets',()=>{
 assert.equal(visitLocalTime('2026-10-09T14:30','Africa/Nairobi')?.toISOString(),'2026-10-09T11:30:00.000Z');
 assert.equal(visitLocalTime('2026-10-09T14:30','Asia/Kathmandu')?.toISOString(),'2026-10-09T08:45:00.000Z');
 assert.equal(hostelTimeZone(null,'KE'),'Africa/Nairobi');assert.equal(hostelTimeZone(null,'GB'),'UTC');
});
test('invalid, skipped and repeated local times are rejected',()=>{
 for(const [value,zone] of [['2026-02-30T10:00','UTC'],['2026-03-08T02:30','America/New_York'],['2026-11-01T01:30','America/New_York'],['2026-10-09T15:00','Invalid/Zone']])assert.equal(visitLocalTime(value,zone),null);
});
test('only verified checked-in visitors with an elapsed departure become overdue',()=>{
 const now=new Date('2026-10-09T10:00Z');for(const status of ['REQUESTED','APPROVED','CHECKED_OUT','CANCELLED','DENIED'])assert.equal(visitorOverdue({status,expectedDeparture:new Date('2026-10-09T09:00Z')},now),false);
 assert(visitorOverdue({status:'CHECKED_IN',expectedDeparture:new Date('2026-10-09T09:00Z')},now));
 assert.equal(visitorOverdue({status:'CHECKED_IN',expectedDeparture:now},now),false);
});
test('gate state transitions disallow false checkouts, reentry and tenant cancellation after arrival',()=>{
 assert(visitTransition('REQUESTED','CHECK_IN'));assert(visitTransition('APPROVED','CHECK_IN'));assert(visitTransition('CHECKED_IN','CHECK_OUT'));
 for(const [s,a] of [['REQUESTED','CHECK_OUT'],['CHECKED_OUT','CHECK_IN'],['CHECKED_IN','CANCEL'],['DENIED','CHECK_IN'],['CANCELLED','APPROVE'],['CHECKED_IN','APPROVE']])assert.equal(visitTransition(s,a),false);
});
test('public and tenant guide topics do not link to management functions',()=>{
 for(const role of ['PUBLIC','TENANT'] as const)for(const topic of systemGuide(role))assert(!/^\/(students|users|visitors|communications|healthfix)/.test(topic.href));
});
test('guide finds checkout procedures without inventing a current record',()=>{
 const results=searchSystemGuide(systemGuide('MANAGEMENT'),'Who has not checked out?');assert(results.some(r=>r.href==='/visitors?filter=OVERDUE'));
 assert.equal(searchSystemGuide(systemGuide('PUBLIC'),'zxqv999').length,0);
 assert(systemGuide('CARETAKER').every(t=>t.href!=='/students/registrations'&&t.href!=='/communications/inbox'));
});
test('current database session versions gate staff and tenant access',async()=>{
 const d={user:{findFirst:async()=>({id:'u',role:'OWNER',sessionVersion:2})},student:{findFirst:async()=>({id:'t',portalSessionVersion:3})}} as unknown as PrismaClient;
 const s={userId:'u',organizationId:'o',name:'U',role:'OWNER' as const,sessionVersion:1};assert.equal(await residentStaff(d,s),null);assert(await residentStaff(d,{...s,sessionVersion:2}));
 const t={studentId:'t',organizationId:'o',name:'T',sessionVersion:2};assert.equal(await residentTenant(d,t),null);assert(await residentTenant(d,{...t,sessionVersion:3}));
});
