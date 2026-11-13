import { readFileSync } from "node:fs";
import { join } from "node:path";
import { haversineMeters } from "@/features/intelligence/signals";
import { KNOWN_PLACES } from "@/features/routes/places";
import { railInfo } from "./rail";

/**
 * Leitura da rede GTFS da SPTrans no servidor (public/gtfs/network.json): busca de linha por código ou nome,
 * paradas próximas, linhas que passam em uma parada, horários programados e lugares citados em uma pergunta.
 */
export type SDir = {
  d: number;
  headsign: string;
  stops: number[];
  days: string | null;
  first: string | null;
  last: string | null;
  minHeadway: number | null;
  trip: number | null;
  /** [hora, intervalo em minutos] */
  freq: [number, number][];
};
export type SLine = { id: string; code: string; name: string; type: number; color: string; textColor: string; fare: number | null; dirs: SDir[] };
export type SStop = [id: string, name: string, lat: number, lon: number];
type Net = { lines: SLine[]; stops: SStop[] };
type Index = { net: Net; byCode: Map<string, SLine>; stopById: Map<string, number>; atStop: [line: number, dir: number, pos: number][][] };

let cached: Index | null = null;
export function gtfs(): Index {
  if (cached) return cached;
  const file = join(process.cwd(), "public", "gtfs", "network.json");
  const net = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Net;
  const byCode = new Map<string, SLine>();
  const stopById = new Map<string, number>();
  const atStop: Index["atStop"] = [];
  net.stops.forEach((s, i) => stopById.set(s[0], i));
  net.lines.forEach((l, li) => {
    byCode.set(l.code.toUpperCase(), l);
    l.dirs.forEach((d, di) => d.stops.forEach((s, pos) => (atStop[s] ??= []).push([li, di, pos])));
  });
  cached = { net, byCode, stopById, atStop };
  return cached;
}

