"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { configureMaplibreWorker } from "@/components/maps/maplibre-worker";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
export type MapStop = { id: string; name: string; lat: number; lon: number };
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function stopsGeo(stops: MapStop[], selected: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((s, i) => ({
      type: "Feature",
      properties: { id: s.id, name: s.name, end: i === 0 || i === stops.length - 1 ? 1 : 0, sel: s.id === selected ? 1 : 0 },
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    })),
  };
}

/** Mapa de uma linha: trajeto na cor da linha, paradas (toque para ver as chegadas) e ônibus ao vivo. */
export default function LineMap({
  stops,
  color,
  buses,
  selected,
  onStop,
}: {
  stops: MapStop[];
  color: string;
  buses: [number, number][]; // [lat, lon]
  selected: string | null;
  onStop: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const pick = useRef(onStop);
  useEffect(() => {
    pick.current = onStop;
  });

  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      mlRef.current = ml;
      configureMaplibreWorker(ml);
      map = new ml.Map({ container: box.current, style: STYLE, center: [-46.6333, -23.5505], zoom: 11, attributionControl: { compact: true } });
      mapRef.current = map;
      // "style.load" chega antes de "load" (que espera todos os blocos do mapa): o trajeto aparece logo
      map.once("style.load", () => {
        const m = map!;
        m.addSource("path", { type: "geojson", data: EMPTY });
        m.addSource("stops", { type: "geojson", data: EMPTY });
        m.addSource("buses", { type: "geojson", data: EMPTY });
        m.addLayer({ id: "path-casing", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
        m.addLayer({ id: "path", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 5 } });
        m.addLayer({
          id: "stops",
          type: "circle",
          source: "stops",
          paint: {
            "circle-radius": ["case", ["==", ["get", "sel"], 1], 9, ["==", ["get", "end"], 1], 7, 4.5],
            "circle-color": ["case", ["==", ["get", "sel"], 1], "#ff6b00", "#ffffff"],
            "circle-stroke-color": color,
            "circle-stroke-width": ["case", ["==", ["get", "end"], 1], 4, 2.5],
          },
        });
        m.addLayer({ id: "buses", type: "circle", source: "buses", paint: { "circle-radius": 8, "circle-color": "#12151b", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
        m.on("click", "stops", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") pick.current(id);
        });
        m.on("mouseenter", "stops", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "stops", () => (m.getCanvas().style.cursor = ""));
        setReady(true);
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // a cor não muda enquanto a linha está aberta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // trajeto do sentido escolhido: desenha e enquadra
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready || stops.length < 2) return;
    (map.getSource("path") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops.map((s) => [s.lon, s.lat]) } });
    const b = new ml.LngLatBounds();
    stops.forEach((s) => b.extend([s.lon, s.lat]));
    map.fitBounds(b, { padding: 36, duration: 500, maxZoom: 15 });
  }, [stops, ready]);

  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("stops") as GeoJSONSource | undefined)?.setData(stopsGeo(stops, selected));
  }, [stops, selected, ready]);

  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("buses") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: buses.map(([lat, lon]) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lon, lat] } })),
    });
  }, [buses, ready]);

  // o CSS do MapLibre põe position: relative no container; o tamanho vem do invólucro
  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" role="region" aria-label="Mapa do trajeto da linha" />
    </div>
  );
}
