import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaxInfo | Vaccine Intelligence Platform",
  description:
    "Production-grade vaccine intelligence platform with intelligent search, analytics, chatbot memory, developer APIs, and export tooling."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