/** minúsculas, sem acento e sem pontuação (para comparar nomes). */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Hora de São Paulo: dia (0 = segunda), hora e minuto do dia. */
export function spClock(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const hour = Number(get("hour"));
  return { day, hour, minute: hour * 60 + Number(get("minute")) };
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const hhmm = (min: number) => `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;

/** O sentido opera agora? (dias + janela entre o primeiro e o último horário, inclusive cruzando a meia-noite) */
export function runsNow(dir: Pick<SDir, "days" | "first" | "last">, when = new Date()): boolean {
  const { day, minute } = spClock(when);
  if (dir.days && day >= 0 && dir.days[day] !== "1") return false;
  if (!dir.first || !dir.last) return true;
  const a = toMin(dir.first);
  const b = toMin(dir.last);
  return a <= b ? minute >= a && minute <= b : minute >= a || minute <= b;
}

/** Intervalo programado (min) na hora atual; se não houver, o da hora mais próxima. */
export function headwayNow(dir: Pick<SDir, "freq" | "minHeadway">, when = new Date()): number | null {
  const { hour } = spClock(when);
  const exact = dir.freq.find((f) => f[0] === hour);
  return exact?.[1] ?? dir.minHeadway ?? null;
}

/**
 * Próximas partidas programadas do ponto inicial. O GTFS da SPTrans descreve a operação por intervalos
 * (frequencies.txt), então os horários são aproximados: hora cheia + múltiplos do intervalo daquela hora.
 */
export function nextDepartures(dir: Pick<SDir, "freq" | "days">, when = new Date(), count = 3): string[] {
  const { day, minute } = spClock(when);
  if (dir.days && day >= 0 && dir.days[day] !== "1") return [];
  const out: string[] = [];
  const hours = [...dir.freq].sort((a, b) => a[0] - b[0]);
  for (const pass of [0, 1440]) {
    for (const [h, every] of hours) {
      if (every <= 0) continue;
      for (let m = h * 60; m < h * 60 + 60; m += every) {
        if (m + pass >= minute && out.length < count) out.push(hhmm(m));
      }
      if (out.length >= count) return out;
    }
  }
  return out;
}

/** Encontra uma linha citada no texto: código completo (875A-10), sem sufixo (875A) ou linha de trilhos pelo nome/número. */
export function findLine(text: string): SLine | null {
  const { net, byCode } = gtfs();
  const up = text.toUpperCase();
  const full = up.match(/\b(N?\d{3,4}[A-Z]?-\d{2})\b/);
  if (full && byCode.has(full[1])) return byCode.get(full[1])!;
  const n = norm(text);
  // trilhos: "linha azul", "linha 3 vermelha", "linha 9 esmeralda", "metro 1"
  for (const l of net.lines) {
    if (l.type === 3) continue;
    const r = railInfo(l.code);
    if (!r) continue;
    const name = norm(r.name);
    if (new RegExp(`\\blinha ${name}\\b|\\b${name}\\b.*\\b(metro|cptm|trem)\\b|\\b(metro|cptm|trem)\\b.*\\b${name}\\b`).test(n)) return l;
    if (new RegExp(`\\blinha ${r.number}\\b(?! *\\d)`).test(n) && /\b(metro|cptm|trem|linha \d{1,2}\b)/.test(n) && !/\d{3}/.test(n)) return l;
  }
  const short = up.match(/\b(N?\d{3,4}[A-Z]?)\b/);
  if (short) {
    // "8000" -> 8000-10 (a variante principal termina em -10)
    const hit = byCode.get(`${short[1]}-10`) ?? net.lines.find((l) => l.code.toUpperCase().startsWith(`${short[1]}-`));
    if (hit) return hit;
  }
  return null;
}

export function nearestStops(lat: number, lon: number, count = 5, maxMeters = 1200, onlyBus = false) {
  const { net, atStop } = gtfs();
  const out: { index: number; meters: number }[] = [];
  const here = { latitude: lat, longitude: lon };
  net.stops.forEach((s, i) => {
    const at = atStop[i];
    if (!at?.length) return;
    if (onlyBus && !at.some(([li]) => net.lines[li].type === 3)) return;
    // filtro rápido por grau antes da distância exata
    if (Math.abs(s[2] - lat) > 0.02 || Math.abs(s[3] - lon) > 0.02) return;
    const m = haversineMeters(here, { latitude: s[2], longitude: s[3] });
    if (m <= maxMeters) out.push({ index: i, meters: m });
  });
  return out.sort((a, b) => a.meters - b.meters).slice(0, count);
}

/** Ponto de ônibus mais próximo, a qualquer distância (para saber se um lugar está na área atendida pela SPTrans). */
export function nearestBusStop(lat: number, lon: number): { name: string; meters: number } | null {
  const { net, atStop } = gtfs();
  const here = { latitude: lat, longitude: lon };
  let best: { name: string; meters: number } | null = null;
  net.stops.forEach((s, i) => {
    if (!atStop[i]?.some(([li]) => net.lines[li].type === 3)) return;
    const m = haversineMeters(here, { latitude: s[2], longitude: s[3] });
    if (!best || m < best.meters) best = { name: s[1], meters: m };
  });
  return best;
}

/** Distância a pé aceita até um ponto de ônibus; além disso o lugar conta como fora da área atendida. */
export const COVERAGE_METERS = 1200;
export const kmText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** Aviso quando um lugar fica longe de qualquer ponto da SPTrans (ex.: outra cidade da Grande São Paulo). */
export function coverageNotice(what: string, lat: number, lon: number): string | null {
  const near = nearestBusStop(lat, lon);
  if (near && near.meters <= COVERAGE_METERS) return null;
  return `${what} fora da área atendida pelos ônibus municipais de São Paulo (SPTrans)${near ? `: o ponto mais próximo, ${near.name}, fica a ${kmText(near.meters)}` : ""}. O GoMob ainda não cobre ônibus intermunicipais nem de outras cidades.`;
}

/** Linhas (e sentido) que passam em uma parada. */
export function linesAtStop(stopIndex: number) {
  const { net, atStop } = gtfs();
  return (atStop[stopIndex] ?? []).map(([li, di, pos]) => ({ line: net.lines[li], dir: net.lines[li].dirs[di], pos }));
}

export type Place = { label: string; latitude: number; longitude: number };

/** Lugar citado em uma pergunta: locais conhecidos, estações de metrô/trem, terminais e nomes de paradas. */
export function resolvePlace(text: string): Place | null {
  const q = norm(text).replace(/^(a|o|as|os|da|do|de|na|no|ao|para|pra|ate|em|estacao|metro|ponto|parada)\s+/g, "");
  if (q.length < 2) return null;
  const { net, atStop } = gtfs();
  const known = KNOWN_PLACES.find((p) => norm(p.label).includes(q) || q.includes(norm(p.label.split(" - ")[0])) || norm(p.id) === q.replace(/\s/g, ""));
  if (known) return { label: known.label, latitude: known.latitude, longitude: known.longitude };
  let best: { i: number; score: number } | null = null;
  net.stops.forEach((s, i) => {
    const at = atStop[i];
    if (!at?.length) return;
    const name = norm(s[1]);
    if (!name.includes(q)) return;
    const rail = at.some(([li]) => net.lines[li].type !== 3);
    // estação de trilhos e nome igual valem mais; depois, paradas com mais linhas
    const score = (name === q ? 1000 : 0) + (rail ? 500 : 0) + (name.startsWith(q) ? 100 : 0) + (/\bterm\b|\bterminal\b/.test(name) ? 60 : 0) + Math.min(50, at.length);
    if (!best || score > best.score) best = { i, score };
  });
  if (!best) return null;
  const s = net.stops[(best as { i: number }).i];
  // "Terminal Lapa - Plat. 1, 0" -> "Terminal Lapa"
  return { label: s[1].replace(/\s*-\s*Plat\b.*$/i, ""), latitude: s[2], longitude: s[3] };
}
