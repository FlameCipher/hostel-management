#!/usr/bin/env node
/**
 * Read-only public release acceptance for a single hostel origin.
 * No cookies, secrets, POST requests, payments or tenant account actions.
 * Exit 0: every probe passed; 1: at least one definite failure; 2: only unknown/unreachable probes.
 */
import { pathToFileURL } from 'node:url';

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const publicHtml = [
  { path: '/', fragment: null, label: 'Published property homepage' },
  { path: '/login', fragment: 'Welcome back', label: 'Management login' },
  { path: '/tenant/login', fragment: 'Student sign in', label: 'Resident login' },
  { path: '/install', fragment: null, label: 'Mobile installation guidance' },
  { path: '/book', fragment: null, label: 'Public booking entry' },
];
const privatePages = [
  { path: '/payments', label: 'Payments access control', login: '/login' },
  { path: '/students', label: 'Student register access control', login: '/login' },
  { path: '/gate-readiness', label: 'Gate readiness access control', login: '/login' },
  { path: '/visitors', label: 'Visitor register access control', login: '/login' },
  { path: '/tenant/account', label: 'Tenant account access control', login: '/tenant/login' },
  { path: '/tenant/visitors', label: 'Tenant visitor access control', login: '/tenant/login' },
];
const protectedApis = [
  '/api/platform/healthfix',
  '/api/cron/payment-reminders',
  '/api/cron/backups',
  '/api/cron/service-delivery',
];

export function parseOrigin(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash || !u.hostname) {
    throw new Error('Origin must be an HTTPS origin only, with no path, credentials or query.');
  }
  return u.origin;
}

function pass(label, note) { return { label, status: 'PASS', note }; }
function fail(label, note) { return { label, status: 'FAIL', note }; }
function unknown(label, note) { return { label, status: 'UNKNOWN', note }; }
function locationIsLogin(response, base, allowedPath) {
  if (![301, 302, 303, 307, 308].includes(response.status)) return false;
  const location = response.headers.get('location');
  if (!location) return false;
  try {
    const u = new URL(location, base);
    return u.origin === base && (u.pathname === allowedPath || u.pathname.startsWith(`${allowedPath}/`));
  } catch { return false; }
}
async function request(fetchFn, origin, path) {
  // Redirects are deliberately not followed; authenticated pages must not return private HTML.
  return fetchFn(`${origin}${path}`, {
    method: 'GET', redirect: 'manual',
    headers: { 'accept': path.endsWith('.webmanifest') ? 'application/manifest+json' : '*/*', 'cache-control': 'no-store' },
    signal: AbortSignal.timeout(10000),
  });
}
function describeNetworkError(e) {
  return e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'Request timed out; actual service availability unverified' : 'Network request failed; actual service availability unverified';
}

