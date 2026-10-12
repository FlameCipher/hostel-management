import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import { localSessionCurrent } from "@/lib/account-security-policy";
import { loadTransferReviewRecord } from "@/lib/room-transfer-data";
import { transferReviewFingerprint } from "@/lib/room-transfer-review";

const noteSchema=z.object({
  occupancyId:z.string().min(1).max(128),
  fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  requestId:z.uuid(),
  noteType:z.enum(["REPORTED_DISCREPANCY","REVIEW_OBSERVATION","EVIDENCE_REFERENCE"]),
  note:z.string().trim().min(20).max(1200),
  evidenceReference:z.string().trim().max(180).default(""),
  reportedPhysicalMoveDate:z.union([
    z.literal(""),
    z.iso.date(),
  ]).default(""),
});
export type RoomTransferEvidenceInput=z.infer<typeof noteSchema>;

export function validateTransferEvidenceNote(input:unknown) {
  const parsed=noteSchema.safeParse(input);
  if(!parsed.success)throw Error("INVALID_REVIEW_NOTE");
  return parsed.data;
}

export function evidenceNoteId(organizationId:string,occupancyId:string,requestId:string) {
  return "transfer_note_"+createHash("sha256").update(JSON.stringify([
    organizationId,occupancyId,requestId,
  ])).digest("hex").slice(0,36);
}

/**
 * Appends an owner-attested discrepancy/evidence reference. This does NOT
 * verify that physical dates are correct, mutate a recorded stay, or change
 * the accommodation contract, financial charge, ledger or receipts.
 */
export async function recordTransferEvidenceNote(
  database:PrismaClient,session:SessionPayload,input:unknown,
) {
  const data=validateTransferEvidenceNote(input);
  if(!["OWNER","ADMIN"].includes(session.role))throw Error("NOT_AUTHORIZED");
  return database.$transaction(async(tx)=>{
    const actor=await tx.user.findFirst({
      where:{
        id:session.userId,organizationId:session.organizationId,
        active:true,role:{in:["OWNER","ADMIN"]},
        organization:{status:"ACTIVE"},
      },
      select:{id:true,sessionVersion:true},
    });
    if(!actor||!localSessionCurrent(session.sessionVersion,actor.sessionVersion)) {
      throw Error("NOT_AUTHORIZED");
    }
    const record=await loadTransferReviewRecord(tx,session.organizationId,data.occupancyId);
    if(!record||record.stays.length<2)throw Error("TRANSFER_CASE_UNAVAILABLE");
    if(transferReviewFingerprint(record)!==data.fingerprint)throw Error("REVIEW_STALE");
    const id=evidenceNoteId(session.organizationId,data.occupancyId,data.requestId);
    const created=await tx.auditLog.createMany({
      skipDuplicates:true,
      data:[{
        id,organizationId:session.organizationId,
        actorUserId:session.userId,
        action:"ROOM_TRANSFER_EVIDENCE_NOTE",
        entityType:"Occupancy",entityId:data.occupancyId,
        metadata:{
          noteType:data.noteType,
          note:data.note,
          evidenceReference:data.evidenceReference||null,
          reportedPhysicalMoveDate:data.reportedPhysicalMoveDate||null,
          requestId:data.requestId,
          previewFingerprint:data.fingerprint,
          physicalPresenceVerified:false,
          originalOccupancyHistoryChanged:false,
          financialRecordsChanged:false,
          messagesSent:false,
          source:"Owner/Admin observation or referenced source; requires independent verification",
        },
      }],
    });
    return {created:created.count===1,id};
  },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
