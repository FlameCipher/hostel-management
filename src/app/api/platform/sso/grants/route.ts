import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {healthfixAuthorized} from '@/lib/healthfix';
import {issueSsoGrant,platformIdentity,validSubject,validOpaque} from '@/lib/platform-sso';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'cache-control':'no-store'};
 if(!healthfixAuthorized(process.env.HOSTEL_SSO_SECRET,request.headers.get('x-hostel-sso-secret')))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const body=await request.json().catch(()=>null);
 const challenge=body?.challenge;
 if(!validSubject(body)||!validOpaque(challenge))return NextResponse.json({error:'Invalid request'},{status:400,headers});
 if(!await platformIdentity(body))return NextResponse.json({error:'Access unavailable'},{status:403,headers});
 try{return NextResponse.json({code:await issueSsoGrant(db,body,challenge)},{headers});}catch{return NextResponse.json({error:'Access unavailable'},{status:503,headers});}
}