export async function inspectPublicRelease({ origin, expectedName, fetchFn = fetch }) {
  const base = parseOrigin(origin);
  if (typeof expectedName !== 'string' || !expectedName.trim() || expectedName.length > 150) throw new Error('A property name is required.');
  const name = expectedName.trim();
  const checks = [];
  for (const item of publicHtml) {
    try {
      const r = await request(fetchFn, base, item.path);
      if (r.status !== 200 || !(r.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
        checks.push(fail(item.label, `Expected HTML 200; received HTTP ${r.status}`));
        continue;
      }
      if (item.path === '/' || item.fragment) {
        const body = (await r.text()).slice(0, 1_000_000);
        const match = item.path === '/' ? name : item.fragment;
        if (!body.toLocaleLowerCase('en').includes(match.toLocaleLowerCase('en'))) {
          checks.push(fail(item.label, 'Expected page identity/text not found in response'));
          continue;
        }
      }
      checks.push(pass(item.label, 'Public HTML route served correctly'));
    } catch (e) { checks.push(unknown(item.label, describeNetworkError(e))); }
  }
  try {
    const r = await request(fetchFn, base, '/manifest.webmanifest');
    if (r.status !== 200) checks.push(fail('Hostel PWA identity', `Expected manifest HTTP 200, got ${r.status}`));
    else {
      let manifest;
      try { manifest = await r.json(); } catch { manifest = null; }
      const iconSet = new Set(manifest?.icons?.map(icon => icon.sizes));
      const ok = manifest?.name === name && manifest?.display === 'standalone' && manifest?.start_url === '/open-app' &&
        typeof manifest?.id === 'string' && manifest.id.startsWith('/open-app?hostel=') && iconSet.has('192x192') && iconSet.has('512x512');
      checks.push(ok ? pass('Hostel PWA identity', 'Host-scoped manifest, app start and icon sizes present') : fail('Hostel PWA identity', 'Manifest identity, start URL or icon declarations mismatch'));
    }
  } catch (e) { checks.push(unknown('Hostel PWA identity', describeNetworkError(e))); }
  for (const size of [192, 512]) {
    const label = `${size}px install icon`;
    try {
      const r = await request(fetchFn, base, `/app-icons/${size}`);
      if (r.status !== 200 || !(r.headers.get('content-type') ?? '').includes('image/png')) {
        checks.push(fail(label, `Expected PNG HTTP 200, got ${r.status}`));
        continue;
      }
      const body = Buffer.from(await r.arrayBuffer());
      checks.push(body.subarray(0, 8).equals(pngSignature) ? pass(label, 'Valid PNG signature') : fail(label, 'Invalid PNG signature'));
    } catch (e) { checks.push(unknown(label, describeNetworkError(e))); }
  }
  for (const item of privatePages) {
    try {
      const r = await request(fetchFn, base, item.path);
      const denied = [401, 403].includes(r.status) || locationIsLogin(r, base, item.login);
      checks.push(denied ? pass(item.label, `Unauthenticated request rejected (HTTP ${r.status})`) : fail(item.label, `Expected a denial or same-origin ${item.login} redirect; got HTTP ${r.status}`));
    } catch (e) { checks.push(unknown(item.label, describeNetworkError(e))); }
  }
  for (const path of protectedApis) {
    const label = `Unauthenticated ${path}`;
    try {
      const r = await request(fetchFn, base, path);
      checks.push(r.status === 401 ? pass(label, 'Unauthenticated GET rejected') : fail(label, `Expected HTTP 401, got ${r.status}`));
    } catch (e) { checks.push(unknown(label, describeNetworkError(e))); }
  }
  const summary = {
    origin: base, expectedProperty: name, checkedAt: new Date().toISOString(),
    pass: checks.filter(c => c.status === 'PASS').length,
    fail: checks.filter(c => c.status === 'FAIL').length,
    unknown: checks.filter(c => c.status === 'UNKNOWN').length,
    checks,
    // These cannot be certified by unauthenticated GET requests; never imply otherwise.
    manualGates: [
      'Live PostgreSQL backup restore into isolated database',
      'Named caretaker own-device sign-in and role isolation',
      'Approved resident portal activation and private messaging',
      'Actual visitor identity, entry and departure verification',
      'Android/iPhone install and restart on physical devices',
      'Provider-confirmed receipt and notification delivery',
      'Real payment ledger reconciliation, without rewriting records',
      'Two-organization isolation and subscription acceptance before Client #2',
    ],
  };
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [origin, name] = process.argv.slice(2);
  if (!origin || !name) {
    console.error('Usage: node scripts/verify-public-launch.mjs https://mmambugua.studentshostels.com "MMAMBUGUA HOSTEL"');
    process.exitCode = 2;
  } else {
    try {
      const report = await inspectPublicRelease({ origin, expectedName: name });
      for (const c of report.checks) console.log(`${c.status.padEnd(7)} ${c.label}: ${c.note}`);
      console.log(`Public checks: ${report.pass} passed / ${report.fail} failed / ${report.unknown} unverified`);
      console.log('Real-operator, financial, provider and recovery gates remain pending separate verification.');
      process.exitCode = report.fail ? 1 : report.unknown ? 2 : 0;
    } catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
