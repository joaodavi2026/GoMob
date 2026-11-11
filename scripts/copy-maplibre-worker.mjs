// Copia o worker do MapLibre v6 para /public: o Turbopack não empacota o worker ESM automaticamente.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public/vendor", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), "public/vendor/maplibre-gl-worker.mjs");
console.log("maplibre worker -> public/vendor/maplibre-gl-worker.mjs");
