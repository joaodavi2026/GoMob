import { hasUsableRisk } from "./risk";
import type { RouteResult, SortKey } from "./types";

const dur = (r: RouteResult) => r.durationMinutes ?? Number.POSITIVE_INFINITY;

const byFastest = (a: RouteResult, b: RouteResult) => dur(a) - dur(b) || a.transfers - b.transfers || a.walkMinutes - b.walkMinutes;

export type SortOutcome = { routes: RouteResult[]; applied: SortKey; notice?: string };

/**
 * Ordena rotas. "lower_risk" só é aplicado quando ao menos 2 rotas têm risco utilizável (comparável);
 * rotas sem risco utilizável vão ao final e nunca são classificadas como "menor risco".
 * Com dados insuficientes, mantém a ordem "fastest" e informa o motivo.
 */
export function sortRoutes(routes: RouteResult[], key: SortKey): SortOutcome {
  const list = [...routes];
  switch (key) {
    case "fastest":
      return { routes: list.sort(byFastest), applied: "fastest" };
    case "fewer_transfers":
      return { routes: list.sort((a, b) => a.transfers - b.transfers || byFastest(a, b)), applied: "fewer_transfers" };
    case "less_walking":
      return { routes: list.sort((a, b) => a.walkMinutes - b.walkMinutes || byFastest(a, b)), applied: "less_walking" };
    case "lower_risk": {
      const comparable = list.filter((r) => hasUsableRisk(r.risk));
      if (comparable.length < 2) {
        return {
          routes: list.sort(byFastest),
          applied: "fastest",
          notice: "Not enough comparable risk data to sort by estimated crowding risk. Showing fastest first instead.",
        };
      }
      const usable = list.filter((r) => hasUsableRisk(r.risk)).sort((a, b) => a.risk!.score! - b.risk!.score! || byFastest(a, b));
      const rest = list.filter((r) => !hasUsableRisk(r.risk)).sort(byFastest);
      return { routes: [...usable, ...rest], applied: "lower_risk", notice: rest.length ? "Routes without a usable risk estimate are listed last." : undefined };
    }
  }
}
