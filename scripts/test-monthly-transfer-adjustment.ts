import assert from "node:assert/strict";
import type { Prisma } from "../src/generated/prisma/client";
import { applyChargeAmount } from "../src/lib/rent-calculation";
import { calculateMonthlyTransferRent } from "../src/lib/monthly-transfer-rent";

function financialFixture(startAmount:number, paymentAmount:number) {
  let amount=startAmount, baseAmount:number|null=null, status="UNPAID";
  const payments=[{amount:paymentAmount}], adjustments:unknown[]=[];
  const charge={id:"charge1", organizationId:"hostel1",currency:"KES",dueDate:new Date("2026-09-01T12:00:00Z")};
  const tx={
    charge:{
      findFirst:async ({where}:{where:{id:string;organizationId:string}})=>where.id===charge.id&&where.organizationId===charge.organizationId?{...charge,amount,baseAmount,payments}:null,
      findUnique:async ()=>({...charge,amount,payments}),
      update:async ({data}:{data:{amount?:number;baseAmount?:number;status?:string}})=>{if(data.amount!==undefined)amount=data.amount;if(data.baseAmount!==undefined)baseAmount=Number(data.baseAmount);if(data.status!==undefined)status=data.status;},
    },
    chargeAdjustment:{create:async ({data}:{data:unknown})=>{adjustments.push(data);}},
  } as unknown as Prisma.TransactionClient;
  return {tx,adjustments,payments,getState:()=>({amount,baseAmount,status})};
}
async function run(){
  const monthly=calculateMonthlyTransferRent({
    currency:"KES",firstMonth:"2026-09",lastMonth:"2026-12",
    stays:[{roomId:"60",startDate:new Date("2026-09-01T12:00:00Z"),monthlyRate:4500},
    {roomId:"54",startDate:new Date("2026-10-02T12:00:00Z"),monthlyRate:7000}],
  });
  assert.equal(monthly.total,25500);
  const increases=financialFixture(18000,14000);
  const increased=await applyChargeAmount(increases.tx,{organizationId:"hostel1",chargeId:"charge1",createdById:"owner1",reason:"ROOM_TRANSFER",calculationMethod:"STANDARD_RATE",newAmount:monthly.total,effectiveDate:new Date("2026-10-02T12:00:00Z"),explanation:"Room transfer effective October",calculationData:{method:"MONTHLY",months:monthly.lines}});
  assert.equal(increased.previousAmount,18000);
  assert.equal(increased.balance,11500);
  assert.equal(increases.getState().amount,25500);
  assert.equal(increases.getState().baseAmount,18000);
  assert.equal(increases.payments[0].amount,14000);
  assert.equal(increases.adjustments.length,1);
  const duplicate=await applyChargeAmount(increases.tx,{organizationId:"hostel1",chargeId:"charge1",createdById:"owner1",reason:"ROOM_TRANSFER",calculationMethod:"STANDARD_RATE",newAmount:monthly.total,effectiveDate:new Date("2026-10-02T12:00:00Z"),explanation:"Repeated amount"});
  assert.equal(duplicate.changed,false);
  assert.equal(increases.adjustments.length,1);

  const cheaper=financialFixture(28000,25000);
  const decrease=await applyChargeAmount(cheaper.tx,{organizationId:"hostel1",chargeId:"charge1",createdById:"owner1",reason:"ROOM_TRANSFER",calculationMethod:"STANDARD_RATE",newAmount:18000,effectiveDate:new Date("2026-10-02T12:00:00Z"),explanation:"Cheaper room"});
  assert.equal(decrease.credit,7000);
  assert.equal(decrease.paid,25000);
  assert.equal(cheaper.payments[0].amount,25000);
  assert.equal(cheaper.adjustments.length,1);
  console.log("Monthly-transfer adjustment mock checks passed");
}
run().catch((error)=>{ console.error(error); process.exitCode=1; });
