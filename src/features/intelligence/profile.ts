import type { TransitStop } from "@/types/transit";
import { normalize, type FactorObservation } from "./engine";
import { haversineMeters } from "./signals";

/**
 * Estimativa de reserva, usada quando há poucos ônibus ao vivo (menos de 3) para medir os intervalos:
 *  - demanda: curva típica do transporte por ônibus ao longo do dia (hipótese de referência, não histórico da linha);
 *  - intervalo: extensão do trajeto dividida pela quantidade de ônibus circulando agora naquele sentido.
 * O resultado é sempre apresentado como estimativa aproximada, com confiança limitada.
 */
const WEEKDAY = [8, 5, 4, 6, 22, 55, 90, 100, 85, 62, 52, 55, 62, 58, 55, 62, 78, 98, 95, 75, 55, 42, 30, 18];
const SATURDAY = [10, 6, 4, 5, 14, 30, 45, 55, 60, 62, 64, 66, 68, 62, 58, 56, 56, 58, 55, 48, 40, 34, 28, 18];
const SUNDAY = [8, 5, 3, 3, 8, 16, 24, 30, 36, 42, 46, 50, 50, 46, 44, 44, 46, 46, 42, 36, 30, 24, 18, 12];

/** Demanda típica (0–100) para o dia da semana (0 = domingo) e a hora em São Paulo. */
export function typicalDemand(weekday: number, hour: number): FactorObservation {
  const curve = weekday === 0 ? SUNDAY : weekday === 6 ? SATURDAY : WEEKDAY;
  return { value: curve[Math.min(23, Math.max(0, Math.floor(hour)))], granularity: "REFERENCE", origin: "DERIVED" };
}

export function routeLengthMeters(stops: Pick<TransitStop, "latitude" | "longitude">[]): number {
  let m = 0;
  for (let i = 1; i < stops.length; i++) m += haversineMeters(stops[i - 1], stops[i]);
  return m;
}

const AVG_BUS_KMH = 15;

/** Intervalo estimado (min) entre ônibus: extensão do trajeto / ônibus em circulação, a ~15 km/h. */
export function estimatedIntervalMinutes(lengthMeters: number, vehicles: number): number | null {
  if (vehicles < 1 || lengthMeters < 500) return null;
  return (lengthMeters / 1000 / vehicles / AVG_BUS_KMH) * 60;
}

/** Fator de intervalo (0–100) a partir da contagem: até 8 min = 0; 40 min ou mais = 100. */
export function intervalFactor(lengthMeters: number, vehicles: number, observedAt: string): FactorObservation {
  const min = estimatedIntervalMinutes(lengthMeters, vehicles);
  if (min === null) return { value: null };
  return { value: Math.round(normalize(min, 8, 40)), observedAt, granularity: "REALTIME", origin: "DERIVED" };
}
