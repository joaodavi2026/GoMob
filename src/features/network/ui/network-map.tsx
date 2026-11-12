"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, MapGeoJSONFeature, Popup as MlPopup } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { SAO_PAULO_CENTER } from "@/config/transit";
import { configureMaplibreWorker } from "@/components/maps/maplibre-worker";
import { type FleetVehicle, type Network, fleetDir } from "../data";

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export type NetworkMapProps = {
  network: Network;
  shapesUrl: string;
  byCode: Map<string, number>;
  stopLines: number[][];
  selectedLine: number | null;
  selectedDir: number | null;
  focusStop: number | null;
  modes: number[];
  regions: string[];
  showStops: boolean;
  showLive: boolean;
  heatmap: boolean;
  dark: boolean;
  vehicles: FleetVehicle[];
  onSelectLine: (idx: number | null) => void;
  onSelectStop: (idx: number) => void;
};

type Tip = { x: number; y: number; html: string } | null;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---- camadas ---------------------------------------------------------------------------
function install(map: MlMap, shapes: GeoJSON.FeatureCollection, props: { current: NetworkMapProps }) {
  const { network } = props.current;
  map.addSource("net", { type: "geojson", data: shapes, tolerance: 0.2 });
  map.addSource("stops", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: network.stops.map((s, i) => ({
        type: "Feature",
        id: i,
        properties: { i, n: s[1] },
        geometry: { type: "Point", coordinates: [s[3], s[2]] },
      })),
    },
  });
  map.addSource("sel-stops", { type: "geojson", data: EMPTY });
  map.addSource("veh", { type: "geojson", data: EMPTY });

  const rail: ExpressionSpecification = ["!=", ["get", "t"], 3];
  map.addLayer({
    id: "net-lines",
    type: "line",
    source: "net",
    layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["case", rail, 10, 0] },
    paint: {
      "line-color": ["get", "c"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["case", rail, 2.5, 0.5], 13, ["case", rail, 5, 1.6], 16, ["case", rail, 8, 3.5]],
      "line-opacity": 0.55,
    },
  });
  map.addLayer({
    id: "net-hover",
    type: "line",
    source: "net",
    filter: ["==", ["get", "l"], -1],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 16, 8], "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "net-sel-casing",
    type: "line",
    source: "net",
    filter: ["==", ["get", "l"], -1],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 16, 14], "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "net-sel",
    type: "line",
    source: "net",
    filter: ["==", ["get", "l"], -1],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 16, 9] },
  });
  map.addLayer({
    id: "stops-all",
    type: "circle",
    source: "stops",
    minzoom: 13.5,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 13.5, 1.8, 17, 5],
      "circle-color": "#ffffff",
      "circle-stroke-color": "#687482",
      "circle-stroke-width": 1,
      "circle-opacity": 0.9,
    },
  });
  map.addLayer({
    id: "sel-stops",
    type: "circle",
    source: "sel-stops",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 4.5, 17, 8],
      "circle-color": "#ffffff",
      "circle-stroke-color": ["get", "c"],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 1.5, 16, 3],
    },
  });
  map.addLayer({
    id: "sel-stops-label",
    type: "symbol",
    source: "sel-stops",
    minzoom: 13,
    layout: {
      "text-field": ["get", "n"],
      "text-size": 11,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
      "text-font": ["Noto Sans Regular"],
    },
    paint: { "text-color": props.current.dark ? "#f1f5f9" : "#17212b", "text-halo-color": props.current.dark ? "#0b1220" : "#ffffff", "text-halo-width": 1.4 },
  });
  map.addLayer({
    id: "veh-heat",
    type: "heatmap",
    source: "veh",
    maxzoom: 15,
    layout: { visibility: "none" },
    paint: {
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 6, 14, 22],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 14, 1.4],
      "heatmap-opacity": 0.75,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(255,107,0,0)", 0.2, "rgba(255,186,120,0.55)", 0.45, "#ff9a3c", 0.7, "#ff6b00", 1, "#b42318",
      ],
    },
  });
  map.addLayer({
    id: "veh",
    type: "circle",
    source: "veh",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2, 12, 3.5, 16, 7],
      "circle-color": ["get", "c"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 1.5],
      "circle-opacity": ["case", [">", ["get", "age"], 180], 0.45, 1],
    },
  });
}

