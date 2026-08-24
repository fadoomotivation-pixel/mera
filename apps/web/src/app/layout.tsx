import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MERA MAKAN — अपनी ज़मीन, अपनी पहचान",
  description: "Fully developed society plots with a clear payment plan, from MERA MAKAN.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-ink-900 antialiased">{children}</body>
    </html>
  );
}
