/** A provider connection, backup status, or timestamp alone is NOT evidence that
 * a private backup was saved and read back unchanged.
 * This classifier is read-only and never exposes the backup path or credentials.
 */
export type BackupEvidenceRun={
 status:string;
 createdAt:Date;
 completedAt?:Date|null;
 metadata?:unknown;
};
export type BackupEvidenceStatus="PASSING"|"WARNING"|"FAILING"|"UNKNOWN";
export function backupEvidenceStatus(run:BackupEvidenceRun|null,now=new Date()):BackupEvidenceStatus{
 if(!run)return "UNKNOWN";
 if(run.status==="FAILED")return "FAILING";
 if(run.status!=="COMPLETED")return "WARNING";
 const finished=run.completedAt??null;
 if(!(finished instanceof Date)||Number.isNaN(finished.getTime()))return "WARNING";
 const age=now.getTime()-finished.getTime();
 if(!Number.isFinite(age)||age<0||age>26*3600000)return "WARNING";
 const metadata=run.metadata;
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))return "WARNING";
 const fields=metadata as Record<string,unknown>;
 if(fields.readbackVerified!==true||typeof fields.archiveSha256!=="string"||!/^[0-9a-f]{64}$/i.test(fields.archiveSha256))return "WARNING";
 return "PASSING";
}
