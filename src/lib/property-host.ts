import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { normalizeHost, isLegacyHost, isSharedHost, publishedWhere } from "./property-host-policy";
export const requestPropertyContext = cache(async () => {
  // Only Host selects a property. Client-supplied forwarded headers never do.
  const host = normalizeHost((await headers()).get("host"));
  if (isSharedHost(host)) return {host,shared:true,property:null};
  const property = host ? await db.property.findFirst({where:{...publishedWhere(),...(isLegacyHost(host)?{organizationId:"mama-mbugua-hostel",slug:"mmambugua-hostel"}:{customDomain:host})},select:{id:true,organizationId:true,name:true,customDomain:true,physicalAddress:true,phone:true,email:true,publicDescription:true}}) : null;
  return {host,shared:false,property};
});
