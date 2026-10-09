"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HostelAppIdentity } from "@/lib/hostel-app";
import styles from "./hostel-app.module.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type AppState = { app: HostelAppIdentity | null; installed: boolean; promptReady: boolean; busy: boolean; message: string; ios: boolean; online: boolean; install: () => Promise<void> };
const AppContext = createContext<AppState | null>(null);

export function HostelAppProvider({ app, children }: { app: HostelAppIdentity | null; children: React.ReactNode }) {
  const deferred = useRef<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [promptReady, setPromptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ios, setIos] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!app) return;
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      setInstalled(current => current || display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
      setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
      setOnline(navigator.onLine);
    };
    const frame = requestAnimationFrame(sync);
    const available = (event: Event) => { event.preventDefault(); deferred.current = event as InstallEvent; setPromptReady(true); };
    const completed = () => { deferred.current = null; setPromptReady(false); setInstalled(true); setMessage("App installed. Open it from your Home Screen or app list."); };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    display.addEventListener("change", sync);
    // No account data or page responses are stored by this worker.
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/hostel-sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installation instructions remain usable if the browser blocks workers.
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      display.removeEventListener("change", sync);
    };
  }, [app]);

  async function install() {
    const event = deferred.current;
    if (!event || busy) return;
    deferred.current = null;
    setPromptReady(false);
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(choice.outcome === "accepted" ? "Installation requested. Follow your browser's instructions, then find the icon on your Home Screen or app list." : "Installation cancelled. You can keep using the website and install later from your browser menu.");
    } catch {
      setMessage("Use your browser menu to install, or follow the steps below.");
    } finally { setBusy(false); }
  }

  return <AppContext.Provider value={{ app, installed, promptReady, busy, message, ios, online, install }}>
    {app && !online && <p className={styles.offline} role="status">You are offline. Records may be out of date. Reconnect before sending messages, recording visits or making changes.</p>}
    {children}
  </AppContext.Provider>;
}

export function HostelInstallCard({ instructions = false }: { instructions?: boolean }) {
  const state = useContext(AppContext);
  if (!state?.app) return instructions ? null : <section className={styles.card}><h2>Your hostel on your phone</h2><p>Install from your hostel&apos;s own website to get the correct name and icon.</p><Link href="/install">Find my hostel app</Link></section>;
  const { app, installed, promptReady, busy, message, ios, online, install } = state;
  if (installed && !instructions) return null;
  return <section className={styles.card} aria-label="Install hostel app">
    <div className={styles.heading}>
      {/* A direct image uses this origin's public, host-specific icon route. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.icon} src="/app-icons/192" alt={`${app.name} app icon`} width={68} height={68}/>
      <div><h2>{installed ? "Your hostel app is ready" : "Keep your hostel one tap away"}</h2><p className={styles.host}>{app.name}<br/>{app.host}</p></div>
    </div>
    <p>Open your account, messages and visitor services from your phone&apos;s Home Screen. Use your existing sign-in details.</p>
    {installed ? <p className={styles.status}>Installed on this device.</p> : <div className={styles.actions}>
      {promptReady ? <button type="button" className="primary-button" disabled={busy || !online} onClick={() => void install()}>{busy ? "Opening install…" : "Install app"}</button> : instructions ? <a className="primary-button" href="#installation-steps">{ios ? "Show iPhone / iPad steps" : "Show installation steps"}</a> : <Link className="primary-button" href="/install">Install app</Link>}
      {!instructions && promptReady && <Link href="/install">Installation help</Link>}
    </div>}
    {message && <p role="status" className={styles.note}>{message}</p>}
    {instructions && !installed && <div className={styles.instructions} id="installation-steps">
      <details open={ios}><summary>iPhone or iPad · Safari</summary><ol><li>Open <strong>{app.host}/install</strong> in Safari.</li><li>Tap Share (or the page menu, then Share), then <strong>Add to Home Screen</strong>. Scroll through the actions if needed.</li><li>If shown, turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</li></ol></details>
      <details open={!ios}><summary>Android · Chrome</summary><ol><li>Open <strong>{app.host}/install</strong> in Chrome.</li><li>Tap <strong>Install app</strong> above when available, or open Chrome&apos;s three-dot menu and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li><li>Confirm the installation. Find the hostel icon on your Home Screen or in your app list.</li></ol></details>
      <details><summary>Computer or another browser</summary><p>In a supported browser such as Chrome or Edge, use the install icon in the address bar or the browser menu. If installation is unavailable, bookmark this website and use all services in your browser.</p></details>
      <p className={styles.note}>Opened from WhatsApp, Facebook or another app? Use its menu to open this page in Chrome or Safari first. If already installed, open your existing hostel icon.</p>
    </div>}
    <p className={styles.host}>Installation is optional and needs your confirmation. Account approval still applies. Internet is required for current records and changes.</p>
  </section>;
}
