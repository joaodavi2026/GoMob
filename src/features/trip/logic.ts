/**
 * Modo "em trajeto": lógica pura (sem React) para guiar a pessoa passo a passo.
 * Fases: caminhar até o ponto -> aguardar o ônibus -> seguir no ônibus -> (baldeação) -> caminhar -> chegou.
 * A cada posição (GPS real ou simulada) decide se a fase avança e quais avisos disparar.
 */
import type { BusRouteOption, GeoPoint } from "@/types/transit";

export type LL = { lat: number; lon: number };
export type NamedLL = LL & { name: string };
export type Leg = { code: string; sentido: string; direction: number; minutes: number; stops: NamedLL[] };
export type Phase =
  | { kind: "walk"; to: NamedLL; final: boolean }
  | { kind: "wait"; leg: number }
  | { kind: "ride"; leg: number }
  | { kind: "arrived" };
export type Trip = { origin: NamedLL; destination: NamedLL; legs: Leg[]; phases: Phase[] };

/** Estado do progresso dentro da fase atual. */
export type Progress = { phase: number; lastStop: number; warnedNext: boolean };
export type TripEvent = "phase_changed" | "next_is_yours" | "arrived";

const R = 6_371_000;
export function meters(a: LL, b: LL): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const walkMinutes = (m: number) => Math.max(1, Math.round((m * 1.3) / 75));
export const fmtDist = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

/** Monta o trajeto a partir da rota escolhida. Exige as paradas de cada trecho (rotas do GTFS). */
export function buildTrip(route: BusRouteOption, origin: GeoPoint, destination: GeoPoint): Trip | null {
  const legs: Leg[] = [];
  for (const s of route.steps) {
    if (s.kind !== "BUS") continue;
    if (!s.legStops || s.legStops.length < 2) return null;
    legs.push({
      code: s.lineCode,
      sentido: s.lineName,
      direction: s.direction ?? 0,
      minutes: s.minutes,
      stops: s.legStops.map(([lon, lat, name]) => ({ lat, lon, name })),
    });
  }
  if (!legs.length) return null;
  const phases: Phase[] = [{ kind: "walk", to: legs[0].stops[0], final: false }];
  legs.forEach((_, i) => phases.push({ kind: "wait", leg: i }, { kind: "ride", leg: i }));
  const dest: NamedLL = { lat: destination.latitude, lon: destination.longitude, name: destination.label ?? "Destino" };
  phases.push({ kind: "walk", to: dest, final: true }, { kind: "arrived" });
  return { origin: { lat: origin.latitude, lon: origin.longitude, name: origin.label ?? "Origem" }, destination: dest, legs, phases };
}

export const startProgress = (): Progress => ({ phase: 0, lastStop: 0, warnedNext: false });

