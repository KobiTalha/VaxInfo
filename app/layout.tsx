import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaxInfo | Medical Vaccine Lookup",
  description:
    "Lightning-fast disease vaccine lookup system with WHO-structured categories and typo-tolerant search."
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
