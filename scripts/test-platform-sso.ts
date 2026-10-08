import test from 'node:test';
import assert from 'node:assert/strict';
import {platformRoleAllows,platformIdentity,ssoHash,validOpaque,validSubject} from '../src/lib/platform-sso';
const subject={platformUserId:'one',platformOrganizationId:'org',sessionVersion:2};
const identity={...subject,userName:'Test user',email:'test@example.invalid',organizationName:'Test org',role:'OWNER'};
test('PKCE matches the RFC 7636 S256 vector',()=>assert.equal(ssoHash('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
for(const v of ['',null,'x'.repeat(42),'x'.repeat(44),'!'.repeat(43)])test('invalid browser nonce rejected '+String(v).slice(0,6),()=>assert.equal(validOpaque(v),false));
test('subject rejects malformed and negative session versions',()=>{for(const value of [null,{}, {...subject,sessionVersion:-1},{...subject,sessionVersion:1.5},{...subject,platformUserId:'x'.repeat(129)}])assert.equal(validSubject(value),false)});
test('missing bridge configuration does not contact the platform',async()=>{delete process.env.HOSTEL_SSO_SECRET;let called=false;assert.equal(await platformIdentity(subject,(async()=>{called=true;return Response.json(identity)}) as typeof fetch),null);assert.equal(called,false)});
test('active matching identity accepted through fixed authenticated no-redirect endpoint',async()=>{process.env.HOSTEL_SSO_SECRET='test-only';const result=await platformIdentity(subject,(async(url,init)=>{assert.equal(url,'https://systeminone.com/api/hostel/sso/identity');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');return Response.json(identity)}) as typeof fetch);assert.deepEqual(result,identity)});
for(const change of [{sessionVersion:3},{platformUserId:'foreign'},{platformOrganizationId:'foreign'},{role:'SUPER_ADMIN'}])test('mismatched identity fails closed '+JSON.stringify(change),async()=>{process.env.HOSTEL_SSO_SECRET='test-only';assert.equal(await platformIdentity(subject,(async()=>Response.json({...identity,...change})) as typeof fetch),null)});
test('revocation and network failure fail closed',async()=>{process.env.HOSTEL_SSO_SECRET='test-only';assert.equal(await platformIdentity(subject,(async()=>new Response('{}',{status:403})) as typeof fetch),null);assert.equal(await platformIdentity(subject,(async()=>{throw Error('private')}) as typeof fetch),null)});

test('central role downgrade blocks privileged shared sessions without upgrading hostel roles',()=>{assert.equal(platformRoleAllows('OWNER','ADMIN'),false);assert.equal(platformRoleAllows('ADMIN','MEMBER'),false);assert.equal(platformRoleAllows('CARETAKER','ADMIN'),true);assert.equal(platformRoleAllows('OWNER','OWNER'),true);assert.equal(platformRoleAllows('UNKNOWN','OWNER'),false)});
