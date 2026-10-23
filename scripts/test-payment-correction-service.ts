import assert from "node:assert/strict";
import { mock } from "node:test";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import type { SessionPayload } from "../src/lib/auth/session";
import { correctRecordedPaymentAmount } from "../src/lib/payment-amount-correction";
import { refreshChargeStatus } from "../src/lib/payment-balance";

const session: SessionPayload={
  userId:"owner",organizationId:"hostel",name:"Owner",role:"OWNER",sessionVersion:1,
};
const original={
  id:"payment-40",organizationId:"hostel",studentId:"student-1",
  chargeId:"charge-1",currency:"KES",amount:9500,
  paidAt:new Date("2026-10-06T12:00:00.000Z"),method:"MPESA" as const,
  reference:"UJ6HV8P5V0",receiptNumber:"MMH-2026-00040",
  reversedAt:null as Date|null,mpesaTransaction:null,
};
let activePayments=[{amount:4500},{amount:9500}];
let paymentReversed=false;
let newPayment:Record<string,unknown>|null=null;
let chargeStatus="PARTIALLY_PAID";
let auditEvents:Array<Record<string,unknown>>=[];
let nextSequence=43;
const mockTx={
  $queryRaw:async()=>[{id:"hostel"}],
  user:{findFirst:async()=>({id:"owner"})},
  payment:{
    findFirst:async ({where}:{where:{id?:string;method?:string}})=>{
      if(where.id===original.id)return {...original,reversedAt:paymentReversed?new Date():null};
      if(where.method==="MPESA")return null;
      return null;
    },
    updateMany:async()=>{if(paymentReversed)return {count:0};paymentReversed=true;return {count:1};},
    create:async ({data}:{data:Record<string,unknown>})=>{
      newPayment={id:"payment-43",...data};
      activePayments=[{amount:4500},{amount:Number(data.amount)}];
      return newPayment;
    },
  },
  mpesaTransaction:{findUnique:async()=>null},
  charge:{
    findFirst:async()=>({
      id:"charge-1",organizationId:"hostel",studentId:"student-1",
      amount:28000,currency:"KES",status:chargeStatus,
      dueDate:new Date("2026-10-20T12:00:00.000Z"),payments:activePayments,
    }),
    findUnique:async()=>({
      id:"charge-1",amount:28000,currency:"KES",status:chargeStatus,
      dueDate:new Date("2026-10-20T12:00:00.000Z"),payments:activePayments,
    }),
    update:async ({data}:{data:{status:string}})=>{chargeStatus=data.status;return {};},
  },
  organization:{findUnique:async()=>({receiptPrefix:"MMH"})},
  receiptSequence:{upsert:async()=>({lastIssued:nextSequence++})},
  auditLog:{createMany:async ({data}:{data:Array<Record<string,unknown>>})=>{
    auditEvents=data;return {count:data.length};
  }},
};
const db={
  $transaction:async (fn:(tx:typeof mockTx)=>Promise<unknown>)=>fn(mockTx),
} as unknown as PrismaClient;

async function run() {
  // This fixture is before the charge deadline regardless of the build date.
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-10T12:00:00.000Z") });
  const updated=await correctRecordedPaymentAmount(db,session,{
    paymentId:original.id,originalAmount:9500,
    correctedAmount:9000,reason:"Confirmed original receipt was overstated by KES 500",
  });
  assert.equal(updated.receiptNumber,"MMH-2026-00043");
  assert.equal(updated.paidAfter,13500);
  assert.equal(updated.balanceAfter,14500);
  assert.equal(paymentReversed,true);
  assert.equal(newPayment?.["amount"],9000);
  assert.equal(newPayment?.["reference"],"UJ6HV8P5V0");
  assert.equal(newPayment?.["chargeId"],"charge-1");
  assert.equal(newPayment?.["studentId"],"student-1");
  assert.equal(newPayment?.["paidAt"],original.paidAt);
  assert.equal(typeof newPayment?.["integrityHash"],"string");
  assert.equal((newPayment?.["integrityHash"] as string).length,64);
  assert.equal(auditEvents.length,2);
  assert.deepEqual(auditEvents.map(x=>x.action),[
    "PAYMENT_REVERSED_INTERNAL","PAYMENT_RECORDED_INTERNAL_CORRECTION",
  ]);
  assert.equal(chargeStatus,"PARTIALLY_PAID");
  assert.deepEqual(activePayments,[{amount:4500},{amount:9000}]);

  await assert.rejects(()=>correctRecordedPaymentAmount(db,session,{
    paymentId:original.id,originalAmount:9500,
    correctedAmount:9000,reason:"Try repeating the same correction",
  }),/PAYMENT_ALREADY_REVERSED/);
  assert.equal(nextSequence,44,"A repeat must never consume another receipt number.");
  assert.equal(auditEvents.length,2);
  mock.timers.setTime(Date.parse("2026-10-21T12:00:00.000Z"));
  await refreshChargeStatus(mockTx as unknown as Prisma.TransactionClient, "charge-1");
  assert.equal(chargeStatus,"OVERDUE","The same unpaid balance becomes overdue after its deadline.");
  console.log("Atomic payment correction mock and retry safeguards passed");
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>mock.timers.reset());
