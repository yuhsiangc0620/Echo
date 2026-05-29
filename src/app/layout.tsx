import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import PwaRegister from "@/app/_components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display face — Fraunces variable axes (opsz / SOFT / WONK) give
// playful-yet-refined character that pairs with the candy aesthetic without
// falling into generic Inter / Roboto territory.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Echo | Digital Labor Candy",
  description: "A desktop and mobile prototype for Echo's edge-audio candy drops.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Echo",
  },
  applicationName: "Echo",
  icons: {
    icon: [
      { url: "/echo-icon.svg", type: "image/svg+xml" },
      { url: "/echo-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/echo-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
