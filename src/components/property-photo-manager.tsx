"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { updatePhotoAction } from "@/app/(app)/website/actions";
import { PHOTO_CATEGORIES, photoCategoryLabels, type PhotoCategory } from "@/lib/photo-policy";
import styles from "./property-photo-manager.module.css";
type RoomType = { id: string; name: string; sharingMode: string };
type Photo = { id: string; url: string | null; caption: string; visible: boolean; isCover: boolean; removed: boolean; category: string | null; roomTypeId: string | null; confirmed: boolean };
function ClassificationFields({ category, setCategory, roomTypeId, setRoomTypeId, roomTypes }: { category: string; setCategory: (value: string) => void; roomTypeId: string; setRoomTypeId: (value: string) => void; roomTypes: RoomType[] }) {
  return <div className={styles.fields}><label className="field-group"><span>Photo category</span><select name="category" required value={category} onChange={event => { setCategory(event.target.value); setRoomTypeId(""); }}><option value="">Choose a category</option>{PHOTO_CATEGORIES.map(value => <option key={value} value={value}>{photoCategoryLabels[value]}</option>)}</select></label>{category === "ROOM" ? <label className="field-group"><span>Room type represented</span><select name="roomTypeId" required value={roomTypeId} onChange={event => setRoomTypeId(event.target.value)}><option value="">Choose a room type</option>{roomTypes.map(type => <option value={type.id} key={type.id}>{type.name} · {type.sharingMode === "SHARED" ? "Shared" : "Private"}</option>)}</select></label> : <input type="hidden" name="roomTypeId" value=""/>}</div>;
}
function PhotoEditor({ photo, roomTypes }: { photo: Photo; roomTypes: RoomType[] }) {
  const [state, action, pending] = useActionState(updatePhotoAction, { error: "", message: "" });
  const [category, setCategory] = useState(photo.category ?? ""), [roomTypeId, setRoomTypeId] = useState(photo.roomTypeId ?? "");
  return <article className={styles.photo}><div className="property-photo-preview">{photo.url ? <Image src={photo.url} alt={photo.caption || "Hostel photo awaiting classification"} fill sizes="(max-width: 700px) 100vw, 33vw" unoptimized/> : <span>Upload completion pending</span>}</div><div className={styles.photoBody}>
    <p className={styles.status}>{photo.removed ? "Removed · storage deletion pending" : !photo.confirmed ? "Owner review required" : photo.isCover ? "Building cover photo" : photo.visible ? "Published" : "Hidden"}</p>
    <form action={action}><input type="hidden" name="id" value={photo.id}/>{photo.url && !photo.removed ? <><ClassificationFields {...{category, setCategory, roomTypeId, setRoomTypeId, roomTypes}}/><label className="field-group"><span>Caption</span><input name="caption" defaultValue={photo.caption} maxLength={240}/></label><label className={styles.check}><input type="checkbox" name="confirmed" defaultChecked={photo.confirmed}/><span>I confirm this is a real photo of this hostel, correctly categorised. Room photos accurately represent every room of the selected type.</span></label><label className={styles.check}><input type="checkbox" name="visible" defaultChecked={photo.visible}/><span>Show on public website</span></label><div className={styles.actions}><button className="secondary-button" name="operation" value="caption" disabled={pending}>Save photo</button>{photo.visible && photo.category === "EXTERIOR" && <button className="secondary-button" name="operation" value="cover" disabled={pending} formNoValidate>Use as cover</button>}</div></> : null}<button className={styles.remove} name="operation" value="delete" disabled={pending} formNoValidate>{pending ? "Updating…" : "Delete photo"}</button>{state.error && <p role="alert" className="form-error">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}</form>
  </div></article>;
}
export function PropertyPhotoManager({ propertyId, organizationId, photos, configured, roomTypes }: { propertyId: string; organizationId: string; photos: Photo[]; configured: boolean; roomTypes: RoomType[] }) {
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [category, setCategory] = useState(""), [roomTypeId, setRoomTypeId] = useState("");
  const router = useRouter();
  const groupCount = photos.filter(photo => !photo.removed && photo.category === category && (photo.roomTypeId ?? "") === (category === "ROOM" ? roomTypeId : "")).length;
  const ready = configured && consent && !!category && (category !== "ROOM" || !!roomTypeId) && groupCount < 4;
  async function pick(files: File[]) {
    if (!files.length || !ready) return;
    if (files.length + groupCount > 4) { setMessage(`Choose at most ${4 - groupCount} more photos for this group.`); return; }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024)) { setMessage("Choose JPG, PNG or WebP photos up to 12 MB each."); return; }
    setBusy(true); setMessage("");
    let uploaded = 0;
    try {
      for (const file of files) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        await upload(`properties/${organizationId}/${propertyId}/${crypto.randomUUID()}.${extension}`, file, { access: "public", handleUploadUrl: "/api/property-photos/upload", clientPayload: JSON.stringify({ propertyId, publicConsent: true, category, roomTypeId: category === "ROOM" ? roomTypeId : null, confirmed: true }) });
        uploaded++;
      }
      setMessage(`${uploaded} photo${uploaded === 1 ? "" : "s"} uploaded. Refresh photos after processing to see publication status.`);
    } catch { setMessage(`${uploaded ? `${uploaded} uploaded. ` : ""}The next upload could not be confirmed. Refresh photos before retrying; each group allows four.`); }
    finally { setBusy(false); router.refresh(); }
  }
  return <section className={`panel ${styles.manager}`} id={`photography-${propertyId}`}><header><p className="panel-kicker">Your hostel, in pictures</p><h2>Building, compound & room galleries</h2><p>Real photos help residents know exactly what to expect.</p></header><div className={styles.rules}><article><strong>01 · Full building exterior</strong><p>Show the whole hostel from outside, including the building frontage. This is your website cover.</p></article><article><strong>02 · Compound</strong><p>Show the actual grounds, courtyard and outdoor access around the hostel.</p></article><article><strong>03 · Inside the room</strong><p>Upload up to four photos per room type. One set automatically represents all identical rooms of that type in this hostel.</p></article></div><p>Keep private and shared bedsitters or single rooms in their correct room types. If rooms differ materially, create a separate type. No posters, stock photos, unrelated buildings or pictures exposing residents’ private information.</p>{!configured && <p role="alert">Photo storage is not connected yet.</p>}
    <div className={styles.upload}><ClassificationFields {...{category, setCategory, roomTypeId, setRoomTypeId, roomTypes}}/><label className={styles.check}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>I own or have permission to publish these real hostel photos, they match the selected category, and any room photos accurately represent the selected room type.</span></label><label className="field-group"><span>{busy ? "Uploading photos…" : `Choose photos${category ? ` · ${groupCount}/4 in this group` : ""}`}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!ready || busy} onChange={event => { void pick(Array.from(event.target.files ?? [])); event.target.value = ""; }}/><small>JPG, PNG or WebP · maximum 12 MB each · four per group</small></label><button className="secondary-button" type="button" onClick={() => router.refresh()} disabled={busy}>Refresh photos</button>{message && <p role="status">{message}</p>}</div>
    {photos.some(photo => !photo.confirmed && !photo.removed) && <p className={styles.review}>Earlier pictures are retained below for review. Choose the correct category and confirm the photo rules before publishing them.</p>}
    {([null, ...PHOTO_CATEGORIES] as Array<PhotoCategory | null>).map(group => { const groupPhotos = photos.filter(photo => photo.category === group); return groupPhotos.length ? <section key={group ?? "review"} className={styles.group}><h3>{group ? photoCategoryLabels[group] : "Photos to review"}</h3>{group === "ROOM" && <p>Shared across identical rooms of the selected type; no duplicate uploads needed.</p>}<div className={styles.grid}>{groupPhotos.map(photo => <PhotoEditor key={photo.id} photo={photo} roomTypes={roomTypes}/>)}</div></section> : null; })}
  </section>;
}
