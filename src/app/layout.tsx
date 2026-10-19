import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "CLON — Your life. Your rules. Your clone.", template: "%s · CLON" },
  description:
    "CLON is an open-source AI personal operating system: a Master Clone that orchestrates Communication, Work, Life and Fitness clones across your connected apps — with your approval.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#050816",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${grotesk.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
