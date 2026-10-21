import { haversineMeters } from "@/features/intelligence/signals";
import type { BusRouteOption, GeoPoint, RouteProvider, RouteStep } from "@/types/transit";
import { buildDemoNetwork, declaredTransferPoints, DECLARED_TRANSFER_STOP_IDS, type NetLine, type NetStop } from "./demo-network";
import { filterBusOnly } from "./validate";

export const MAX_WALK_METERS = 1200;
const WALK_M_PER_MIN = 75;
const WALK_DETOUR = 1.3;
/** Espera estimada em transferência (demonstrativa; sem tabela de horários). */
export const TRANSFER_WAIT_MIN = 5;
const MAX_RESULTS = 6;

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * WALK_DETOUR) / WALK_M_PER_MIN));
}

type Candidate = { legs: { line: NetLine; from: number; to: number }[]; walkIn: number; walkOut: number; boardStop: NetStop; alightStop: NetStop };

function nearbyStops(point: GeoPoint, network: NetLine[]) {
  const out: { line: NetLine; index: number; meters: number }[] = [];
  for (const line of network) {
    line.stops.forEach((s, index) => {
      const meters = haversineMeters(point, s);
      if (meters <= MAX_WALK_METERS) out.push({ line, index, meters });
    });
  }
  return out;
}

/**
 * Provedor DEMO: trajetos entre paradas conhecidas da rede demo (linhas demo + linhas conectoras demo).
 * Regras: somente ônibus; sentido único por linha (i < j); no máximo 1 transferência, apenas em ponto
 * declarado servido pelas duas linhas; caminhada máxima de 1 km em cada ponta. Tudo identificado como DEMO.
 */
export class DemoRouteProvider implements RouteProvider {
  readonly name = "DEMO";
  constructor(
    private readonly network: NetLine[] = buildDemoNetwork(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async searchRoutes(origin: GeoPoint, destination: GeoPoint): Promise<BusRouteOption[]> {
    if (haversineMeters(origin, destination) < 150) return [];
    const boards = nearbyStops(origin, this.network);
    const alights = nearbyStops(destination, this.network);
    const candidates: Candidate[] = [];

    // Diretas
    for (const b of boards)
      for (const a of alights) {
        if (a.line.code === b.line.code && a.index > b.index) {
          candidates.push({
            legs: [{ line: b.line, from: b.index, to: a.index }],
            walkIn: b.meters,
            walkOut: a.meters,
            boardStop: b.line.stops[b.index],
            alightStop: a.line.stops[a.index],
          });
        }
      }
    // Com uma transferência em ponto declarado comum às duas linhas
    for (const b of boards)
      for (const a of alights) {
        if (a.line.code === b.line.code) continue;
        for (let k = b.index + 1; k < b.line.stops.length; k++) {
          const t = b.line.stops[k];
          if (!DECLARED_TRANSFER_STOP_IDS.includes(t.id)) continue;
          const m = a.line.stops.findIndex((s) => s.id === t.id);
          if (m < 0 || m >= a.index) continue;
          candidates.push({
            legs: [
              { line: b.line, from: b.index, to: k },
              { line: a.line, from: m, to: a.index },
            ],
            walkIn: b.meters,
            walkOut: a.meters,
            boardStop: b.line.stops[b.index],
            alightStop: a.line.stops[a.index],
          });
        }
      }

    const stamp = this.now().toISOString();
    const options = candidates.map((c) => this.toOption(c, origin, destination, stamp));
    // Melhor opção por combinação de linhas
    const best = new Map<string, BusRouteOption>();
    for (const o of options) {
      const sig = o.steps.filter((s) => s.kind === "BUS").map((s) => (s as { lineCode: string }).lineCode).join(">");
      const cur = best.get(sig);
      if (!cur || (o.durationMinutes ?? Infinity) < (cur.durationMinutes ?? Infinity)) best.set(sig, o);
    }
    // Validação: somente ônibus e transferências em pontos declarados
    const { accepted } = filterBusOnly([...best.values()], declaredTransferPoints(this.network));
    return accepted.sort((x, y) => (x.durationMinutes ?? Infinity) - (y.durationMinutes ?? Infinity)).slice(0, MAX_RESULTS);
  }

  private toOption(c: Candidate, origin: GeoPoint, destination: GeoPoint, stamp: string): BusRouteOption {
    const steps: RouteStep[] = [];
    const path: [number, number][] = [[origin.longitude, origin.latitude]];
    const originLabel = origin.label ?? "Origin";
    const destLabel = destination.label ?? "Destination";
    const walkIn = walkMinutes(c.walkIn);
    const walkOut = walkMinutes(c.walkOut);
    steps.push({ kind: "WALK", minutes: walkIn, from: originLabel, to: c.boardStop.name });
    let busMinutes = 0;
    c.legs.forEach((leg) => {
      const minutes = Math.max(1, leg.line.offsets[leg.to] - leg.line.offsets[leg.from]);
      busMinutes += minutes;
      steps.push({
        kind: "BUS",
        lineCode: leg.line.code,
        lineName: leg.line.name,
        boardStop: leg.line.stops[leg.from].name,
        alightStop: leg.line.stops[leg.to].name,
        minutes,
        lineId: leg.line.lineId,
      });
      for (let i = leg.from; i <= leg.to; i++) {
        const s = leg.line.stops[i];
        const last = path[path.length - 1];
        if (last[0] !== s.longitude || last[1] !== s.latitude) path.push([s.longitude, s.latitude]);
      }
    });
    steps.push({ kind: "WALK", minutes: walkOut, from: c.alightStop.name, to: destLabel });
    path.push([destination.longitude, destination.latitude]);
    const transfers = c.legs.length - 1;
    const sig = c.legs.map((l) => `${l.line.code}:${l.from}-${l.to}`).join("+");
    return {
      id: `demo:${sig}`,
      steps,
      durationMinutes: walkIn + walkOut + busMinutes + transfers * TRANSFER_WAIT_MIN,
      walkMinutes: walkIn + walkOut,
      transfers,
      path,
      source: "DEMO",
      dataTimestamp: stamp,
    };
  }
}