/** Parada mais próxima, procurando só para frente (o ônibus não volta). */
export function nearestStopIndex(stops: LL[], pos: LL, from = 0, window = 6): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < Math.min(stops.length, from + window + 1); i++) {
    const d = meters(stops[i], pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const ARRIVE_M = 35;

/** Avança o progresso com uma nova posição. Retorna o novo progresso e os avisos a disparar. */
export function advance(trip: Trip, p: Progress, pos: LL): { progress: Progress; events: TripEvent[] } {
  const phase = trip.phases[p.phase];
  const events: TripEvent[] = [];
  const next = (extra: Partial<Progress> = {}): Progress => {
    events.push("phase_changed");
    const np = { phase: Math.min(p.phase + 1, trip.phases.length - 1), lastStop: 0, warnedNext: false, ...extra };
    if (trip.phases[np.phase].kind === "arrived") events.push("arrived");
    return np;
  };
  if (!phase || phase.kind === "arrived") return { progress: p, events };

  if (phase.kind === "walk") {
    if (meters(pos, phase.to) < (phase.final ? 30 : ARRIVE_M)) return { progress: next(), events };
    return { progress: p, events };
  }

  const stops = trip.legs[phase.leg].stops;
  if (phase.kind === "wait") {
    // embarcou: já está perto de uma parada seguinte do trecho
    const i = nearestStopIndex(stops, pos, 0, stops.length);
    if (i >= 1 && meters(stops[i], pos) < 150) return { progress: next({ lastStop: i }), events };
    return { progress: p, events };
  }

  // phase.kind === "ride"
  const i = Math.max(p.lastStop, nearestStopIndex(stops, pos, p.lastStop));
  const last = stops.length - 1;
  const remaining = last - i;
  let warned = p.warnedNext;
  if (remaining <= 1 && !warned) {
    events.push("next_is_yours");
    warned = true;
  }
  if (meters(pos, stops[last]) < ARRIVE_M || (remaining === 0 && meters(pos, stops[last]) < 80)) return { progress: next(), events };
  return { progress: { ...p, lastStop: i, warnedNext: warned }, events };
}

/** Texto da instrução atual (curto: uma ação por vez). */
export function instruction(trip: Trip, p: Progress, pos?: LL | null): { title: string; detail: string } {
  const phase = trip.phases[p.phase];
  if (!phase || phase.kind === "arrived") return { title: "Você chegou!", detail: trip.destination.name };
  if (phase.kind === "walk") {
    const m = pos ? meters(pos, phase.to) : null;
    const dist = m !== null ? `${fmtDist(m)} · cerca de ${walkMinutes(m)} min a pé` : "Siga a pé";
    return phase.final ? { title: `Caminhe até ${phase.to.name}`, detail: dist } : { title: `Vá a pé até o ponto ${phase.to.name}`, detail: dist };
  }
  const leg = trip.legs[phase.leg];
  if (phase.kind === "wait") {
    return { title: `Aguarde a linha ${leg.code}`, detail: `${leg.sentido} · no ponto ${leg.stops[0].name}` };
  }
  const last = leg.stops.length - 1;
  const remaining = last - p.lastStop;
  const alight = leg.stops[last].name;
  if (remaining <= 0) return { title: "Desça agora", detail: alight };
  if (remaining === 1) return { title: "Desça no próximo ponto", detail: alight };
  return { title: `Siga na linha ${leg.code}`, detail: `Desça em ${alight} · faltam ${remaining} paradas` };
}

/** Minutos restantes estimados a partir da fase atual. */
export function remainingMinutes(trip: Trip, p: Progress, pos?: LL | null): number {
  let total = 0;
  trip.phases.forEach((ph, i) => {
    if (i < p.phase) return;
    if (ph.kind === "walk") total += i === p.phase && pos ? walkMinutes(meters(pos, ph.to)) : 3;
    else if (ph.kind === "wait") total += i === p.phase ? 5 : 5;
    else if (ph.kind === "ride") {
      const leg = trip.legs[ph.leg];
      const n = leg.stops.length - 1;
      const done = i === p.phase ? p.lastStop : 0;
      total += Math.round((leg.minutes * (n - done)) / Math.max(1, n));
    }
  });
  return Math.max(0, total);
}

/**
 * Trajeto simulado para demonstração: pontos interpolados ao longo da viagem
 * (caminhada mais lenta, ônibus mais rápido, pausa no ponto esperando o ônibus).
 */
export function simulationPath(trip: Trip): LL[] {
  const out: LL[] = [];
  const segment = (a: LL, b: LL, stepM: number) => {
    const d = meters(a, b);
    const n = Math.max(1, Math.round(d / stepM));
    for (let k = 0; k < n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n });
  };
  const pause = (p: LL, ticks: number) => {
    for (let k = 0; k < ticks; k++) out.push(p);
  };
  segment(trip.origin, trip.legs[0].stops[0], 22);
  trip.legs.forEach((leg) => {
    pause(leg.stops[0], 10);
    for (let i = 1; i < leg.stops.length; i++) segment(leg.stops[i - 1], leg.stops[i], 60);
    pause(leg.stops[leg.stops.length - 1], 6);
  });
  segment(trip.legs[trip.legs.length - 1].stops.at(-1)!, trip.destination, 22);
  out.push(trip.destination);
  return out;
}

/** Ônibus mais próximo do ponto de embarque (estimativa simples, sem previsão oficial). */
export function nearestBusEta(board: LL, buses: LL[]): { meters: number; minutes: number } | null {
  if (!buses.length) return null;
  const m = Math.min(...buses.map((b) => meters(b, board)));
  return { meters: m, minutes: Math.max(1, Math.round((m * 1.4) / 1000 / 15 * 60)) };
}
