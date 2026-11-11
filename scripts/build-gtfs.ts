/**
 * Converte o GTFS da SPTrans (pasta extraída do _gtfs.zip) em arquivos compactos para o mapa da rede.
 *
 * Uso:  npx tsx scripts/build-gtfs.ts <pasta-do-gtfs-extraido> [pasta-de-saida]
 * Saída (padrão public/gtfs):
 *   network.json   – linhas, sentidos, paradas por sentido, frequências, tarifas e paradas
 *   shapes.geojson – traçado simplificado de cada sentido de cada linha
 */
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const [, , inDirArg, outDirArg] = process.argv;
if (!inDirArg) {
  console.error("Uso: npx tsx scripts/build-gtfs.ts <pasta-do-gtfs> [saida]");
  process.exit(1);
}
const inDir = resolve(inDirArg);
const outDir = resolve(outDirArg ?? "public/gtfs");

/** Divide uma linha CSV respeitando aspas ("" = aspas literais). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function readTable(file: string): Record<string, string>[] {
  const text = readFileSync(join(inDir, file), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const head = splitCsv(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cols = splitCsv(l);
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

/** Streaming para o shapes.txt (grande). */
async function eachRow(file: string, fn: (row: string[], idx: Record<string, number>) => void) {
  const rl = createInterface({ input: createReadStream(join(inDir, file), "utf8"), crlfDelay: Infinity });
  let idx: Record<string, number> | null = null;
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, "");
    if (!line) continue;
    const cols = splitCsv(line);
    if (!idx) {
      idx = Object.fromEntries(cols.map((c, i) => [c.trim(), i]));
      continue;
    }
    fn(cols, idx);
  }
}

