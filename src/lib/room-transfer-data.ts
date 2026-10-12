import type { PrismaClient } from "@/generated/prisma/client";
import type { TransferReviewRecord } from "@/lib/room-transfer-review";

type Data = Pick<PrismaClient,"occupancy">;

/** Every lookup is scoped to the current hostel; no cross-property fallback. */
export async function loadTransferReviewRecord(
  database:Data, organizationId:string, occupancyId:string,
):Promise<TransferReviewRecord|null>{
  const occupancy=await database.occupancy.findFirst({
    where:{id:occupancyId,organizationId},
    include:{
      student:{select:{fullName:true}},
      room:{select:{number:true,roomTypeId:true}},
      semester:{select:{name:true,startDate:true,endDate:true}},
      roomStays:{orderBy:{startDate:"asc"},
        include:{room:{select:{number:true}},roomType:{select:{name:true}}}},
      charges:{where:{type:"SEMESTER_RENT"},
        include:{
          payments:{where:{reversedAt:null},select:{amount:true,currency:true,studentId:true,organizationId:true}},
          adjustments:{select:{reason:true,calculationMethod:true,explanation:true}},
        }},
    },
  });
  if(!occupancy)return null;
  return {
    id:occupancy.id,organizationId:occupancy.organizationId,
    studentId:occupancy.studentId,studentName:occupancy.student.fullName,
    status:occupancy.status,roomId:occupancy.roomId,
    currentRoom:occupancy.room.number,roomTypeId:occupancy.room.roomTypeId,
    semesterName:occupancy.semester.name,
    semesterStart:occupancy.semester.startDate,semesterEnd:occupancy.semester.endDate,
    stays:occupancy.roomStays.map(s=>({
      id:s.id,roomId:s.roomId,roomNumber:s.room.number,
      roomTypeId:s.roomTypeId,roomTypeName:s.roomType.name,
      startDate:s.startDate,endDate:s.endDate,
      monthlyRate:Number(s.monthlyRateSnapshot),
      semesterRate:Number(s.semesterRateSnapshot),
    })),
    charges:occupancy.charges.map(c=>({
      id:c.id,amount:Number(c.amount),
      baseAmount:c.baseAmount===null?null:Number(c.baseAmount),
      currency:c.currency,status:c.status,roomTypeId:c.roomTypeId,
      description:c.description,
      payments:c.payments.map(p=>({
        amount:Number(p.amount),currency:p.currency,studentId:p.studentId,
        organizationId:p.organizationId,
      })),
      adjustments:c.adjustments.map(a=>({
        reason:a.reason,calculationMethod:a.calculationMethod,
        explanation:a.explanation,
      })),
    })),
  };
}
