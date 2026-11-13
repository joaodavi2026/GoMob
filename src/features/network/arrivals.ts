import { getSptransClient, isSptransConfigured } from "@/server/sptrans/client";
import { gtfs, headwayNow, linesAtStop, runsNow, type SLine } from "./server";
import { railInfo, titleCase } from "./rail";

/**
 * Chegadas em uma parada: previsão em tempo real do Olho Vivo (SPTrans) quando há ônibus a caminho;
 * para as demais linhas da parada, o intervalo programado do GTFS (deixado claro como "programado").
 */
export type Arrival = {
  code: string;
  color: string;
  textColor: string;
  headsign: string;
  /** minutos até chegar (previsão) */
  minutes: number;
  /** horário previsto HH:MM */
  time: string;
  prefix: string;
  accessible: boolean;
};
export type Scheduled = { code: string; color: string; textColor: string; headsign: string; type: number; running: boolean; headway: number | null; first: string | null; last: string | null };
export type StopArrivals = {
  stop: { id: string; name: string; latitude: number; longitude: number };
  /** LIVE: previsões do Olho Vivo; SCHEDULE: só horário programado */
  state: "LIVE" | "SCHEDULE";
  clock: string | null;
  arrivals: Arrival[];
  scheduled: Scheduled[];
};

type RawForecast = { hr?: string; p?: { l?: { c?: string; sl?: number; lt0?: string; lt1?: string; vs?: { p?: unknown; t?: string; a?: boolean }[] }[] } | null };

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function normalizeForecast(raw: unknown, lineOf: (code: string) => SLine | undefined): { clock: string | null; arrivals: Arrival[] } {
  const body = (raw ?? {}) as RawForecast;
  const clock = typeof body.hr === "string" && /^\d{2}:\d{2}$/.test(body.hr) ? body.hr : null;
  const out: Arrival[] = [];
  if (!clock || !Array.isArray(body.p?.l)) return { clock, arrivals: out };
  const now = minutesOf(clock);
  for (const l of body.p!.l!) {
    const code = typeof l.c === "string" ? l.c.slice(0, 16) : null;
    if (!code || !Array.isArray(l.vs)) continue;
    const line = lineOf(code);
    // lt0/lt1 são os dois terminais; o destino depende do sentido
    const headsign = titleCase(String((l.sl === 2 ? l.lt1 : l.lt0) ?? line?.name ?? "").slice(0, 60));
    for (const v of l.vs) {
      if (typeof v.t !== "string" || !/^\d{2}:\d{2}$/.test(v.t)) continue;
      const minutes = (minutesOf(v.t) - now + 1440) % 1440;
      if (minutes > 120) continue; // previsão antiga ou de outro dia
      out.push({
        code,
        color: line?.color ?? "#12151b",
        textColor: line?.textColor ?? "#ffffff",
        headsign,
        minutes,
        time: v.t,
        prefix: String(v.p ?? "").slice(0, 10),
        accessible: v.a === true,
      });
    }
  }
  return { clock, arrivals: out.sort((a, b) => a.minutes - b.minutes) };
}

export async function getStopArrivals(stopId: string, now = new Date()): Promise<StopArrivals | null> {
  const { net, stopById, byCode } = gtfs();
  const index = stopById.get(stopId);
  if (index === undefined) return null;
  const s = net.stops[index];
  const here = linesAtStop(index);

  let clock: string | null = null;
  let arrivals: Arrival[] = [];
  let live = false;
  // só paradas de ônibus têm previsão no Olho Vivo (código numérico)
  if (isSptransConfigured() && /^\d+$/.test(stopId) && here.some((x) => x.line.type === 3)) {
    try {
      const raw = await getSptransClient().forecastByStop(Number(stopId));
      const n = normalizeForecast(raw, (c) => byCode.get(c.toUpperCase()));
      clock = n.clock;
      arrivals = n.arrivals;
      live = n.clock !== null;
    } catch {
      // sem previsão agora: segue com o horário programado
    }
  }

  const predicted = new Set(arrivals.map((a) => a.code));
  const seen = new Set<string>();
  const scheduled: Scheduled[] = [];
  for (const { line, dir, pos } of here) {
    // no ponto final de um sentido ninguém embarca
    if (pos === dir.stops.length - 1 || predicted.has(line.code) || seen.has(`${line.code}:${dir.d}`)) continue;
    seen.add(`${line.code}:${dir.d}`);
    const rail = railInfo(line.code);
    scheduled.push({
      code: rail ? rail.number : line.code,
      color: line.color,
      textColor: line.textColor,
      headsign: rail ? `Linha ${rail.number}-${rail.name} · sentido ${titleCase(dir.headsign)}` : titleCase(dir.headsign),
      type: line.type,
      running: runsNow(dir, now),
      headway: headwayNow(dir, now),
      first: dir.first,
      last: dir.last,
    });
  }
  scheduled.sort((a, b) => Number(b.running) - Number(a.running) || (a.headway ?? 99) - (b.headway ?? 99));

  return {
    stop: { id: s[0], name: s[1], latitude: s[2], longitude: s[3] },
    state: live ? "LIVE" : "SCHEDULE",
    clock,
    arrivals: arrivals.slice(0, 12),
    scheduled: scheduled.slice(0, 20),
  };
}
