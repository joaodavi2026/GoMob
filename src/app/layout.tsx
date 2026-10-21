import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "GoMob — Go smarter. Ride better.", template: "%s · GoMob" },
  description: "Intelligent urban mobility for São Paulo. Academic demonstration project.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon-64.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#FF6B00", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
