import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calculateMonthlyTransferRent } from "../src/lib/monthly-transfer-rent";
import { roundCurrency } from "../src/lib/currency";

if (process.env.DATA_AUDIT_CONFIRM !== "READ_ONLY") throw Error("Set DATA_AUDIT_CONFIRM=READ_ONLY");
const url=process.env.PRODUCTION_DATABASE_URL ?? process.env.DB_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw Error("Database connection is required");
const organizationId=process.env.AUDIT_ORGANIZATION_ID;
const studentId=process.env.AUDIT_STUDENT_ID;
if (!organizationId || !studentId) throw Error("Set AUDIT_ORGANIZATION_ID and AUDIT_STUDENT_ID; do not use name-only matching");
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url})});
try {
  const student=await db.student.findFirst({
    where:{id:studentId,organizationId},
    select:{id:true,fullName:true,occupancies:{
      where:{organizationId},select:{id:true,semester:{select:{name:true,startDate:true,endDate:true}},room:{select:{number:true}},roomStays:{orderBy:{startDate:"asc"},select:{roomId:true,startDate:true,endDate:true,monthlyRateSnapshot:true,room:{select:{number:true}}}},charges:{where:{type:"SEMESTER_RENT"},select:{id:true,amount:true,currency:true,description:true,adjustments:{orderBy:{createdAt:"asc"},select:{reason:true,previousAmount:true,newAmount:true,effectiveDate:true}},payments:{where:{reversedAt:null},select:{amount:true}}}}}
    }}
  });
  if(!student) throw Error("Student not found in authorized organization");
  const reports=student.occupancies.map(occupancy=>{
    const semester=occupancy.semester;
    const firstMonth=semester.startDate.toISOString().slice(0,7);
    const lastMonth=semester.endDate.toISOString().slice(0,7);
    const charges=occupancy.charges.map(charge=>{
      const paid=roundCurrency(charge.payments.reduce((sum,p)=>sum+Number(p.amount),0),charge.currency);
      let expected=null, warning=null;
      try {
        expected=calculateMonthlyTransferRent({currency:charge.currency,firstMonth,lastMonth,stays:occupancy.roomStays.map(stay=>({roomId:stay.roomId,startDate:stay.startDate,monthlyRate:Number(stay.monthlyRateSnapshot)}))});
      } catch(error) {warning=error instanceof Error?error.message:"CALCULATION_UNAVAILABLE";}
      return {chargeId:charge.id,description:charge.description,recordedAmount:Number(charge.amount),paid,recordedBalance:roundCurrency(Number(charge.amount)-paid,charge.currency),expected,delta:expected?roundCurrency(expected.total-Number(charge.amount),charge.currency):null,warning,adjustments:charge.adjustments};
    });
    return {occupancyId:occupancy.id,semester:semester.name,currentRoom:occupancy.room.number,roomHistory:occupancy.roomStays.map(stay=>({room:stay.room.number,start:stay.startDate,end:stay.endDate,monthlyRate:Number(stay.monthlyRateSnapshot)})),charges};
  });
  console.log(JSON.stringify({studentId:student.id,studentName:student.fullName,reports,readOnly:true},null,2));
} finally {await db.$disconnect();}
