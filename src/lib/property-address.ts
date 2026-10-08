import {createHash} from "node:crypto";
import {DIRECTORY_HOST} from "./property-host-policy";
const reserved=new Set(["www","admin","api","login","support","mail","account","system","hostel","hostels"]);
export function propertyAddressLabel(name:string,identity:string){
 const suffix=createHash("sha256").update(identity).digest("hex").slice(0,10);
 const words=name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").split("-").filter(word=>word && word!=="hostel" && word!=="hostels");
 const label=words.join("-").replace(/hostels?$/g,"").replace(/-+$/g,"").slice(0,50).replace(/-+$/g,"");
 return !label || reserved.has(label) ? `property-${suffix}` : label;
}
export function propertyAddress(name:string,identity:string,collision=false){
 const label=propertyAddressLabel(name,identity);
 const suffix=collision ? `-${createHash("sha256").update(identity).digest("hex").slice(0,10)}` : "";
 return `${label}${suffix}.${DIRECTORY_HOST}`;
}
