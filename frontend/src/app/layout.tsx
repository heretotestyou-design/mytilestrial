import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Headings: geometric sans with clean, lining figures (prices read well). Body: Inter.
const display = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans.woff2", weight: "500 800", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-italic.woff2", weight: "500 800", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/inter.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "MyTilesTrial — See every tile before it's laid", template: "%s · MyTilesTrial" },
  description:
    "Photorealistic AI tile previews for showrooms, designers and homeowners. Upload a room, pick a tile, and see it laid in seconds. Pay per render in ₹.",
  openGraph: {
    title: "MyTilesTrial — See every tile before it's laid",
    description: "Photorealistic AI tile previews in seconds. Start free with 5 renders.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#12100E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
