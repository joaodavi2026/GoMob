"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { configureMaplibreWorker } from "@/components/maps/maplibre-worker";
import { initials } from "@/components/layout/hooks";
import type { Share } from "./use-family";

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const ORANGE = "#ff6b00";
const lineOf = (path: [number, number][]): GeoJSON.Feature => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } });

/** Mapa ao vivo do trajeto que um familiar está compartilhando: caminho, destino e a pessoa. */
export function FamilyMap({ share, bottomPad }: { share: Share; bottomPad: number }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const person = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  const first = useRef(share);

  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      mlRef.current = ml;
      configureMaplibreWorker(ml);
      const s = first.current;
      map = new ml.Map({ container: box.current, style: STYLE, center: [s.dest[1], s.dest[0]], zoom: 13, attributionControl: { compact: true } });
      mapRef.current = map;
      map.on("dragstart", () => setFollow(false));
      map.on("load", () => {
        const m = map!;
        m.addSource("path", { type: "geojson", data: lineOf(s.path) });
        m.addLayer({ id: "path-casing", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 10 } });
        m.addLayer({ id: "path", type: "line", source: "path", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ORANGE, "line-width": 6 } });
        const pin = document.createElement("div");
        pin.setAttribute("aria-hidden", "true");
        pin.innerHTML = `<span style="display:flex;height:30px;padding:0 10px;align-items:center;border-radius:999px;background:#12151b;color:#fff;border:3px solid ${ORANGE};font:700 12px var(--font-sans),sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25)">Destino</span>`;
        new ml.Marker({ element: pin, anchor: "bottom" }).setLngLat([s.dest[1], s.dest[0]]).addTo(m);
        const b = new ml.LngLatBounds();
        s.path.forEach((p) => b.extend(p));
        b.extend([s.dest[1], s.dest[0]]);
        m.fitBounds(b, { padding: { top: 190, bottom: bottomPad + 40, left: 50, right: 60 }, duration: 0, maxZoom: 16 });
        setReady(true);
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // o mapa é criado uma vez; as atualizações chegam pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pessoa (inicial do nome) e câmera
  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !ready) return;
    (map.getSource("path") as GeoJSONSource | undefined)?.setData(lineOf(share.path));
    if (!share.pos) return;
    const at: [number, number] = [share.pos[1], share.pos[0]];
    if (!person.current) {
      const el = document.createElement("div");
      el.className = "fam-pin";
      el.setAttribute("aria-hidden", "true");
      el.textContent = initials(share.name);
      person.current = new ml.Marker({ element: el }).setLngLat(at).addTo(map);
    } else person.current.setLngLat(at);
    if (follow) map.easeTo({ center: at, zoom: Math.max(map.getZoom(), 15), padding: { top: 170, bottom: bottomPad, left: 0, right: 0 }, duration: 900 });
  }, [share, ready, follow, bottomPad]);

  // o CSS do MapLibre põe position: relative no container; o tamanho vem do invólucro
  return (
    <div className="absolute inset-0 z-0">
      <div ref={box} className="h-full w-full" role="region" aria-label={`Mapa com a posição de ${share.name}`} />
      {!follow && share.pos && (
        <button type="button" onClick={() => setFollow(true)} className="tap absolute left-3 z-10 h-12 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow-float" style={{ bottom: bottomPad + 16 }}>
          Seguir {share.name.split(" ")[0]}
        </button>
      )}
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
