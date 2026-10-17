"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SafetyQueueRefresh(){
 const router=useRouter();
 useEffect(()=>{
   const id=window.setInterval(()=>{
     if(document.visibilityState==="visible")router.refresh();
   },20000);
   return ()=>window.clearInterval(id);
 },[router]);
 return <p className="muted-note">The open dashboard refreshes about every 20 seconds while visible. This is not a guarantee of immediate delivery or staffed response.</p>;
}
