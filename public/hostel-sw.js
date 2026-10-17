/* Hostel app worker v1: network-only records, no private caches or write replay. */
const offlinePage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#344753"><title>Connect to your hostel</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f8;color:#293740;font:16px/1.65 system-ui,sans-serif}main{max-width:440px;margin:24px;padding:28px;background:white;border:1px solid #d8e0e5;border-radius:20px}h1{font-size:26px;line-height:1.25}a{display:inline-block;background:#344753;color:white;text-decoration:none;border-radius:12px;padding:12px 18px}small{display:block;margin-top:20px;color:#52647a}</style></head><body><main><h1>Connect to your hostel</h1><p>You appear to be offline. Connect to the internet to open your account, messages and visitor records.</p><a href="/open-app">Try again</a><small>No message, payment or visitor change is queued by this app. After reconnecting, check the latest record before submitting again.</small></main></body></html>`;

// Existing tabs finish using their current worker; updates never reload a form.
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request, { cache: "no-store" }).catch(() => new Response(offlinePage, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" },
  })));
});

// Notification payloads are intentionally reduced to exact, known app routes.
// Never display private student/class names on the device lock screen, and
// never navigate to a URL supplied by an arbitrary push payload.
function allowedAlertRoute(data){
 if(data && data.kind==="CLASS_REMINDER" && data.url==="/tenant/timetable")
   return "/tenant/timetable";
 if(data && data.kind==="GATE_UPDATE" && data.url==="/outings")
   return "/outings";
 if(data && data.kind==="SOS_ALERT" && data.url==="/safety")
   return "/safety";
 if(data && data.kind==="SOS_DRILL" && data.url==="/safety")
   return "/safety";
 return "/open-app";
}
self.addEventListener("push", event => {
 let data={};try{data=event.data?.json()||{};}catch{/* generic notice */}
 const url=allowedAlertRoute(data);
 const drill=url==="/safety"&&data.kind==="SOS_DRILL";
 const title=drill?"Hostel notification TEST":url==="/safety"?"Urgent hostel SOS":url==="/tenant/timetable"?"Class reminder":
   url==="/outings"?"Hostel gate update":"Your hostel";
 const body=drill?"This is only a notification test. No student has requested emergency help.":
   url==="/safety"?"An emergency request needs staff review. Open the secure SOS queue.":url==="/tenant/timetable"?
   "A lesson reminder is ready. Open your private timetable.":
   url==="/outings"?
   "A student gate update needs review in your hostel app.":
   "New activity is ready to review. Open your hostel app to see the details.";
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:"/app-icons/192",badge:"/app-icons/192",
  tag:typeof data.tag==="string"&&data.tag.length<=128?data.tag:"hostel-update",
  data:{url},
 }));
});
self.addEventListener("notificationclick", event => {
 event.notification.close();
 // Only the URL saved by the worker itself and matching the fixed allowlist
 // may be opened, never a provider-supplied external target.
 const requested=event.notification?.data?.url;
 const target=requested==="/tenant/timetable"||requested==="/outings"||requested==="/safety"?
   requested:"/open-app";
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true})
   .then(async windows=>{
     for(const client of windows){
       if(new URL(client.url).origin===self.location.origin){
         await client.navigate(target);return client.focus();
       }
     }
     return self.clients.openWindow(target);
   }));
});
