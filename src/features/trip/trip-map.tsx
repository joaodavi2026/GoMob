"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { configureMaplibreWorker } from "@/components/maps/maplibre-worker";
import type { LL, Trip } from "./logic";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const ORANGE = "#ff6b00";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const line = (pts: LL[]): GeoJSON.Feature => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) } });

function pinEl(label: string, kind: "board" | "alight" | "dest") {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  const bg = kind === "dest" ? "#12151b" : kind === "board" ? ORANGE : "#ffffff";
  const fg = kind === "alight" ? ORANGE : "#ffffff";
  el.style.cssText = `display:flex;align-items:center;gap:6px;transform:translateY(-6px);font:700 12px var(--font-sans),sans-serif;`;
  el.innerHTML = `<span style="display:flex;height:30px;min-width:30px;padding:0 8px;align-items:center;justify-content:center;border-radius:999px;background:${bg};color:${fg};border:3px solid ${ORANGE};box-shadow:0 4px 12px rgba(0,0,0,.25)">${label}</span>`;
  return el;
}

export function TripMap({
  trip,
  user,
  buses,
  follow,
  onUserPan,
  bottomPad,
}: {
  trip: Trip;
  user: LL | null;
  buses: LL[];
  follow: boolean;
  onUserPan: () => void;
  bottomPad: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userMarker = useRef<Marker | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const panCb = useRef(onUserPan);
  useEffect(() => {
    panCb.current = onUserPan;
  });

  // mapa + camadas do trajeto
  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      mlRef.current = ml;
      configureMaplibreWorker(ml);
      map = new ml.Map({ container: box.current, style: STYLE, center: [trip.origin.lon, trip.origin.lat], zoom: 14, attributionControl: { compact: true } });
      mapRef.current = map;
      map.on("dragstart", () => panCb.current());
      map.on("load", () => {
        const m = map!;
        const lastLeg = trip.legs[trip.legs.length - 1];
        m.addSource("walk", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [line([trip.origin, trip.legs[0].stops[0]]), line([lastLeg.stops.at(-1)!, trip.destination])] },
        });
        m.addSource("ride", { type: "geojson", data: { type: "FeatureCollection", features: trip.legs.map((l) => line(l.stops)) } });
        m.addSource("stops", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: trip.legs.flatMap((l) => l.stops.map((s) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] } }))),
          },
        });
        m.addSource("buses", { type: "geojson", data: EMPTY });
        m.addLayer({ id: "walk", type: "line", source: "walk", layout: { "line-cap": "round" }, paint: { "line-color": "#4f5664", "line-width": 4, "line-dasharray": [0.6, 1.6] } });
        m.addLayer({ id: "ride-casing", type: "line", source: "ride", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 11 } });
        m.addLayer({ id: "ride", type: "line", source: "ride", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ORANGE, "line-width": 7 } });
        m.addLayer({ id: "stops", type: "circle", source: "stops", paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": ORANGE, "circle-stroke-width": 2 } });
        m.addLayer({
          id: "buses",
          type: "circle",
          source: "buses",
          paint: { "circle-radius": 9, "circle-color": "#12151b", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
        });
        // pontos de embarque/desembarque e destino
        trip.legs.forEach((l, i) => {
          new ml.Marker({ element: pinEl(trip.legs.length > 1 ? `Embarque ${i + 1}` : "Embarque", "board"), anchor: "bottom" }).setLngLat([l.stops[0].lon, l.stops[0].lat]).addTo(m);
          new ml.Marker({ element: pinEl("Desça", "alight"), anchor: "bottom" }).setLngLat([l.stops.at(-1)!.lon, l.stops.at(-1)!.lat]).addTo(m);
        });
        new ml.Marker({ element: pinEl("Destino", "dest"), anchor: "bottom" }).setLngLat([trip.destination.lon, trip.destination.lat]).addTo(m);
        // enquadra a viagem inteira
        const b = new ml.LngLatBounds();
        [trip.origin, trip.destination, ...trip.legs.flatMap((l) => l.stops)].forEach((p) => b.extend([p.lon, p.lat]));
        m.fitBounds(b, { padding: { top: 300, bottom: bottomPad + 40, left: 50, right: 70 }, duration: 0, maxZoom: 16 });
        setReady(true);
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // o trajeto não muda enquanto o modo está aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  // você (ponto azul) e câmera seguindo
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready || !user) return;
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.className = "trip-me";
      el.setAttribute("aria-hidden", "true");
      userMarker.current = new ml.Marker({ element: el }).setLngLat([user.lon, user.lat]).addTo(map);
    } else userMarker.current.setLngLat([user.lon, user.lat]);
    if (follow) map.easeTo({ center: [user.lon, user.lat], zoom: Math.max(map.getZoom(), 16), padding: { top: 260, bottom: bottomPad, left: 0, right: 0 }, duration: 600 });
  }, [user, follow, ready, bottomPad]);

  // ônibus ao vivo da linha
  useEffect(() => {
    const src = mapRef.current?.getSource("buses") as GeoJSONSource | undefined;
    if (!src || !ready) return;
    src.setData({ type: "FeatureCollection", features: buses.map((b) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [b.lon, b.lat] } })) });
  }, [buses, ready]);

  // o CSS do MapLibre põe position: relative no container; o tamanho vem do invólucro
  return (
    <div className="absolute inset-0 z-0">
      <div ref={box} className="h-full w-full" role="region" aria-label="Mapa do trajeto com sua posição" />
      {/* zoom por botões (sem precisar de pinça), acima do painel inferior */}
      <div className="absolute right-3 z-10 flex flex-col overflow-hidden rounded-2xl bg-white shadow-float" style={{ bottom: bottomPad + 16 }}>
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Aproximar o mapa" className="flex h-12 w-12 items-center justify-center text-2xl font-bold text-ink">
          +
        </button>
        <span className="h-px bg-border" aria-hidden />
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Afastar o mapa" className="flex h-12 w-12 items-center justify-center text-2xl font-bold text-ink">
          −
        </button>
      </div>
    </div>
  );
}