function wireEvents(
  map: MlMap,
  ml: typeof import("maplibre-gl"),
  props: { current: NetworkMapProps },
  popupRef: { current: MlPopup | null },
  setTip: (t: Tip) => void,
) {
  let raf = 0;
  const hoverLayers = ["veh", "sel-stops", "stops-all", "net-sel", "net-lines"];
  const pick = (pt: { x: number; y: number }, pad = 5) => {
    const layers = hoverLayers.filter((l) => map.getLayer(l));
    return map.queryRenderedFeatures(
      [
        [pt.x - pad, pt.y - pad],
        [pt.x + pad, pt.y + pad],
      ],
      { layers },
    );
  };
  const lineOf = (f: MapGeoJSONFeature) => Number(f.properties?.l);

  map.on("mousemove", (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!map.getLayer("net-hover")) return;
      const { network, selectedLine } = props.current;
      const feats = pick(e.point);
      const top = feats[0];
      map.getCanvas().style.cursor = top ? "pointer" : "";
      if (!top) {
        map.setFilter("net-hover", ["==", ["get", "l"], -1]);
        setTip(null);
        return;
      }
      if (top.layer.id === "veh") {
        map.setFilter("net-hover", ["==", ["get", "l"], -1]);
        setTip({ x: e.point.x, y: e.point.y, html: `<b>${esc(String(top.properties.code))}</b> · ônibus ${esc(String(top.properties.p))}` });
        return;
      }
      if (top.layer.id === "stops-all" || top.layer.id === "sel-stops") {
        const s = network.stops[Number(top.properties.i)];
        const n = props.current.stopLines[Number(top.properties.i)]?.length ?? 0;
        setTip({ x: e.point.x, y: e.point.y, html: `<b>${esc(s?.[1] ?? "Parada")}</b><br/><span>${n} linha${n === 1 ? "" : "s"}</span>` });
        return;
      }
      const idxs = [...new Set(feats.filter((f) => f.layer.id.startsWith("net")).map(lineOf))];
      const li = idxs[0];
      if (selectedLine === null) map.setFilter("net-hover", ["==", ["get", "l"], li]);
      const l = network.lines[li];
      if (!l) return setTip(null);
      const more = idxs.length > 1 ? `<br/><span>+${idxs.length - 1} outras linhas aqui · toque para escolher</span>` : "";
      setTip({ x: e.point.x, y: e.point.y, html: `<b>${esc(l.code)}</b> ${esc(l.name)}${more}` });
    });
  });
  map.on("mouseout", () => {
    setTip(null);
    if (map.getLayer("net-hover")) map.setFilter("net-hover", ["==", ["get", "l"], -1]);
  });

  map.on("click", (e) => {
    const { network, onSelectLine, onSelectStop, byCode } = props.current;
    popupRef.current?.remove();
    const feats = pick(e.point, 6);
    const top = feats[0];
    if (!top) return;
    if (top.layer.id === "veh") {
      const pr = top.properties;
      const li = byCode.get(String(pr.code));
      const line = li !== undefined ? network.lines[li] : null;
      const dir = line?.dirs.find((d) => d.d === Number(pr.dir));
      const age = Number(pr.age);
      const el = document.createElement("div");
      el.className = "gm-pop";
      el.innerHTML = `
        <div class="gm-pop-badge" style="background:${line?.color ?? "#ff6b00"};color:${line?.textColor ?? "#fff"}">${esc(String(pr.code))}</div>
        <div class="gm-pop-title">${esc(line?.name ?? "Linha desconhecida")}</div>
        ${dir ? `<div class="gm-pop-sub">Para ${esc(dir.headsign)}</div>` : ""}
        <div class="gm-pop-grid">
          <span>Veículo</span><b>${esc(String(pr.p))}</b>
          <span>Acessível</span><b>${Number(pr.a) ? "♿ Veículo cadastrado como acessível" : "Sem registro de acessibilidade"}</b>
          <span>Último GPS</span><b>${age < 0 ? "—" : age < 60 ? `há ${age}s` : `há ${Math.round(age / 60)} min`}</b>
        </div>
        ${line ? `<button type="button" class="gm-pop-btn">Ver esta linha</button>` : ""}`;
      el.querySelector("button")?.addEventListener("click", () => {
        popupRef.current?.remove();
        if (li !== undefined) onSelectLine(li);
      });
      popupRef.current = new ml.Popup({ closeButton: true, maxWidth: "260px", offset: 8 }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
      return;
    }
    if (top.layer.id === "stops-all" || top.layer.id === "sel-stops") {
      onSelectStop(Number(top.properties.i));
      return;
    }
    const idxs = [...new Set(feats.filter((f) => f.layer.id.startsWith("net")).map(lineOf))];
    if (idxs.length === 1) {
      onSelectLine(idxs[0]);
      return;
    }
    const el = document.createElement("div");
    el.className = "gm-pop";
    el.innerHTML = `<div class="gm-pop-title">${idxs.length} linhas aqui</div><div class="gm-pop-list"></div>`;
    const list = el.querySelector(".gm-pop-list")!;
    for (const li of idxs.slice(0, 12)) {
      const l = network.lines[li];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gm-pop-row";
      b.innerHTML = `<span class="gm-pop-badge" style="background:${l.color};color:${l.textColor}">${esc(l.code)}</span><span>${esc(l.name)}</span>`;
      b.addEventListener("click", () => {
        popupRef.current?.remove();
        onSelectLine(li);
      });
      list.appendChild(b);
    }
    if (idxs.length > 12) list.insertAdjacentHTML("beforeend", `<div class="gm-pop-sub">+${idxs.length - 12} mais — aproxime o mapa</div>`);
    popupRef.current = new ml.Popup({ closeButton: true, maxWidth: "300px", offset: 8 }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
  });
}


export default function NetworkMap(p: NetworkMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const shapesRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const props = useRef(p);
  const [styleTick, setStyleTick] = useState(0); // incrementa a cada estilo (re)carregado com camadas instaladas
  const [loadingShapes, setLoadingShapes] = useState(true);
  const [tip, setTip] = useState<Tip>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    props.current = p;
  });

  // ---- init ------------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const [mod, shapes] = await Promise.all([
        import("maplibre-gl"),
        fetch(p.shapesUrl).then((r) => {
          if (!r.ok) throw new Error("shapes");
          return r.json() as Promise<GeoJSON.FeatureCollection>;
        }),
      ]);
      if (cancelled || !box.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      mlRef.current = ml;
      configureMaplibreWorker(ml);
      shapesRef.current = shapes;
      setLoadingShapes(false);
      map = new ml.Map({
        container: box.current,
        style: props.current.dark ? STYLES.dark : STYLES.light,
        center: [SAO_PAULO_CENTER.longitude, SAO_PAULO_CENTER.latitude],
        zoom: 10.3,
        minZoom: 8,
        maxZoom: 18,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-right");
      map.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");

      map.on("style.load", () => {
        install(map!, shapesRef.current ?? EMPTY, props);
        setStyleTick((t) => t + 1);
      });
      wireEvents(map, ml, props, popupRef, setTip);
    })().catch(() => {
      setLoadingShapes(false);
      setErr("Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.");
    });
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- estilo claro/escuro ---------------------------------------------------------------
  const darkRef = useRef(p.dark);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || darkRef.current === p.dark) return;
    darkRef.current = p.dark;
    map.setStyle(p.dark ? STYLES.dark : STYLES.light);
  }, [p.dark]);

  // ---- filtros de rede (modo / região / seleção) -----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleTick || !map.getLayer("net-lines")) return;
    const base: unknown[] = ["all", ["in", ["get", "t"], ["literal", p.modes]]];
    if (p.regions.length) base.push(["any", ["!=", ["get", "t"], 3], ["in", ["get", "c"], ["literal", p.regions]]]);
    map.setFilter("net-lines", base as never);
    map.setPaintProperty("net-lines", "line-opacity", p.selectedLine === null ? (p.dark ? 0.7 : 0.55) : 0.07);
    const sel: unknown[] =
      p.selectedLine === null
        ? ["==", ["get", "l"], -1]
        : p.selectedDir === null
          ? ["==", ["get", "l"], p.selectedLine]
          : ["all", ["==", ["get", "l"], p.selectedLine], ["==", ["get", "d"], p.selectedDir]];
    map.setFilter("net-sel", sel as never);
    map.setFilter("net-sel-casing", sel as never);
    map.setFilter("net-hover", ["==", ["get", "l"], -1]);
  }, [styleTick, p.modes, p.regions, p.selectedLine, p.selectedDir, p.dark]);

  // ---- paradas da linha selecionada + enquadramento ----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("sel-stops") as GeoJSONSource | undefined;
    if (!map || !styleTick || !src) return;
    if (p.selectedLine === null) {
      src.setData(EMPTY);
      return;
    }
    const line = p.network.lines[p.selectedLine];
    const dirs = line.dirs.filter((d) => p.selectedDir === null || d.d === p.selectedDir);
    const seen = new Set<number>();
    const features: GeoJSON.Feature[] = [];
    for (const d of dirs)
      for (const s of d.stops) {
        if (seen.has(s)) continue;
        seen.add(s);
        const st = p.network.stops[s];
        features.push({ type: "Feature", properties: { i: s, n: st[1], c: line.color }, geometry: { type: "Point", coordinates: [st[3], st[2]] } });
      }
    src.setData({ type: "FeatureCollection", features });
  }, [styleTick, p.selectedLine, p.selectedDir, p.network]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    const shapes = shapesRef.current;
    if (!map || !ml || !shapes || p.selectedLine === null) return;
    const line = p.network.lines[p.selectedLine];
    const b = new ml.LngLatBounds();
    let any = false;
    for (const d of line.dirs) {
      if (d.shape === null) continue;
      const f = shapes.features[d.shape];
      for (const c of (f.geometry as GeoJSON.LineString).coordinates) {
        b.extend(c as [number, number]);
        any = true;
      }
    }
    if (!any)
      for (const d of line.dirs)
        for (const s of d.stops) {
          b.extend([p.network.stops[s][3], p.network.stops[s][2]]);
          any = true;
        }
    if (!any) return;
    const wide = box.current && box.current.clientWidth >= 1024;
    map.fitBounds(b, { padding: wide ? { top: 60, bottom: 60, left: 440, right: 70 } : { top: 80, bottom: Math.round((box.current?.clientHeight ?? 700) * 0.58), left: 40, right: 70 }, maxZoom: 15, duration: 900 });
  }, [p.selectedLine, p.network, loadingShapes]);

  // ---- foco em parada ----------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || p.focusStop === null) return;
    const s = p.network.stops[p.focusStop];
    if (!s) return;
    const wide = box.current && box.current.clientWidth >= 1024;
    map.flyTo({ center: [s[3], s[2]], zoom: Math.max(map.getZoom(), 15.5), duration: 800, offset: wide ? [190, 0] : [0, -Math.round((box.current?.clientHeight ?? 700) * 0.28)] });
  }, [p.focusStop, p.network]);

  // ---- camadas opcionais -----------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleTick || !map.getLayer("stops-all")) return;
    map.setLayoutProperty("stops-all", "visibility", p.showStops ? "visible" : "none");
    map.setLayoutProperty("veh", "visibility", p.showLive && !p.heatmap ? "visible" : "none");
    map.setLayoutProperty("veh-heat", "visibility", p.showLive && p.heatmap ? "visible" : "none");
    // com heatmap: pontos só aparecem de perto
    if (p.showLive && p.heatmap) {
      map.setLayoutProperty("veh", "visibility", "visible");
      map.setLayerZoomRange("veh", 14, 24);
    } else map.setLayerZoomRange("veh", 0, 24);
  }, [styleTick, p.showStops, p.showLive, p.heatmap]);

  // ---- veículos ao vivo ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("veh") as GeoJSONSource | undefined;
    if (!map || !styleTick || !src) return;
    const sel = p.selectedLine !== null ? p.network.lines[p.selectedLine] : null;
    const features: GeoJSON.Feature[] = [];
    for (const v of p.vehicles) {
      const [code, sl, lat, lon, prefix, acc, age] = v;
      if (sel && (code !== sel.code || (p.selectedDir !== null && fleetDir(sl) !== p.selectedDir))) continue;
      const li = p.byCode.get(code);
      const line = li !== undefined ? p.network.lines[li] : null;
      if (!sel && line && !p.modes.includes(line.type)) continue;
      if (!sel && line && p.regions.length && line.type === 3 && !p.regions.includes(line.color)) continue;
      features.push({
        type: "Feature",
        properties: { code, dir: fleetDir(sl), p: prefix, a: acc, age, c: line?.color ?? "#FF6B00" },
        geometry: { type: "Point", coordinates: [lon, lat] },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [styleTick, p.vehicles, p.selectedLine, p.selectedDir, p.modes, p.regions, p.network, p.byCode]);

  return (
    <div className="absolute inset-0">
      <div ref={box} className="h-full w-full" aria-label={`Mapa interativo das ${p.network.counts.lines} linhas de ônibus, metrô e trem de São Paulo`} role="region" />
      {loadingShapes && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/70">
          <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-ink shadow-soft">Desenhando {p.network.counts.shapes.toLocaleString("pt-BR")} trajetos…</div>
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas">
          <p className="max-w-sm text-center text-sm text-muted">{err}</p>
        </div>
      )}
      {tip && (
        <div
          className="gm-tip pointer-events-none absolute z-10 max-w-[260px] rounded-lg bg-ink/90 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
          dangerouslySetInnerHTML={{ __html: tip.html }}
        />
      )}
    </div>
  );
}
