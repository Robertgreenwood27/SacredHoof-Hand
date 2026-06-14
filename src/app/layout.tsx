import type { Metadata } from "next";
import { Cormorant_Garamond, Lato } from "next/font/google";
import "./globals.css";

const heading = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const body = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Sacred Hoof & Hand — Reiki Healing",
  description:
    "Healing through Reiki, presence, and compassionate connection. Virtual and in-person Reiki sessions to help you reconnect with balance, clarity, and inner peace.",
  openGraph: {
    title: "Sacred Hoof & Hand — Reiki Healing",
    description:
      "Virtual and in-person Reiki sessions designed to help you reconnect with balance, clarity, and inner peace.",
    images: ["/horse-hero.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
