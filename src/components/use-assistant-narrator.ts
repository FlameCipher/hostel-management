"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NarrationStatus="idle"|"loading"|"playing"|"paused";
type State={id:number|null;status:NarrationStatus;source:"kinari"|"device";error:string};
const idle:State={id:null,status:"idle",source:"device",error:""};

function speechText(value:string) {
 return value.replace(/\r\n/g,"\n").replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1")
  .replace(/\[([^\]]+)\]\([^)]*\)/g,"$1")
  .replace(/^\s{0,3}#{1,6}\s+/gm,"").replace(/^\s*[-*+]\s+/gm,"")
  .replace(/^\s*\d+[.)]\s+/gm,"").replace(/\*\*([^*]+)\*\*/g,"$1")
  .replace(/__([^_]+)__/g,"$1").replace(/\n{3,}/g,"\n\n").trim();
}
function speechLang(text:string) {
 if(/[ĩũ]/i.test(text)||/\b(?:ngai|mũndũ|ũngĩ|nĩ|rĩu|wendo)\b/i.test(text))return"ki-KE";
 if(/\b(?:habari|tafadhali|asante|wanafunzi|malipo|chumba|karibu)\b/i.test(text))return"sw-KE";
 return"en-KE";
}
function preferredVoice(lang:string):SpeechSynthesisVoice|null {
 const synth=window.speechSynthesis,voices=synth?.getVoices?.()??[];
 const preferred=lang.split("-")[0];
 const compatible=voices.filter(v=>v.lang.toLowerCase().startsWith(preferred));
 const names=["Daniel","Google UK English Male","Microsoft Ryan","Microsoft Guy","Alex","David","Male"];
 return names.map(name=>compatible.find(v=>v.name.toLowerCase().includes(name.toLowerCase()))).find(Boolean)
  ??compatible.find(v=>/male|daniel|ryan|guy|david|alex/i.test(v.name))
  ??compatible[0]??voices.find(v=>/^en[-_]/i.test(v.lang))??voices[0]??null;
}

export function useAssistantNarrator(audience:"staff"|"tenant") {
 const [state,setState]=useState<State>(idle);
 const stateRef=useRef<State>(idle);
 const activeId=useRef(0);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const urlRef=useRef<string|null>(null);
 const utteranceRef=useRef<SpeechSynthesisUtterance|null>(null);
 const controllerRef=useRef<AbortController|null>(null);
 const setBoth=useCallback((state:State)=>{stateRef.current=state;setState(state);},[]);
 const halt=useCallback(()=>{
  activeId.current++;
  controllerRef.current?.abort();controllerRef.current=null;
  if(audioRef.current){audioRef.current.pause();audioRef.current.onended=null;audioRef.current.onerror=null;audioRef.current.src="";audioRef.current=null;}
  if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null;}
  if(typeof window!=="undefined"&&"speechSynthesis" in window)window.speechSynthesis.cancel();
  utteranceRef.current=null;setBoth(idle);
 },[setBoth]);
 useEffect(()=>()=>{activeId.current++;controllerRef.current?.abort();if(audioRef.current){audioRef.current.pause();audioRef.current.src="";}if(urlRef.current)URL.revokeObjectURL(urlRef.current);if("speechSynthesis" in window)window.speechSynthesis.cancel();},[]);
 const useDevice=useCallback((id:number,text:string,generation:number,reason="")=>{
  if(generation!==activeId.current)return;
  if(!("speechSynthesis" in window)||typeof SpeechSynthesisUtterance==="undefined"){
   setBoth({id,status:"idle",source:"device",error:"This device has no speech reader. Try another browser or enable text-to-speech in your phone settings."});return;
  }
  const trimmed=speechText(text);
  if(!trimmed){setBoth({id,status:"idle",source:"device",error:"No text available to read."});return;}
  try {
   const synth=window.speechSynthesis;
   synth.cancel();
   const utterance=new SpeechSynthesisUtterance(trimmed);
   utterance.lang=speechLang(trimmed);
   utterance.rate=0.88;utterance.pitch=0.82;utterance.volume=1;
   const voice=preferredVoice(utterance.lang);
   if(voice)utterance.voice=voice;
   utterance.onend=()=>{if(generation===activeId.current)setBoth(idle);};
   utterance.onerror=(event)=>{if(generation===activeId.current)setBoth({id,status:"idle",source:"device",error:event.error==="interrupted"?"":"Device speech could not read this message. Check text-to-speech settings."});};
   utteranceRef.current=utterance;
   setBoth({id,status:"playing",source:"device",error:reason});
   synth.speak(utterance);
  }catch{setBoth({id,status:"idle",source:"device",error:"Device narration is unavailable. Check your phone speech settings."});}
 },[setBoth]);
 const toggle=useCallback(async(id:number,text:string,voiceTicket?:string)=>{
  const current=stateRef.current;
  if(current.id===id&&current.status==="loading"){halt();return;}
  if(current.id===id&&(current.status==="playing"||current.status==="paused")) {
   if(audioRef.current){
    if(current.status==="playing"){audioRef.current.pause();setBoth({...current,status:"paused"});}
    else {try{await audioRef.current.play();setBoth({...current,status:"playing",error:""});}catch{setBoth({...current,status:"paused",error:"Tap Resume again to allow audio playback on this phone."});}}
    return;
   }
   if("speechSynthesis" in window){
    if(current.status==="playing"){window.speechSynthesis.pause();setBoth({...current,status:"paused"});}
    else {window.speechSynthesis.resume();setBoth({...current,status:"playing",error:""});}
   }
   return;
  }
  halt();const generation=activeId.current;
  if(!voiceTicket){useDevice(id,text,generation);return;}
  setBoth({id,status:"loading",source:"kinari",error:""});
  const controller=new AbortController();controllerRef.current=controller;
  try{
   const res=await fetch("/api/assistant/voice",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text,voiceTicket,audience}),cache:"no-store",signal:controller.signal});
   if(!res.ok)throw Error("Narrator unavailable");
   const blob=await res.blob();
   if(generation!==activeId.current)return;
   if(!blob.type.startsWith("audio/"))throw Error("Invalid voice audio");
   const url=URL.createObjectURL(blob);urlRef.current=url;
   const audio=new Audio();audioRef.current=audio;
   audio.preload="auto";audio.src=url;
   audio.onended=()=>{if(generation===activeId.current)halt();};
   audio.onerror=()=>{if(generation===activeId.current){halt();}};
   try{await audio.play();if(generation===activeId.current)setBoth({id,status:"playing",source:"kinari",error:""});}
   catch{if(generation===activeId.current)setBoth({id,status:"paused",source:"kinari",error:"Tap Resume to allow the phone to play narration."});}
  }catch{
   if(generation!==activeId.current||controller.signal.aborted)return;
   useDevice(id,text,generation,"Kinari narration was unavailable, so the device voice is reading instead.");
  }finally{if(controllerRef.current===controller)controllerRef.current=null;}
 },[audience,halt,setBoth,useDevice]);
 return {state,toggle,stop:halt};
}
