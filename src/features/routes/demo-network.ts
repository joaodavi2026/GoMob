import { demoLines, demoStops } from "@/server/transit/demo";
import { haversineMeters } from "@/features/intelligence/signals";
import type { TransferPoint } from "./validate";

export type NetStop = { id: string; name: string; latitude: number; longitude: number };
export type NetLine = {
  code: string;
  name: string;
  /** id interno da linha demo do serviço de transporte, quando existe (linhas conectoras não têm veículos). */
  lineId?: string;
  stops: NetStop[];
  /** minutos acumulados de viagem até cada parada (estimativa demonstrativa, sem tabela de horários). */
  offsets: number[];
};

/** Velocidade média demonstrativa: ~17 km/h com fator de desvio 1,2. */
const BUS_M_PER_MIN = 283;
const DETOUR = 1.2;

function cumulativeMinutes(stops: NetStop[]): number[] {
  const out = [0];
  for (let i = 1; i < stops.length; i++) {
    const d = haversineMeters(stops[i - 1], stops[i]) * DETOUR;
    out.push(out[i - 1] + Math.max(2, Math.round(d / BUS_M_PER_MIN)));
  }
  return out;
}

const X = (id: string, name: string, latitude: number, longitude: number): NetStop => ({ id, name, latitude, longitude });

/** Paradas extras (somente da rede demo de rotas) usadas pelas linhas conectoras. */
const EXTRA = {
  republica: X("dmx-republica", "República (demo)", -23.5434, -46.6429),
  liberdade: X("dmx-liberdade", "Liberdade (demo)", -23.559, -46.635),
  reboucas: X("dmx-reboucas", "Rebouças (demo)", -23.56, -46.676),
  santaCecilia: X("dmx-santa-cecilia", "Santa Cecília (demo)", -23.5385, -46.651),
};

/**
 * Pontos de transferência DECLARADOS: só neles é permitido trocar de linha, e somente entre as linhas
 * que de fato passam pela mesma parada (verificado em testes). Nenhuma conexão é inferida por proximidade.
 */
export const DECLARED_TRANSFER_STOP_IDS = [
  "dms-1-5", // Higienópolis: D-100 / D-600
  "dms-3-1", // Sé: D-300 / D-600 / D-700
  "dms-4-5", // Ibirapuera: D-400 / D-700
  "dms-1-1", // Paraíso: D-100 / D-700
  "dms-2-1", // Largo da Batata: D-200 / D-800
  "dms-1-4", // Consolação: D-100 / D-800
  "dmx-republica", // República: D-600 / D-900
  "dms-5-1", // Barra Funda: D-500 / D-900
];

export function buildDemoNetwork(): NetLine[] {
  const lines: NetLine[] = [];
  const byId = new Map<string, NetStop>();
  for (const l of demoLines()) {
    const stops = demoStops(l.id).map((s) => X(s.id, s.name, s.latitude, s.longitude));
    stops.forEach((s) => byId.set(s.id, s));
    lines.push({ code: l.displayCode, name: l.name, lineId: l.id, stops, offsets: cumulativeMinutes(stops) });
  }
  const ref = (id: string): NetStop => {
    const s = byId.get(id);
    if (!s) throw new Error(`Demo network: stop ${id} not found`);
    return s;
  };
  const connector = (code: string, name: string, stops: NetStop[]): NetLine => ({ code, name, stops, offsets: cumulativeMinutes(stops) });
  lines.push(
    connector("D-600", "Higienópolis - República - Sé (demo connector)", [ref("dms-1-5"), EXTRA.republica, ref("dms-3-1")]),
    connector("D-700", "Ibirapuera - Paraíso - Sé (demo connector)", [ref("dms-4-5"), ref("dms-1-1"), EXTRA.liberdade, ref("dms-3-1")]),
    connector("D-800", "Pinheiros - Consolação (demo connector)", [ref("dms-2-1"), EXTRA.reboucas, ref("dms-1-4")]),
    connector("D-900", "Barra Funda - República (demo connector)", [ref("dms-5-1"), EXTRA.santaCecilia, EXTRA.republica]),
  );
  return lines;
}

/** Pontos de transferência declarados, no formato do validador (por nome de parada + códigos das linhas que a servem). */
export function declaredTransferPoints(network: NetLine[]): TransferPoint[] {
  return DECLARED_TRANSFER_STOP_IDS.map((id) => {
    const served = network.filter((l) => l.stops.some((s) => s.id === id));
    const stop = served[0]?.stops.find((s) => s.id === id);
    return { stopName: stop?.name ?? id, lineCodes: served.map((l) => l.code) };
  }).filter((t) => t.lineCodes.length >= 2);
}
