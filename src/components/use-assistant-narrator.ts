"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The genuine Kinari synthesized MP3 only. Never silently switch to device TTS. */
export type NarrationStatus = "idle"|"loading"|"playing"|"paused";
type State={id:number|null;status:NarrationStatus;source:"kinari";error:string};
const idle:State={id:null,status:"idle",source:"kinari",error:""};

export function useAssistantNarrator(audience:"staff"|"tenant") {
 const [state,setState]=useState<State>(idle);
 const stateRef=useRef<State>(idle);
 const activeId=useRef(0);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const urlRef=useRef<string|null>(null);
 const controllerRef=useRef<AbortController|null>(null);
 const setBoth=useCallback((value:State)=>{stateRef.current=value;setState(value);},[]);
 const release=useCallback(()=>{
  activeId.current++;
  controllerRef.current?.abort();
  controllerRef.current=null;
  const audio=audioRef.current;
  if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute("src");audio.load();audioRef.current=null;}
  if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
 },[]);
 const stop=useCallback(()=>{release();setBoth(idle);},[release,setBoth]);
 useEffect(()=>()=>{release();},[release]);

 const toggle=useCallback(async(id:number,text:string,voiceTicket?:string)=>{
  const current=stateRef.current;
  if(current.id===id&&current.status==="loading"){stop();return;}
  if(current.id===id&&(current.status==="playing"||current.status==="paused")&&audioRef.current){
   if(current.status==="playing"){audioRef.current.pause();setBoth({...current,status:"paused"});}
   else {
    try {await audioRef.current.play();setBoth({...current,status:"playing",error:""});}
    catch {setBoth({...current,status:"paused",error:"Tap Resume again to allow Kinari audio on this phone."});}
   }
   return;
  }
  stop();
  if(!voiceTicket){setBoth({id,status:"idle",source:"kinari",error:"This narration ticket has expired. Ask the assistant the question again for a new Kinari reading."});return;}
  const generation=activeId.current;
  const controller=new AbortController();
  controllerRef.current=controller;
  setBoth({id,status:"loading",source:"kinari",error:""});
  try {
   const response=await fetch("/api/assistant/voice",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text,voiceTicket,audience}),
    cache:"no-store",signal:controller.signal
   });
   if(generation!==activeId.current)return;
   if(!response.ok)throw Error(response.status===403?"This narration request expired. Ask your question again and retry Kinari voice.":response.status===429?"Voice limit reached. Try again later.":"Kinari narration is temporarily unavailable. Try again.");
   const type=response.headers.get("content-type")??"";
   if(!type.includes("audio/"))throw Error("The Kinari speech service did not return audio.");
   const blob=await response.blob();
   if(generation!==activeId.current)return;
   if(!blob.size||!blob.type.startsWith("audio/"))throw Error("The Kinari speech audio was empty or invalid.");
   const url=URL.createObjectURL(blob);
   urlRef.current=url;
   const audio=new Audio();
   audioRef.current=audio;
   audio.src=url;
   audio.preload="auto";
   audio.onended=()=>{if(generation===activeId.current)stop();};
   audio.onerror=()=>{if(generation===activeId.current){stop();setBoth({id,status:"idle",source:"kinari",error:"Unable to play Kinari audio. Check your phone volume and try again."});}};
   try {
    await audio.play();
    if(generation===activeId.current)setBoth({id,status:"playing",source:"kinari",error:""});
   }catch{
    if(generation===activeId.current)setBoth({id,status:"paused",source:"kinari",error:"Tap Resume to allow your phone to play Kinari audio."});
   }
  }catch(error){
   if(generation!==activeId.current||controller.signal.aborted)return;
   setBoth({id,status:"idle",source:"kinari",error:error instanceof Error?error.message:"Kinari voice is unavailable. Try again later."});
  }finally{
   if(controllerRef.current===controller)controllerRef.current=null;
  }
 },[audience,setBoth,stop]);
 return {state,toggle,stop};
}
