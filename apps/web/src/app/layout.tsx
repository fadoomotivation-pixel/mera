import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

/** Display face for headlines and money. Fraunces is a modern serif with real
 * optical sizing — it gives MERA MAKAN the weight of a property brand rather
 * than the flatness of a dashboard, without imitating anyone. */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

/** UI face. Inter is chosen for one reason: at 13–15px on a mid-range Android
 * screen it stays unambiguous, which matters more here than personality. */
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

/** The tagline is not decoration — it is the brand. It deserves a real
 * Devanagari face rather than a system fallback. */
const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MERA MAKAN — अपनी ज़मीन, अपनी पहचान",
  description:
    "Fully developed society plots — roads, electricity, water, park, market and guest house — on a transparent 90-day payment plan.",
};

export const viewport: Viewport = {
  themeColor: "#0B1D33",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${deva.variable}`}>
      <body className="bg-ivory-100 text-navy-900 antialiased">{children}</body>
    </html>
  );
}
