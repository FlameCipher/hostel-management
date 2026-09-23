import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hostel.sampesa.com"),
  title: { default: "MMAMBUGUA HOSTEL | Student Accommodation near JKUAT", template: "%s | MMAMBUGUA HOSTEL" },
  description: "Affordable private and shared student accommodation approximately 500 metres from JKUAT Gate B in Juja, Kenya.",
  keywords: ["JKUAT hostel","Juja student hostel","hostel near JKUAT","student accommodation Juja","MMAMBUGUA HOSTEL"],
  openGraph: { title:"MMAMBUGUA HOSTEL | Student Accommodation near JKUAT", description:"Private and shared student accommodation near JKUAT Gate B, Juja.", type:"website", locale:"en_KE", siteName:"MMAMBUGUA HOSTEL" },
  robots: { index:true, follow:true },
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><body>{children}</body></html>;
}
