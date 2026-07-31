import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "FormPilot — Input data, dengan kendali",
    description: "AI operator untuk mempelajari, memetakan, dan mengisi form dengan persetujuan manusia.",
    alternates: { canonical: "https://form-pilot.aksarateknologi.com/" },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "FormPilot", description: "Input data, dengan kendali.", url: "https://form-pilot.aksarateknologi.com/", siteName: "FormPilot by Aksara Bayu Teknologi", images: [{ url: "/og.png", width: 1730, height: 909 }] },
    twitter: { card: "summary_large_image", title: "FormPilot", description: "Input data, dengan kendali.", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
