import type { Metadata } from "next";
import "./globals.css";
import { requestPropertyContext } from "@/lib/property-host";

const directoryMetadata: Metadata = {
 metadataBase:new URL("https://studentshostels.com"),
 title:{default:"StudentsHostels | Student accommodation",template:"%s | StudentsHostels"},
 description:"Discover student hostels, explore room availability and access your hostel account.",
};

export async function generateMetadata(): Promise<Metadata> {
 const {property}=await requestPropertyContext();
 return property ? {metadataBase:new URL(`https://${property.customDomain}`),title:{default:property.name,template:`%s | ${property.name}`},description:property.publicDescription ?? `Student accommodation at ${property.name}`} : directoryMetadata;
}
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><body>{children}</body></html>;
}
