import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// Plus Jakarta Sans (variável, subconjunto latino) guardada no projeto: o build não depende do Google Fonts,
// que chegou a derrubar o deploy ("next/font/google queries have exactly one entry").
const jakarta = localFont({ src: "./fonts/plus-jakarta-sans-latin.woff2", variable: "--font-jakarta", weight: "300 800", style: "normal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GoMob — Mobilidade inteligente. Viaje melhor.", template: "%s · GoMob" },
  description: "Mobilidade urbana inteligente para São Paulo. Projeto acadêmico de demonstração.",
  manifest: "/manifest.webmanifest",
  // logos e ícones gerados por scripts/build-brand.mjs a partir de assets/branding/gomob-logo-source.webp
  icons: {
    // src/app/favicon.ico (16/32/48) é incluído automaticamente pelo Next.js
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" }],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    title: "GoMob — Mobilidade inteligente. Viaje melhor.",
    description: "Saiba qual ônibus pegar, onde embarcar e onde descer em São Paulo.",
    locale: "pt_BR",
    images: [{ url: "/branding/gomob-og.png", width: 630, height: 630, alt: "Logo do GoMob" }],
  },
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
