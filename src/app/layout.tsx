import type { Metadata, Viewport } from "next";
import "./globals.css";
import { requestPropertyContext } from "@/lib/property-host";

import { hostelAppIdentity } from "@/lib/hostel-app";
import { HostelAppProvider } from "@/components/hostel-app";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#344753" };

const directoryMetadata: Metadata = {
 metadataBase:new URL("https://studentshostels.com"),
 title:{default:"StudentsHostels | Student accommodation",template:"%s | StudentsHostels"},
 description:"Discover student hostels, explore room availability and access your hostel account.",
};

export async function generateMetadata(): Promise<Metadata> {
 const {host,property}=await requestPropertyContext();
 const app=hostelAppIdentity(host,property);
 return property ? {metadataBase:new URL(`https://${property.customDomain}`),title:{default:property.name,template:`%s | ${property.name}`},description:property.publicDescription ?? `Student accommodation at ${property.name}`,
  ...(app ? {applicationName:app.name,manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:app.shortName,statusBarStyle:"default"},icons:{icon:[{url:"/app-icons/192",sizes:"192x192",type:"image/png"}],apple:[{url:"/app-icons/180",sizes:"180x180",type:"image/png"}]}} : {}),
 } : directoryMetadata;
}
export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 const {host,property}=await requestPropertyContext();
 return <html lang="en"><body><HostelAppProvider app={hostelAppIdentity(host,property)}>{children}</HostelAppProvider></body></html>;
}