// --- Douglas-Peucker ------------------------------------------------------------------------
type Pt = [number, number]; // [lon, lat]
function perpDist(p: Pt, a: Pt, b: Pt): number {
  // aproximação equiretangular (suficiente para escala urbana)
  const k = Math.cos((a[1] * Math.PI) / 180);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

const toSec = (t: string) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
};
const hhmm = (sec: number) => `${String(Math.floor(sec / 3600) % 24).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

async function main() {
  const t0 = Date.now();
  const agency = readTable("agency.txt")[0];
  const routes = readTable("routes.txt");
  const trips = readTable("trips.txt");
  const stopsRaw = readTable("stops.txt");
  const stopTimes = readTable("stop_times.txt");
  const freqs = readTable("frequencies.txt");
  const fareAttrs = readTable("fare_attributes.txt");
  const fareRules = readTable("fare_rules.txt");
  const calendar = readTable("calendar.txt");

  // paradas
  const stopIndex = new Map<string, number>();
  const stops: [string, string, number, number][] = [];
  for (const s of stopsRaw) {
    const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stopIndex.set(s.stop_id, stops.length);
    stops.push([s.stop_id, s.stop_name, r5(lat), r5(lon)]);
  }

  // paradas por viagem
  const tripStops = new Map<string, { seq: number; stop: number; t: number }[]>();
  for (const st of stopTimes) {
    const si = stopIndex.get(st.stop_id);
    if (si === undefined) continue;
    let arr = tripStops.get(st.trip_id);
    if (!arr) tripStops.set(st.trip_id, (arr = []));
    arr.push({ seq: Number(st.stop_sequence), stop: si, t: st.arrival_time ? toSec(st.arrival_time) : NaN });
  }
  for (const arr of tripStops.values()) arr.sort((a, b) => a.seq - b.seq);

  // frequências por viagem
  const tripFreq = new Map<string, { start: number; end: number; headway: number }[]>();
  for (const f of freqs) {
    let arr = tripFreq.get(f.trip_id);
    if (!arr) tripFreq.set(f.trip_id, (arr = []));
    arr.push({ start: toSec(f.start_time), end: toSec(f.end_time), headway: Number(f.headway_secs) });
  }

  // tarifas
  const farePrice = new Map(fareAttrs.map((f) => [f.fare_id, Number(f.price)]));
  const routeFare = new Map<string, number>();
  // tarifa base = a menor regra da linha (as demais são combinações com integração)
  for (const r of fareRules) {
    const p = farePrice.get(r.fare_id);
    if (!r.route_id || p === undefined) continue;
    const cur = routeFare.get(r.route_id);
    if (cur === undefined || p < cur) routeFare.set(r.route_id, p);
  }

  // dias de operação
  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const serviceDays = new Map(calendar.map((c) => [c.service_id, DAYS.map((d) => (c[d] === "1" ? 1 : 0)).join("")]));

  // shapes (streaming)
  const shapePts = new Map<string, { seq: number; p: Pt }[]>();
  const usedShapes = new Set(trips.map((t) => t.shape_id).filter(Boolean));
  await eachRow("shapes.txt", (c, i) => {
    const id = c[i.shape_id];
    if (!usedShapes.has(id)) return;
    let arr = shapePts.get(id);
    if (!arr) shapePts.set(id, (arr = []));
    arr.push({ seq: Number(c[i.shape_pt_sequence]), p: [Number(c[i.shape_pt_lon]), Number(c[i.shape_pt_lat])] });
  });

  const TOL = 0.000045; // ~5 m
  const features: unknown[] = [];
  const shapeFeature = new Map<string, number>();
  let rawPts = 0, keptPts = 0;

  const routeIndex = new Map(routes.map((r, i) => [r.route_id, i]));
  const lines = routes.map((r) => ({
    id: r.route_id,
    code: r.route_short_name || r.route_id,
    name: r.route_long_name,
    type: Number(r.route_type),
    color: `#${(r.route_color || "FF6B00").toUpperCase()}`,
    textColor: `#${(r.route_text_color || "FFFFFF").toUpperCase()}`,
    fare: routeFare.get(r.route_id) ?? null,
    dirs: [] as {
      d: number;
      headsign: string;
      shape: number | null;
      stops: number[];
      days: string | null;
      first: string | null;
      last: string | null;
      minHeadway: number | null;
      trip: number | null; // duração estimada da viagem (min)
      freq: [number, number][]; // [hora, headway em min]
    }[],
  }));

  for (const t of trips) {
    const li = routeIndex.get(t.route_id);
    if (li === undefined) continue;
    const line = lines[li];
    const d = Number(t.direction_id) || 0;

    let featIdx: number | null = null;
    if (t.shape_id && shapePts.has(t.shape_id)) {
      if (shapeFeature.has(t.shape_id)) featIdx = shapeFeature.get(t.shape_id)!;
      else {
        const pts = shapePts.get(t.shape_id)!.sort((a, b) => a.seq - b.seq).map((x) => x.p);
        const simp = simplify(pts, TOL).map(([x, y]) => [r5(x), r5(y)]);
        rawPts += pts.length;
        keptPts += simp.length;
        featIdx = features.length;
        shapeFeature.set(t.shape_id, featIdx);
        features.push({
          type: "Feature",
          id: featIdx,
          properties: { l: li, d, c: line.color, t: line.type },
          geometry: { type: "LineString", coordinates: simp },
        });
      }
    }

    const st = tripStops.get(t.trip_id) ?? [];
    const fq = (tripFreq.get(t.trip_id) ?? []).sort((a, b) => a.start - b.start);
    const tripMin = st.length > 1 && Number.isFinite(st[0].t) && Number.isFinite(st[st.length - 1].t) ? Math.round((st[st.length - 1].t - st[0].t) / 60) : null;
    line.dirs.push({
      d,
      headsign: t.trip_headsign,
      shape: featIdx,
      stops: st.map((x) => x.stop),
      days: serviceDays.get(t.service_id) ?? null,
      first: fq.length ? hhmm(fq[0].start) : null,
      last: fq.length ? hhmm(fq[fq.length - 1].end) : null,
      minHeadway: fq.length ? Math.round(Math.min(...fq.map((f) => f.headway)) / 60) : null,
      trip: tripMin,
      freq: fq.map((f) => [Math.floor(f.start / 3600) % 24, Math.round(f.headway / 60)]),
    });
  }
  for (const l of lines) l.dirs.sort((a, b) => a.d - b.d);

  mkdirSync(outDir, { recursive: true });
  const network = {
    generatedAt: new Date().toISOString(),
    agency: { name: agency?.agency_name ?? "SPTrans", url: agency?.agency_url ?? null },
    counts: { lines: lines.length, stops: stops.length, shapes: features.length },
    lines,
    stops,
  };
  writeFileSync(join(outDir, "network.json"), JSON.stringify(network));
  writeFileSync(join(outDir, "shapes.geojson"), JSON.stringify({ type: "FeatureCollection", features }));

  const mb = (f: string) => (statSync(join(outDir, f)).size / 1e6).toFixed(2) + " MB";
  console.log(`linhas=${lines.length} paradas=${stops.length} traçados=${features.length}`);
  console.log(`pontos: ${rawPts} -> ${keptPts} (${((keptPts / rawPts) * 100).toFixed(1)}%)`);
  console.log(`network.json ${mb("network.json")} · shapes.geojson ${mb("shapes.geojson")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
