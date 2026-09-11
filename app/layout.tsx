import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Red Dot Audit — Follow the Public Record",
  description: "Source-linked public-record analysis comparing documented authority with observed government technology activity.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
