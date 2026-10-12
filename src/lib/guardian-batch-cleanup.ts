import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import {
  guardianCorrectionFingerprint, guardianPhoneCorrections, uniqueCountry,
} from "@/lib/guardian-registry";

/** One atomic, non-destructive phone-format operation.
 * No student, guardian identity, payment, or messaging records are created.
 * All existing guardian phone values and corrected values are audited.
 */
export async function applyGuardianFormatCorrection(
  database: PrismaClient,
  session: SessionPayload,
  expectation: {count:number; fingerprint:string},
) {
  if (!["OWNER","ADMIN"].includes(session.role)) throw Error("ACCESS_CHANGED");
  if (!Number.isSafeInteger(expectation.count) || expectation.count<1 ||
    expectation.count>200 || !/^[a-f0-9]{64}$/.test(expectation.fingerprint)) {
    throw Error("REVIEW_CHANGED");
  }
  return database.$transaction(async tx=>{
    const actor=await tx.user.findFirst({
      where:{id:session.userId,organizationId:session.organizationId,active:true,
        role:{in:["OWNER","ADMIN"]},organization:{status:"ACTIVE"}},
      select:{id:true,sessionVersion:true},
    });
    if(!actor || !localSessionCurrent(session.sessionVersion,actor.sessionVersion))
      throw Error("ACCESS_CHANGED");

    const properties=await tx.property.findMany({
      where:{organizationId:session.organizationId,active:true},
      select:{countryCode:true},
    });
    const country=uniqueCountry(properties);
    if(country!=="KE")throw Error("COUNTRY_REVIEW_REQUIRED");

    const guardians=await tx.guardian.findMany({
      where:{student:{organizationId:session.organizationId}},
      select:{id:true,studentId:true,phone:true},
    });
    const candidates=guardianPhoneCorrections(guardians,country);
    if(candidates.length>200)throw Error("TOO_MANY");
    if(candidates.length!==expectation.count ||
      guardianCorrectionFingerprint(candidates)!==expectation.fingerprint)
      throw Error("REVIEW_CHANGED");

    for(const record of candidates){
      const updated=await tx.guardian.updateMany({
        where:{id:record.id,studentId:record.studentId,
          phone:record.previousPhone,
          student:{organizationId:session.organizationId}},
        data:{phone:record.newPhone},
      });
      if(updated.count!==1)throw Error("STALE_GUARDIAN");
      await tx.auditLog.create({data:{
        organizationId:session.organizationId,actorUserId:session.userId,
        action:"GUARDIAN_CONTACT_FORMAT_NORMALIZED",
        entityType:"Guardian",entityId:record.id,
        metadata:{
          studentId:record.studentId,
          previousPhone:record.previousPhone,
          newPhone:record.newPhone,
          country:"KE",
          source:"Explicit Owner/Admin confirmation in guardian register",
          messageSent:false,financialRecordsChanged:false,
        },
      }});
    }
    return candidates.length;
  },{isolationLevel:"Serializable",maxWait:5000,timeout:30000});
}
