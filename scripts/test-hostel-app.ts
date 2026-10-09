import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { hostelAppIdentity, hostelAppManifest } from "../src/lib/hostel-app";

const property = { id: "hostel-one", name: "MMAMBUGUA HOSTEL", customDomain: "mmambugua.studentshostels.com" };

test("only the property's own published host can issue its app identity", () => {
  for (const host of [null, "studentshostels.com", "www.studentshostels.com", "other.studentshostels.com", "hostel.sampesa.com"])
    assert.equal(hostelAppIdentity(host, property), null);
  assert.equal(hostelAppIdentity(property.customDomain, null), null);
  assert.equal(hostelAppIdentity(property.customDomain, property)?.name, property.name);
});

test("app identity stays stable across renaming, but differs for a different hostel", () => {
  const one = hostelAppManifest(hostelAppIdentity(property.customDomain, property)!);
  const renamed = hostelAppManifest(hostelAppIdentity(property.customDomain, { ...property, name: "New name" })!);
  const two = hostelAppManifest(hostelAppIdentity("other.studentshostels.com", { ...property, id: "other", customDomain: "other.studentshostels.com" })!);
  assert.equal(one.id, renamed.id);
  assert.notEqual(one.id, two.id);
  assert.equal(one.start_url, "/open-app");
  assert.equal(one.scope, "/");
  assert.equal(one.display, "standalone");
  assert.deepEqual(one.icons?.map(icon => icon.sizes), ["192x192", "512x512", "512x512"]);
  assert(one.icons?.some(icon => icon.purpose?.includes("maskable")));
});

test("international hostel names survive and the app icon always has safe initials", () => {
  for (const name of ["École résidence", "学生宿舍", "سكن الطلاب", "🏠 Residence", "A ".repeat(60)]) {
    const app = hostelAppIdentity(property.customDomain, { ...property, name })!;
    assert.equal(app.name, name.trim());
    assert(Array.from(app.shortName).length <= 24);
    assert.match(app.initials, /^[A-Z0-9]{1,2}$/);
  }
});

function worker(fetch: (...args: unknown[]) => Promise<Response>) {
  const events: Record<string, (event: unknown) => void> = {};
  runInNewContext(readFileSync(new URL("../public/hostel-sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://hostel.example" }, clients: { claim: async () => {} }, addEventListener: (name: string, handler: (event: unknown) => void) => { events[name] = handler; } },
    URL, Response, fetch,
  });
  return events;
}

test("worker never handles writes, API reads, server actions, assets or another origin", () => {
  const handlers = worker(async () => { throw Error("Must not fetch"); });
  for (const request of [
    { method: "POST", mode: "navigate", url: "https://hostel.example/payments" },
    { method: "POST", mode: "cors", url: "https://hostel.example/tenant/contact" },
    { method: "GET", mode: "cors", url: "https://hostel.example/api/resident-alerts" },
    { method: "GET", mode: "same-origin", url: "https://hostel.example/tenant/account?_rsc=example" },
    { method: "GET", mode: "no-cors", url: "https://hostel.example/app-icons/192" },
    { method: "GET", mode: "navigate", url: "https://another.example/" },
  ]) handlers.fetch({ request, respondWith: () => assert.fail("Private or unrelated request was intercepted") });
  assert.equal(handlers.sync, undefined);
  assert.equal(typeof handlers.push, "function");
});

test("online navigation uses the network without an HTTP or service worker cache", async () => {
  const expected = new Response("Authorized live response", { status: 403 });
  const request = { method: "GET", mode: "navigate", url: "https://hostel.example/tenant/account" };
  let promise: Promise<Response> | undefined;
  const handlers = worker(async (sent, options) => { assert.equal(sent, request); assert.equal((options as { cache: string }).cache, "no-store"); return expected; });
  handlers.fetch({ request, respondWith: (value: Promise<Response>) => { promise = value; } });
  assert.equal(await promise, expected);
});

test("offline fallback reveals no request path, token or private data and queues nothing", async () => {
  const handlers = worker(async () => { throw Error("Network unavailable"); });
  let promise: Promise<Response> | undefined;
  handlers.fetch({ request: { method: "GET", mode: "navigate", url: "https://hostel.example/tenant/activate/private-token" }, respondWith: (value: Promise<Response>) => { promise = value; } });
  const response = (await promise)!;
  const html = await response.text();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert(html.includes('href="/open-app"'));
  assert(!html.includes("private-token"));
  assert.match(html, /No message, payment or visitor change is queued/);
});


test("background alerts never expose payload text or navigate to a supplied URL", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  let shown: unknown[],opened: string|undefined,waiting:Promise<unknown>|undefined;
  runInNewContext(readFileSync(new URL("../public/hostel-sw.js", import.meta.url), "utf8"), {URL,Response,fetch,
    self:{location:{origin:"https://hostel.example"},registration:{showNotification:async(...args:unknown[])=>{shown=args;}},clients:{matchAll:async()=>[],openWindow:async(url:string)=>{opened=url;}},addEventListener:(name:string,handler:(event:unknown)=>void)=>{handlers[name]=handler;}}});
  handlers.push({data:{json:()=>({title:"Private tenant",body:"Secret balance",url:"https://evil.example",tag:"stable"})},waitUntil:(p:Promise<unknown>)=>{waiting=p;}});await waiting;
  assert(!JSON.stringify(shown!).includes("Secret"));assert(!JSON.stringify(shown!).includes("Private tenant"));assert(JSON.stringify(shown!).includes("stable"));
  handlers.notificationclick({notification:{close(){},data:{url:"https://evil.example"}},waitUntil:(p:Promise<unknown>)=>{waiting=p;}});await waiting;assert.equal(opened,"/open-app");
});
