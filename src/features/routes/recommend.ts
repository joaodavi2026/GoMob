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
    out.fastest = { routeId: f.id, reasons: [`Shortest known duration: ${f.durationMinutes} min.`] };
  } else notes.fastest = "No route has a known duration.";

  const ft = [...routes].sort((a, b) => a.transfers - b.transfers || dur(a) - dur(b))[0];
  out.fewerTransfers = {
    routeId: ft.id,
    reasons: [ft.transfers === 0 ? "Direct route with no transfers." : `Fewest transfers: ${ft.transfers}.`],
  };

  const withRisk = routes.filter((r) => hasUsableRisk(r.risk));
  if (withRisk.length >= 2) {
    const sorted = [...withRisk].sort((a, b) => a.risk!.score! - b.risk!.score! || dur(a) - dur(b));
    const gap = sorted[1].risk!.score! - sorted[0].risk!.score!;
    if (gap >= MIN_RISK_GAP) {
      out.lowerRisk = {
        routeId: sorted[0].id,
        reasons: [`Lowest estimated risk score (${sorted[0].risk!.score}) among ${withRisk.length} routes with comparable data.`],
      };
    } else notes.lowerRisk = "Risk estimates are too close to call one route lower-risk.";
  } else {
    notes.lowerRisk = "Not enough comparable risk data to recommend a lower-risk route.";
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
    `Weighted score: time ${BALANCED_WEIGHTS.time * 100}%, transfers ${BALANCED_WEIGHTS.transfers * 100}%, walking ${BALANCED_WEIGHTS.walk * 100}%` +
      (useRisk ? `, estimated risk ${BALANCED_WEIGHTS.risk * 100}%.` : "."),
  ];
  if (!useRisk) reasons.push("Risk was left out because no route has usable risk data.");
  else if (routes.some((r) => !hasUsableRisk(r.risk))) reasons.push("Routes without risk data were scored as worst on risk, never as an advantage.");
  out.balanced = { routeId: best.id, reasons } satisfies Recommendation;
  return out;
}
