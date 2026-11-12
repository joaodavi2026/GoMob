import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["300", "400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "GoMob — Mobilidade inteligente. Viaje melhor.", template: "%s · GoMob" },
  description: "Mobilidade urbana inteligente para São Paulo. Projeto acadêmico de demonstração.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon-64.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#F1F2F5", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
