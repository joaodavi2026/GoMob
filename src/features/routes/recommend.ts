import { hasUsableRisk } from "./risk";
import type { Recommendation, Recommendations, RouteResult } from "./types";

/** Pesos do critério Balanced (transparentes): tempo 40%, risco 25%, transferências 20%, caminhada 15%. */
export const BALANCED_WEIGHTS = { time: 0.4, risk: 0.25, transfers: 0.2, walk: 0.15 } as const;
/** Diferença mínima de pontuação para considerar uma rota de "menor risco" de fato distinta. */
export const MIN_RISK_GAP = 5;

/**
 * Recomendações transparentes entre alternativas já válidas. Regras:
 * - Fastest: menor duração conhecida (rotas sem duração não concorrem).
 * - Fewer Transfers: menos baldeações; desempate pela menor duração.
 * - Lower Estimated Risk: só com ao menos 2 rotas de risco utilizável e diferença >= MIN_RISK_GAP; nunca por ausência de dados.
 * - Balanced: custo ponderado normalizado (BALANCED_WEIGHTS). Dado ausente recebe a PIOR nota do critério
 *   (nunca vantagem); se nenhuma rota tem risco, o termo é removido e os pesos são renormalizados.
 */
export function recommend(routes: RouteResult[]): Recommendations {
  const notes: Recommendations["notes"] = {};
  const out: Recommendations = { notes };
  if (routes.length === 0) return out;

  const dur = (r: RouteResult) => r.durationMinutes ?? Number.POSITIVE_INFINITY;

  const known = routes.filter((r) => r.durationMinutes !== null);
  if (known.length) {
    const f = [...known].sort((a, b) => dur(a) - dur(b) || a.transfers - b.transfers)[0];
    out.fastest = { routeId: f.id, reasons: [`Menor duração conhecida: ${f.durationMinutes} min.`] };
  } else notes.fastest = "Nenhuma rota tem duração conhecida.";

  const ft = [...routes].sort((a, b) => a.transfers - b.transfers || dur(a) - dur(b))[0];
  out.fewerTransfers = {
    routeId: ft.id,
    reasons: [ft.transfers === 0 ? "Rota direta, sem baldeações." : `Menos baldeações: ${ft.transfers}.`],
  };

  const withRisk = routes.filter((r) => hasUsableRisk(r.risk));
  if (withRisk.length >= 2) {
    const sorted = [...withRisk].sort((a, b) => a.risk!.score! - b.risk!.score! || dur(a) - dur(b));
    const gap = sorted[1].risk!.score! - sorted[0].risk!.score!;
    if (gap >= MIN_RISK_GAP) {
      out.lowerRisk = {
        routeId: sorted[0].id,
        reasons: [`Menor pontuação de risco estimado (${sorted[0].risk!.score}) entre ${withRisk.length} rotas com dados comparáveis.`],
      };
    } else notes.lowerRisk = "As estimativas de risco são próximas demais para apontar uma rota de menor risco.";
  } else {
    notes.lowerRisk = "Não há dados de risco comparáveis suficientes para recomendar uma rota de menor risco.";
  }

  // Balanced: cada critério vira um custo 0..1 em escala absoluta e transparente (não relativa ao conjunto):
  // tempo = excesso sobre a rota mais rápida / tempo mínimo; transferências = n/2; caminhada = min/30; risco = score/100.
  const tMin = Math.min(...routes.map(dur).filter(Number.isFinite));
  const useRisk = withRisk.length >= 1;
  const wSum = BALANCED_WEIGHTS.time + BALANCED_WEIGHTS.transfers + BALANCED_WEIGHTS.walk + (useRisk ? BALANCED_WEIGHTS.risk : 0);
  const cost = (r: RouteResult) => {
    const timeN = Number.isFinite(dur(r)) && Number.isFinite(tMin) ? Math.min(1, (dur(r) - tMin) / tMin) : 1;
    const riskN = !useRisk ? 0 : hasUsableRisk(r.risk) ? r.risk.score / 100 : 1;
    return (
      (BALANCED_WEIGHTS.time * timeN +
        BALANCED_WEIGHTS.transfers * Math.min(1, r.transfers / 2) +
        BALANCED_WEIGHTS.walk * Math.min(1, r.walkMinutes / 30) +
        (useRisk ? BALANCED_WEIGHTS.risk * riskN : 0)) /
      wSum
    );
  };
  const best = [...routes].sort((a, b) => cost(a) - cost(b) || dur(a) - dur(b))[0];
  const reasons = [
    `Pontuação ponderada: tempo ${BALANCED_WEIGHTS.time * 100}%, baldeações ${BALANCED_WEIGHTS.transfers * 100}%, caminhada ${BALANCED_WEIGHTS.walk * 100}%` +
      (useRisk ? `, risco estimado ${BALANCED_WEIGHTS.risk * 100}%.` : "."),
  ];
  if (!useRisk) reasons.push("O risco ficou de fora porque nenhuma rota tem dados de risco utilizáveis.");
  else if (routes.some((r) => !hasUsableRisk(r.risk))) reasons.push("Rotas sem dados de risco receberam a pior nota de risco, nunca uma vantagem.");
  out.balanced = { routeId: best.id, reasons } satisfies Recommendation;
  return out;
}
