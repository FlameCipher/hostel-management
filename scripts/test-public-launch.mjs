import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectPublicRelease, parseOrigin } from './verify-public-launch.mjs';

const origin = 'https://mmambugua.studentshostels.com';
const expectedName = 'MMAMBUGUA HOSTEL';
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,1]);
const manifest = {
  id: '/open-app?hostel=hostel-123', name: expectedName, display: 'standalone', start_url: '/open-app',
  icons: [{ sizes: '192x192' }, { sizes: '512x512' }],
};
function fixture(overrides = {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.authorization, undefined);
    const path = new URL(url).pathname;
    if (overrides[path] instanceof Error) throw overrides[path];
    if (overrides[path]) return overrides[path];
    if (path === '/manifest.webmanifest') return Response.json(manifest);
    if (path.startsWith('/app-icons/')) return new Response(png, { status: 200, headers: {'content-type':'image/png'} });
    if (path.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
    if (['/payments','/students','/gate-readiness','/visitors'].includes(path)) return new Response(null, { status: 307, headers: {location:'/login'} });
    if (['/tenant/account','/tenant/visitors'].includes(path)) return new Response(null, { status: 307, headers: {location:'/tenant/login'} });
    return new Response(`<html>${path==='/'?expectedName:path==='/login'?'Welcome back':path==='/tenant/login'?'Student sign in':'Public content'}</html>`,{headers:{'content-type':'text/html; charset=utf-8'}});
  };
}

test('accepts only bare HTTPS origins', () => {
  assert.equal(parseOrigin(origin), origin);
  for (const bad of ['http://hostel.example', 'https://user:pass@example.com', 'https://example.com/tenant', 'https://example.com/?secret=1', 'https://example.com/#tenant']) {
    assert.throws(() => parseOrigin(bad));
  }
});
test('all public and access-control probes pass for matching property', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture() });
  assert.equal(report.fail, 0);
  assert.equal(report.unknown, 0);
  assert.equal(report.pass, 18);
  assert.ok(report.manualGates.length >= 8);
});
test('cross-property manifest identity mismatch fails closed', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture({'/manifest.webmanifest': Response.json({...manifest, name:'Another hostel'})}) });
  assert.equal(report.fail, 1);
  assert.equal(report.checks.find(x=>x.label==='Hostel PWA identity').status,'FAIL');
});
test('200 on a protected page is a security failure', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture({'/payments': new Response('PRIVATE DATA')}) });
  assert.equal(report.checks.find(x=>x.label==='Payments access control').status, 'FAIL');
});
test('off-host login redirect is rejected', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture({'/tenant/account': Response.redirect('https://evil.example/tenant/login', 302)}) });
  assert.equal(report.checks.find(x=>x.label==='Tenant account access control').status, 'FAIL');
});
test('cron routes must return 401 without a bearer token', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture({'/api/cron/backups': new Response('{}',{status:200})}) });
  assert.equal(report.checks.find(x=>x.label==='Unauthenticated /api/cron/backups').status, 'FAIL');
});
test('network failure remains UNKNOWN, never PASS', async () => {
  const report = await inspectPublicRelease({ origin, expectedName, fetchFn: fixture({'/manifest.webmanifest':new Error('Network blocked')}) });
  assert.equal(report.unknown, 1);
  assert.equal(report.checks.find(x=>x.label==='Hostel PWA identity').status,'UNKNOWN');
});
