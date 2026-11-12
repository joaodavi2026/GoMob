import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoMob — Mobilidade Urbana Inteligente",
    short_name: "GoMob",
    description: "Rotas inteligentes, ônibus ao vivo e risco de lotação em São Paulo. Projeto acadêmico de demonstração.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#FF6B00",
    lang: "pt-BR",
    categories: ["navigation", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
