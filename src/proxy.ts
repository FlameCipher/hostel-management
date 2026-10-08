import {NextResponse, type NextRequest} from "next/server";
import {normalizeHost,MMAMBUGUA_HOST,isPreviousMmambuguaHost} from "@/lib/property-host-policy";
export function proxy(request:NextRequest){
 if(!isPreviousMmambuguaHost(normalizeHost(request.headers.get("host"))))return NextResponse.next();
 const target=request.nextUrl.clone();target.protocol="https:";target.hostname=MMAMBUGUA_HOST;target.port="";
 return NextResponse.redirect(target,308);
}
