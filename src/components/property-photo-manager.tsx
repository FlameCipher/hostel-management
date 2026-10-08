"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { updatePhotoAction } from "@/app/(app)/website/actions";
type Photo = { id: string; url: string | null; caption: string; visible: boolean; isCover: boolean; removed: boolean };
function PhotoEditor({ photo }: { photo: Photo }) {
  const [state, action, pending] = useActionState(updatePhotoAction, { error: "", message: "" });
  return <article className="panel entity-form"><div className="property-photo-preview">{photo.url ? <Image src={photo.url} alt={photo.caption || "Hostel photo"} fill sizes="(max-width: 700px) 100vw, 33vw" unoptimized/> : <span>Upload completion pending</span>}</div>
    {photo.removed ? <p>Removed from website; storage deletion pending.</p> : <p>{photo.isCover ? "Cover picture · " : ""}{photo.url ? photo.visible ? "Visible on website" : "Hidden from website" : "Upload awaiting confirmation. Refresh photos after uploading."}</p>}
    <form action={action}><input type="hidden" name="id" value={photo.id}/>{photo.url && !photo.removed ? <><label className="block">Caption<input className="form-input w-full" name="caption" defaultValue={photo.caption} maxLength={240}/></label><label><input type="checkbox" name="visible" defaultChecked={photo.visible}/> Show on public website</label><div className="row-actions"><button className="secondary-button" name="operation" value="caption" disabled={pending}>Save caption & visibility</button>{photo.visible && <button className="secondary-button" name="operation" value="cover" disabled={pending}>Use as cover</button>}</div></> : null}<button className="danger-link" name="operation" value="delete" disabled={pending}>{pending ? "Updating…" : "Delete photo"}</button>{state.error && <p role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}</form>
  </article>;
}
export function PropertyPhotoManager({ propertyId, organizationId, photos, configured }: { propertyId: string; organizationId: string; photos: Photo[]; configured: boolean }) {
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const router = useRouter();
  async function pick(file?: File) {
    if (!file || !consent) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) { setMessage("Choose a JPG, PNG or WebP picture up to 12 MB."); return; }
    setBusy(true); setMessage("");
    try { const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      await upload(`properties/${organizationId}/${propertyId}/${crypto.randomUUID()}.${extension}`, file, { access: "public", handleUploadUrl: "/api/property-photos/upload", clientPayload: JSON.stringify({ propertyId, publicConsent: true }) });
      setMessage("Picture uploaded. Refresh photos once completion is confirmed to edit its caption or choose it as cover."); router.refresh();
    } catch { setMessage("Upload could not be confirmed. Refresh photos before trying again, or check your access and storage connection."); }
    finally { setBusy(false); }
  }
  return <section className="panel entity-form"><h2>Website pictures</h2><p>Upload up to 12 pictures per hostel: compound, rooms, facilities or your advertising images. JPG, PNG or WebP; maximum 12 MB each.</p><p>These pictures are public. Include only photographs you want visitors to see.</p>{!configured && <p role="alert">Photo storage is not connected yet.</p>}<label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> I want these pictures displayed on my public hostel website.</label><label className="block">{busy ? "Uploading picture…" : "Upload a picture"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!configured || !consent || busy} onChange={event => { void pick(event.target.files?.[0]); event.target.value = ""; }}/></label><button className="secondary-button" type="button" onClick={() => router.refresh()} disabled={busy}>Refresh photos</button>{message && <p role="status">{message}</p>}<div className="property-photo-grid">{photos.map(photo => <PhotoEditor key={photo.id} photo={photo}/>)}</div></section>;
}
