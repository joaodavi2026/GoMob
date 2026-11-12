import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A busca de rotas lê a rede GTFS do disco no servidor: garante o arquivo no pacote de produção.
  outputFileTracingIncludes: {
    "/api/routes/search": ["./public/gtfs/network.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
