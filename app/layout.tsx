import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAR → HNMOD | Native Mod Converter",
  description: "Inspect Minecraft Java mods and prepare native Horizon mod conversions."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}