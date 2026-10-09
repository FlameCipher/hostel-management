import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export const serviceId = (...parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export function sameOrigin(request: Request) {
  try { const origin = new URL(request.headers.get("origin") ?? ""); return origin.host === request.headers.get("host") && (origin.protocol === "https:" || process.env.NODE_ENV !== "production"); } catch { return false; }
}
function encryptionKey() {
 const value=process.env.SERVICE_ENCRYPTION_KEY;
 if(!value || !/^[a-f0-9]{64}$/.test(value))throw Error("SERVICE_ENCRYPTION_NOT_CONFIGURED");
 return Buffer.from(value,"hex");
}
export function sealServiceSecret(value:string, organizationId:string) {
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);cipher.setAAD(Buffer.from(organizationId));
 return ["v1",iv.toString("base64url"),Buffer.concat([cipher.update(value,"utf8"),cipher.final()]).toString("base64url"),cipher.getAuthTag().toString("base64url")].join(".");
}
export function openServiceSecret(value:string,organizationId:string) {
 const [version,iv,body,tag]=value.split(".");if(version!=="v1")throw Error("INVALID_SERVICE_SECRET");
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64url"));decipher.setAAD(Buffer.from(organizationId));decipher.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([decipher.update(Buffer.from(body,"base64url")),decipher.final()]).toString("utf8");
}

// Authenticated operator diagnostics contain provider messages, never request headers or bodies.
export function serviceDiagnostic(error:unknown){return (error instanceof Error?error.message:"Service failed").replace(/Bearer\s+[^\s"']+/gi,"Bearer [redacted]").replace(/(?:https?|postgres(?:ql)?):\/\/[^\s"']+/gi,"[service URL]").replace(/[A-Za-z0-9_=-]{40,}/g,"[redacted]").slice(0,500);}
