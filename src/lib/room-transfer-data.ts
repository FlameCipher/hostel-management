import type {Prisma,PrismaClient} from "@/generated/prisma/client";
import type {TransferReviewRecord} from "@/lib/room-transfer-review";

type Database=Pick<PrismaClient,"occupancy">;

const transferReviewInclude={
  student:{select:{fullName:true}},
  room:{select:{number:true,roomTypeId:true}},
  semester:{select:{name:true,startDate:true,endDate:true}},
  roomStays:{orderBy:{startDate:"asc"},include:{
    room:{select:{number:true}},roomType:{select:{name:true}},
  }},
  charges:{where:{type:"SEMESTER_RENT"},include:{
    payments:{where:{reversedAt:null},select:{
      amount:true,currency:true,studentId:true,organizationId:true,
    }},
    adjustments:{select:{reason:true,calculationMethod:true,explanation:true}},
  }},
} as const satisfies Prisma.OccupancyInclude;

type OccupancyDetails=Prisma.OccupancyGetPayload<{include:typeof transferReviewInclude}>;

function asReviewRecord(occupancy:OccupancyDetails):TransferReviewRecord {
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

/** Scope every lookup to one verified hostel organization. */
export async function loadTransferReviewRecord(
  database:Database,organizationId:string,occupancyId:string,
):Promise<TransferReviewRecord|null>{
  const occupancy=await database.occupancy.findFirst({
    where:{id:occupancyId,organizationId},
    include:transferReviewInclude,
  });
  return occupancy?asReviewRecord(occupancy):null;
}

/** One scoped database query for index views; prevents N+1 round trips
 * when a landlord has dozens of properties or many historic moves.
 */
export async function listTransferReviewRecords(
  database:Database,organizationId:string,limit=200,
):Promise<TransferReviewRecord[]>{
  const occupancies=await database.occupancy.findMany({
    where:{
      organizationId,
      roomStays:{some:{endDate:{not:null}}},
    },
    include:transferReviewInclude,
    orderBy:{updatedAt:"desc"},
    take:Math.min(200,Math.max(1,Math.floor(limit))),
  });
  return occupancies.map(asReviewRecord).filter(row=>row.stays.length>1);
}
