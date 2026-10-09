import type { MetadataRoute } from "next";

export type HostelAppIdentity = { id: string; name: string; shortName: string; host: string; initials: string; color: string };

// Identity comes only from the published property on the actual request host.
// It never depends on the current user, forwarded host, room or invitation URL.
export function hostelAppIdentity(host: string | null, property: { id: string; name: string; customDomain: string | null } | null): HostelAppIdentity | null {
  if (!property || !host || property.customDomain !== host) return null;
  const name = property.name.trim() || "Hostel";
  const words = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words.map(word => word[0]).join("").slice(0, 2).toUpperCase() || "H";
  const colors = ["#344753", "#254d53", "#3d4266", "#5a4054", "#38523f"];
  const hash = Array.from(property.id).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return { id: property.id, name, shortName: Array.from(name).slice(0, 24).join(""), host, initials, color: colors[hash % colors.length] };
}

export function hostelAppManifest(app: HostelAppIdentity): MetadataRoute.Manifest {
  return {
    id: `/open-app?hostel=${encodeURIComponent(app.id)}`,
    name: app.name,
    short_name: app.shortName,
    description: `Your ${app.name} account, messages and visitor services.`,
    start_url: "/open-app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7f8",
    theme_color: "#344753",
    icons: [
      { src: "/app-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tenant account", url: "/tenant/account" },
      { name: "Management", url: "/dashboard" },
    ],
  };
}
