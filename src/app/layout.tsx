import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
 metadataBase:new URL("https://studentshostels.com"),
 title:{default:"StudentsHostels | Student accommodation",template:"%s | StudentsHostels"},
 description:"Discover student hostels, explore room availability and access your hostel account.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><body>{children}</body></html>;
}
