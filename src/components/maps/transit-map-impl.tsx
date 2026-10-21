"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { Crosshair, LocateFixed } from "lucide-react";
import { SAO_PAULO_CENTER } from "@/config/transit";
import { cn } from "@/lib/utils";
import { classifyFreshness } from "@/server/transit/freshness";
import type { GeoPoint, TransitStop, TransitVehicle } from "@/types/transit";
import type { TransitMapProps } from "./transit-map";

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";
const BUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17212b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6v6M16 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';

function styleBusEl(el: HTMLElement, opts: { selected: boolean; stale: boolean }) {
  const size = opts.selected ? 40 : 30;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.background = "#fff";
  el.style.border = `3px solid ${opts.stale ? "#94a3b8" : "#ff6b00"}`;
  el.style.boxShadow = opts.selected ? "0 4px 14px rgba(255,107,0,.45)" : "0 1px 4px rgba(23,33,43,.3)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.opacity = opts.stale ? "0.65" : "1";
  el.style.zIndex = opts.selected ? "5" : "1";
  el.style.transition = "width .15s, height .15s, box-shadow .15s";
  el.style.padding = "0";
}

type VMarker = { marker: MlMarker; el: HTMLButtonElement };

export default function TransitMapImpl({
  vehicles,
  stops,
  highlightPath,
  pathColor = "#ff6b00",
  selectedVehicleId,
  onSelectVehicle,
  onPickPoint,
  pickedPoint,
  extraPoints,
  showLocate = true,
  showReset = true,
  fitToPath = true,
  now,
  className,
  children,
}: TransitMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const loadedRef = useRef(false);
  const markers = useRef(new Map<string, VMarker>());
  const stopMarkers = useRef<MlMarker[]>([]);
  const pickMarker = useRef<MlMarker | null>(null);
  const extraMarkers = useRef<MlMarker[]>([]);
  const meMarker = useRef<MlMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  // callbacks estáveis
  const cb = useRef({ onSelectVehicle, onPickPoint });
  useEffect(() => {
    cb.current = { onSelectVehicle, onPickPoint };
  }, [onSelectVehicle, onPickPoint]);

  // init
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const mod = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      mlRef.current = ml;
      map = new ml.Map({
        container: container.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE,
        center: [SAO_PAULO_CENTER.longitude, SAO_PAULO_CENTER.latitude],
        zoom: 11,
        attributionControl: { compact: true },
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        loadedRef.current = true;
        setReady(true);
      });
      map.on("click", (e) => {
        if (cb.current.onPickPoint) {
          cb.current.onPickPoint({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
        } else {
          cb.current.onSelectVehicle?.(null);
        }
      });
      mapRef.current = map;
    })().catch(() => setGeoMsg("The map could not be loaded."));
    const vm = markers.current;
    return () => {
      cancelled = true;
      vm.forEach((m) => m.marker.remove());
      vm.clear();
      map?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // veículos
  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ready || !ml || !map) return;
    const t = now ?? Date.now();
    const seen = new Set<string>();
    for (const v of vehicles as TransitVehicle[]) {
      seen.add(v.id);
      const stale = classifyFreshness(v.observedAt, t) !== "FRESH";
      const selected = v.id === selectedVehicleId;
      let m = markers.current.get(v.id);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        el.innerHTML = BUS_SVG;
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          cb.current.onSelectVehicle?.(v.id);
        });
        const marker = new ml.Marker({ element: el }).setLngLat([v.longitude, v.latitude]).addTo(map);
        m = { marker, el };
        markers.current.set(v.id, m);
      } else {
        m.marker.setLngLat([v.longitude, v.latitude]);
      }
      m.el.setAttribute("aria-label", `Bus ${v.id}${stale ? ", last position is outdated" : ""}${selected ? ", selected" : ""}`);
      styleBusEl(m.el, { selected, stale });
    }
    markers.current.forEach((m, id) => {
      if (!seen.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    });
  }, [vehicles, selectedVehicleId, ready, now]);

  // centraliza no veículo selecionado
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedVehicleId) return;
    const v = vehicles.find((x) => x.id === selectedVehicleId);
    if (v) map.easeTo({ center: [v.longitude, v.latitude], zoom: Math.max(map.getZoom(), 14), duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId, ready]);

  // trajeto destacado
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!ready || !map || !ml) return;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: highlightPath ?? [] },
    };
    const src = map.getSource("gomob-path") as import("maplibre-gl").GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      map.setPaintProperty("gomob-path-line", "line-color", pathColor);
    } else {
      map.addSource("gomob-path", { type: "geojson", data });
      map.addLayer({
        id: "gomob-path-casing",
        type: "line",
        source: "gomob-path",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "gomob-path-line",
        type: "line",
        source: "gomob-path",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": pathColor, "line-width": 5 },
      });
    }
    if (fitToPath && highlightPath && highlightPath.length > 1) {
      const b = new ml.LngLatBounds(highlightPath[0], highlightPath[0]);
      highlightPath.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 60, duration: 500, maxZoom: 15 });
    }
  }, [highlightPath, pathColor, ready, fitToPath]);

  // paradas
  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ready || !ml || !map) return;
    stopMarkers.current.forEach((m) => m.remove());
    stopMarkers.current = [];
    for (const s of (stops ?? []) as TransitStop[]) {
      const el = document.createElement("div");
      el.title = s.name;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `Stop: ${s.name}`);
      Object.assign(el.style, { width: "10px", height: "10px", borderRadius: "9999px", background: "#fff", border: "2px solid #17212b" });
      stopMarkers.current.push(new ml.Marker({ element: el }).setLngLat([s.longitude, s.latitude]).addTo(map));
    }
  }, [stops, ready]);

  // ponto escolhido + pontos extras (origem/destino)
  useEffect(() => {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ready || !ml || !map) return;
    pickMarker.current?.remove();
    pickMarker.current = null;
    if (pickedPoint) pickMarker.current = new ml.Marker({ color: "#ff6b00" }).setLngLat([pickedPoint.longitude, pickedPoint.latitude]).addTo(map);
    extraMarkers.current.forEach((m) => m.remove());
    extraMarkers.current = (extraPoints ?? []).map((p: GeoPoint) =>
      new ml.Marker({ color: "#17212b" }).setLngLat([p.longitude, p.latitude]).setPopup(new ml.Popup({ offset: 24 }).setText(p.label ?? "Point")).addTo(map),
    );
  }, [pickedPoint, extraPoints, ready]);

  function resetView() {
    mapRef.current?.flyTo({ center: [SAO_PAULO_CENTER.longitude, SAO_PAULO_CENTER.latitude], zoom: 11, duration: 600 });
  }

  function locate() {
    const ml = mlRef.current;
    const map = mapRef.current;
    if (!ml || !map) return;
    if (!("geolocation" in navigator)) return setGeoMsg("Location is not available on this device.");
    setGeoMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const el = document.createElement("div");
        Object.assign(el.style, { width: "16px", height: "16px", borderRadius: "9999px", background: "#2563eb", border: "3px solid #fff", boxShadow: "0 0 0 4px rgba(37,99,235,.25)" });
        el.setAttribute("aria-label", "Your location");
        meMarker.current?.remove();
        meMarker.current = new ml.Marker({ element: el }).setLngLat([pos.coords.longitude, pos.coords.latitude]).addTo(map);
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 600 });
      },
      () => setGeoMsg("Location permission was not granted."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-canvas", className)}>
      <div ref={container} className="absolute inset-0" role="application" aria-label="Map of São Paulo" />
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        {showReset && (
          <button type="button" onClick={resetView} className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-medium shadow-soft hover:bg-canvas">
            <Crosshair className="h-4 w-4" aria-hidden /> Reset view
          </button>
        )}
        {showLocate && (
          <button type="button" onClick={locate} aria-label="Show my location" className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white shadow-soft hover:bg-canvas">
            <LocateFixed className="h-4 w-4" aria-hidden />
          </button>
        )}
        {geoMsg && <p role="status" className="max-w-[14rem] rounded-lg bg-ink px-3 py-1.5 text-xs text-white">{geoMsg}</p>}
      </div>
      {children}
    </div>
  );
}
