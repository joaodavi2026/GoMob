/** O worker ESM do MapLibre v6 é servido de /public/vendor (ver scripts/copy-maplibre-worker.mjs). */
export function configureMaplibreWorker(ml: typeof import("maplibre-gl")) {
  const url = new URL("/vendor/maplibre-gl-worker.mjs", window.location.origin).href;
  if (ml.getWorkerUrl() !== url) ml.setWorkerUrl(url);
}
