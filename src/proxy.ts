import {NextResponse, type NextRequest} from "next/server";
import {normalizeHost,MMAMBUGUA_HOST} from "@/lib/property-host-policy";
export function proxy(request:NextRequest){
 if(normalizeHost(request.headers.get("host")) !== "mmambuguahostel.studentshostels.com")return NextResponse.next();
 const target=request.nextUrl.clone();target.protocol="https:";target.hostname=MMAMBUGUA_HOST;target.port="";
 return NextResponse.redirect(target,308);
}
