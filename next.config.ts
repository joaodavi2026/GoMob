import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/** Endereços desta máquina na rede local: permitem abrir o app (em desenvolvimento) pelo celular, no mesmo Wi-Fi. */
const lanHosts = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
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
