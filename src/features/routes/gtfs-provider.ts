import { readFileSync } from "node:fs";
import { join } from "node:path";
import { haversineMeters } from "@/features/intelligence/signals";
import type { BusRouteOption, GeoPoint, RouteProvider, RouteStep } from "@/types/transit";

/**
 * Provedor de rotas a partir do GTFS oficial da SPTrans (public/gtfs/network.json, gerado por
 * scripts/build-gtfs.ts). Só linhas de ônibus (route_type 3). Viagens diretas e com 1 baldeação
 * na mesma parada. Tempos são ESTIMADOS a partir do horário programado (duração da viagem e intervalo),
 * não de previsão em tempo real.
 */

type NetDir = {
  d: number;
  headsign: string;
  stops: number[];
  minHeadway: number | null;
  trip: number | null;
  /** "1111100" = seg..dom */
  days: string | null;
  first: string | null;
  last: string | null;
};

/** Dia (0 = segunda) e minuto do dia no horário de São Paulo. */
function spNow(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** A linha opera agora? (dias do calendário + janela entre o primeiro e o último horário programado). */
export function runsAt(dir: Pick<NetDir, "days" | "first" | "last">, when: Date): boolean {
  const { day, minute } = spNow(when);
  if (dir.days && day >= 0 && dir.days[day] !== "1") return false;
  if (!dir.first || !dir.last) return true;
  const a = toMin(dir.first), b = toMin(dir.last);
  return a <= b ? minute >= a && minute <= b : minute >= a || minute <= b; // janela que cruza a meia-noite
}
type NetLine = { id: string; code: string; name: string; type: number; dirs: NetDir[] };
type Network = { generatedAt: string; lines: NetLine[]; stops: [string, string, number, number][] };

/** Sentido de uma linha (linha + direção), com posição de cada parada. */
type LineDir = { line: NetLine; dir: NetDir; minPerStop: number; wait: number };

const MAX_WALK_METERS = 800;
const MAX_END_STOPS = 40;
const WALK_M_PER_MIN = 75;
const WALK_DETOUR = 1.3;
const BUS_KMH = 15;
const MAX_RIDE_STOPS = 80;
const MAX_RESULTS = 6;

const walkMin = (m: number) => Math.max(1, Math.round((m * WALK_DETOUR) / WALK_M_PER_MIN));

type Index = {
  net: Network;
  lds: LineDir[];
  /** parada -> [(índice do sentido, posição na sequência)] */
  stopLd: [number, number][][];
};

let cached: Index | null = null;

function loadIndex(path = join(process.cwd(), "public", "gtfs", "network.json")): Index {
  if (cached) return cached;
  const net = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")) as Network;
  const lds: LineDir[] = [];
  const stopLd: [number, number][][] = [];
  for (const line of net.lines) {
    if (line.type !== 3) continue; // somente ônibus
    for (const dir of line.dirs) {
      if (dir.stops.length < 2) continue;
      // minutos por parada: duração programada da viagem / nº de trechos (ou velocidade média)
      let minPerStop: number;
      if (dir.trip && dir.trip > 0) minPerStop = dir.trip / (dir.stops.length - 1);
      else {
        let m = 0;
        for (let i = 1; i < dir.stops.length; i++) {
          const a = net.stops[dir.stops[i - 1]], b = net.stops[dir.stops[i]];
          m += haversineMeters({ latitude: a[2], longitude: a[3] }, { latitude: b[2], longitude: b[3] });
        }
        minPerStop = m / 1000 / BUS_KMH * 60 / (dir.stops.length - 1);
      }
      // espera média: metade do menor intervalo programado (limitada)
      const wait = Math.min(15, Math.max(2, Math.round((dir.minHeadway ?? 10) / 2)));
      const li = lds.length;
      lds.push({ line, dir, minPerStop, wait });
      dir.stops.forEach((s, pos) => (stopLd[s] ??= []).push([li, pos]));
    }
  }
  cached = { net, lds, stopLd };
  return cached;
}

/** Paradas (em ordem) de uma linha de ônibus do GTFS em um sentido (0 = ida, 1 = volta). */
export function gtfsLineStops(code: string, direction: number, path?: string) {
  const idx = loadIndex(path);
  const ld = idx.lds.find((x) => x.line.code === code && x.dir.d === direction) ?? idx.lds.find((x) => x.line.code === code);
  if (!ld) return [];
  return ld.dir.stops.map((s) => {
    const st = idx.net.stops[s];
    return { id: st[0], name: st[1], latitude: st[2], longitude: st[3] };
  });
}

function nearStops(idx: Index, p: GeoPoint) {
  const out: { s: number; m: number }[] = [];
  idx.net.stops.forEach((st, s) => {
    if (!idx.stopLd[s]) return;
    const m = haversineMeters(p, { latitude: st[2], longitude: st[3] });
    if (m <= MAX_WALK_METERS) out.push({ s, m });
  });
  return out.sort((a, b) => a.m - b.m).slice(0, MAX_END_STOPS);
}

type Leg = { ld: number; from: number; to: number };
type Cand = { legs: Leg[]; walkIn: number; walkOut: number; total: number };

export class GtfsRouteProvider implements RouteProvider {
  readonly name = "GTFS";
  constructor(
    private readonly networkPath?: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async searchRoutes(origin: GeoPoint, destination: GeoPoint): Promise<BusRouteOption[]> {
    if (haversineMeters(origin, destination) < 200) return [];
    const idx = loadIndex(this.networkPath);
    const when = this.now();
    // prioriza linhas operando agora; se nenhuma servir, mostra as demais com o horário de operação
    const running = this.search(idx, origin, destination, (ld) => runsAt(idx.lds[ld].dir, when));
    return running.length ? running : this.search(idx, origin, destination, () => true, true);
  }

  private search(idx: Index, origin: GeoPoint, destination: GeoPoint, usable: (ld: number) => boolean, showHours = false): BusRouteOption[] {
    const origins = nearStops(idx, origin);
    const dests = nearStops(idx, destination);
    if (!origins.length || !dests.length) return [];

    const ride = (ld: number, from: number, to: number) => idx.lds[ld].minPerStop * (to - from);
    const cands: Cand[] = [];

    // destino alcançável por sentido: ld -> [(posição, metros até o destino)]
    const destByLd = new Map<number, { pos: number; m: number }[]>();
    for (const t of dests)
      for (const [ld, pos] of idx.stopLd[t.s]) if (usable(ld)) (destByLd.get(ld) ?? destByLd.set(ld, []).get(ld)!).push({ pos, m: t.m });

    // 1) diretas
    for (const o of origins)
      for (const [ld, p1] of idx.stopLd[o.s]) {
        if (!usable(ld)) continue;
        for (const t of destByLd.get(ld) ?? []) {
          if (t.pos <= p1 || t.pos - p1 > MAX_RIDE_STOPS) continue;
          const wIn = walkMin(o.m), wOut = walkMin(t.m);
          cands.push({ legs: [{ ld, from: p1, to: t.pos }], walkIn: o.m, walkOut: t.m, total: wIn + idx.lds[ld].wait + ride(ld, p1, t.pos) + wOut });
        }
      }

    // 2) uma baldeação na mesma parada: parada k -> [(sentido 2, posição em k, posição no destino, metros)]
    const reach = new Map<number, { ld: number; k: number; pos: number; m: number }[]>();
    for (const [ld, list] of destByLd)
      for (const t of list) {
        const stops = idx.lds[ld].dir.stops;
        for (let k = Math.max(0, t.pos - MAX_RIDE_STOPS); k < t.pos; k++) (reach.get(stops[k]) ?? reach.set(stops[k], []).get(stops[k])!).push({ ld, k, pos: t.pos, m: t.m });
      }
    for (const o of origins)
      for (const [ld1, p1] of idx.stopLd[o.s]) {
        if (!usable(ld1)) continue;
        const stops = idx.lds[ld1].dir.stops;
        const end = Math.min(stops.length, p1 + MAX_RIDE_STOPS);
        for (let k = p1 + 1; k < end; k++) {
          for (const r of reach.get(stops[k]) ?? []) {
            if (idx.lds[r.ld].line.code === idx.lds[ld1].line.code) continue;
            const total = walkMin(o.m) + idx.lds[ld1].wait + ride(ld1, p1, k) + idx.lds[r.ld].wait + ride(r.ld, r.k, r.pos) + walkMin(r.m);
            cands.push({ legs: [{ ld: ld1, from: p1, to: k }, { ld: r.ld, from: r.k, to: r.pos }], walkIn: o.m, walkOut: r.m, total });
          }
        }
      }

    // melhor opção por combinação de linhas; diretas primeiro quando forem competitivas
    const best = new Map<string, Cand>();
    for (const c of cands) {
      const sig = c.legs.map((l) => idx.lds[l.ld].line.code).join(">");
      const cur = best.get(sig);
      if (!cur || c.total < cur.total) best.set(sig, c);
    }
    const sorted = [...best.values()].sort((a, b) => a.total - b.total);
    const fastest = sorted[0]?.total ?? 0;
    // descarta baldeações muito piores que a melhor opção
    const kept = sorted.filter((c) => c.legs.length === 1 || c.total <= fastest * 1.6 + 10).slice(0, MAX_RESULTS);
    const stamp = this.now().toISOString();
    return kept.map((c) => this.toOption(idx, c, origin, destination, stamp, showHours));
  }

  private toOption(idx: Index, c: Cand, origin: GeoPoint, destination: GeoPoint, stamp: string, showHours = false): BusRouteOption {
    const name = (s: number) => idx.net.stops[s][1];
    const steps: RouteStep[] = [];
    const path: [number, number][] = [[origin.longitude, origin.latitude]];
    const first = idx.lds[c.legs[0].ld].dir.stops[c.legs[0].from];
    const lastLeg = c.legs[c.legs.length - 1];
    const last = idx.lds[lastLeg.ld].dir.stops[lastLeg.to];
    const walkIn = walkMin(c.walkIn);
    const walkOut = walkMin(c.walkOut);
    steps.push({ kind: "WALK", minutes: walkIn, from: origin.label ?? "Origem", to: name(first) });
    let busMin = 0;
    let waitMin = 0;
    for (const leg of c.legs) {
      const ld = idx.lds[leg.ld];
      const minutes = Math.max(1, Math.round(ld.minPerStop * (leg.to - leg.from)));
      busMin += minutes;
      waitMin += ld.wait;
      steps.push({
        kind: "BUS",
        lineCode: ld.line.code,
        lineName: `sentido ${ld.dir.headsign}${showHours && ld.dir.first ? ` (opera ${ld.dir.first}–${ld.dir.last})` : ""}`,
        boardStop: name(ld.dir.stops[leg.from]),
        alightStop: name(ld.dir.stops[leg.to]),
        minutes,
        direction: ld.dir.d,
      });
      for (let i = leg.from; i <= leg.to; i++) {
        const st = idx.net.stops[ld.dir.stops[i]];
        path.push([st[3], st[2]]);
      }
    }
    steps.push({ kind: "WALK", minutes: walkOut, from: name(last), to: destination.label ?? "Destino" });
    path.push([destination.longitude, destination.latitude]);
    const sig = c.legs.map((l) => `${idx.lds[l.ld].line.code}:${l.from}-${l.to}`).join("+");
    return {
      id: `gtfs:${sig}`,
      steps,
      durationMinutes: walkIn + walkOut + busMin + waitMin,
      walkMinutes: walkIn + walkOut,
      transfers: c.legs.length - 1,
      path,
      source: "GTFS",
      dataTimestamp: stamp,
    };
  }
}
