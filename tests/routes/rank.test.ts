import { describe, expect, it } from "vitest";
import { recommend } from "@/features/routes/recommend";
import { aggregateRouteRisk } from "@/features/routes/risk";
import { sortRoutes } from "@/features/routes/sort";
import type { RouteResult } from "@/features/routes/types";
import { bus, NOW, option, result, risk, walk } from "./helpers";

const r = (id: string, over: Partial<RouteResult>) => result(id, over);

describe("sortRoutes", () => {
  const routes = [
    r("slow", { durationMinutes: 50, transfers: 0, walkMinutes: 10 }),
    r("fast", { durationMinutes: 25, transfers: 2, walkMinutes: 8 }),
    r("walky", { durationMinutes: 35, transfers: 1, walkMinutes: 25 }),
    r("unknown", { durationMinutes: null, transfers: 0, walkMinutes: 2 }),
  ];
  it("fastest: shortest first, unknown duration last", () => {
    expect(sortRoutes(routes, "fastest").routes.map((x) => x.id)).toEqual(["fast", "walky", "slow", "unknown"]);
  });
  it("fewer transfers (tie -> faster)", () => {
    expect(sortRoutes(routes, "fewer_transfers").routes.map((x) => x.id)).toEqual(["slow", "unknown", "walky", "fast"]);
  });
  it("less walking", () => {
    expect(sortRoutes(routes, "less_walking").routes.map((x) => x.id)).toEqual(["unknown", "fast", "slow", "walky"]);
  });
  it("does not mutate the input", () => {
    const copy = routes.map((x) => x.id);
    sortRoutes(routes, "less_walking");
    expect(routes.map((x) => x.id)).toEqual(copy);
  });

  describe("lower_risk", () => {
    it("never ranks by risk when there is no comparable data", () => {
      const noData = [r("a", { durationMinutes: 40, risk: risk(null) }), r("b", { durationMinutes: 20, risk: undefined })];
      const out = sortRoutes(noData, "lower_risk");
      expect(out.applied).toBe("fastest");
      expect(out.notice).toBeTruthy();
      expect(out.routes.map((x) => x.id)).toEqual(["b", "a"]);
    });
    it("a single route with risk is not comparable", () => {
      const one = [r("a", { durationMinutes: 40, risk: risk(10) }), r("b", { durationMinutes: 20, risk: risk(null) })];
      expect(sortRoutes(one, "lower_risk").applied).toBe("fastest");
    });
    it("orders by score and puts routes without usable risk last", () => {
      const list = [
        r("none", { durationMinutes: 10, risk: risk(null) }),
        r("high", { durationMinutes: 20, risk: risk(80) }),
        r("low", { durationMinutes: 30, risk: risk(10) }),
      ];
      const out = sortRoutes(list, "lower_risk");
      expect(out.applied).toBe("lower_risk");
      expect(out.routes.map((x) => x.id)).toEqual(["low", "high", "none"]);
    });
  });
});

describe("aggregateRouteRisk", () => {
  const o = option("x", [walk("A", "S1"), bus("L1", "S1", "T"), bus("L2", "T", "S3")]);
  it("uses the worst line when all lines have estimates", () => {
    const agg = aggregateRouteRisk(o, { L1: risk(20), L2: risk(75) }, NOW);
    expect(agg.score).toBe(75);
    expect(agg.level).toBe("HIGH");
    expect(agg.explanation).toMatch(/L2/);
  });
  it("any line without usable risk makes the route INSUFFICIENT_DATA (no advantage)", () => {
    const agg = aggregateRouteRisk(o, { L1: risk(5), L2: risk(null) }, NOW);
    expect(agg.level).toBe("INSUFFICIENT_DATA");
    expect(agg.score).toBeNull();
    expect(agg.explanation).toMatch(/L2/);
    expect(aggregateRouteRisk(o, { L1: risk(5) }, NOW).level).toBe("INSUFFICIENT_DATA");
  });
  it("confidence is the minimum across lines", () => {
    const agg = aggregateRouteRisk(o, { L1: risk(20, { confidence: 0.9 }), L2: risk(30, { confidence: 0.4 }) }, NOW);
    expect(agg.confidence).toBe(0.4);
  });
});

describe("recommend", () => {
  it("returns no recommendations for no routes", () => {
    const rec = recommend([]);
    expect(rec.fastest).toBeUndefined();
    expect(rec.balanced).toBeUndefined();
  });

  it("fastest and fewer transfers are separate criteria", () => {
    const list = [r("direct", { durationMinutes: 45, transfers: 0 }), r("quick", { durationMinutes: 25, transfers: 1 })];
    const rec = recommend(list);
    expect(rec.fastest?.routeId).toBe("quick");
    expect(rec.fewerTransfers?.routeId).toBe("direct");
    expect(rec.fastest?.reasons[0]).toMatch(/25 min/);
  });

  it("fastest ignores routes with unknown duration", () => {
    const rec = recommend([r("u", { durationMinutes: null }), r("k", { durationMinutes: 60 })]);
    expect(rec.fastest?.routeId).toBe("k");
    expect(recommend([r("u", { durationMinutes: null })]).fastest).toBeUndefined();
  });

  it("lower risk needs >= 2 comparable routes and a meaningful gap", () => {
    expect(recommend([r("a", { risk: risk(10) }), r("b", { risk: risk(null) })]).lowerRisk).toBeUndefined();
    expect(recommend([r("a", { risk: risk(10) }), r("b", { risk: risk(null) })]).notes.lowerRisk).toBeTruthy();
    expect(recommend([r("a", { risk: risk(40) }), r("b", { risk: risk(43) })]).lowerRisk).toBeUndefined();
    expect(recommend([r("a", { risk: risk(40) }), r("b", { risk: risk(20) })]).lowerRisk?.routeId).toBe("b");
  });

  it("missing risk data never becomes an advantage in the balanced pick", () => {
    // Idênticas em tudo, exceto: A tem risco conhecido (moderado), B não tem dados.
    const a = r("a", { durationMinutes: 30, transfers: 0, walkMinutes: 5, risk: risk(50) });
    const b = r("b", { durationMinutes: 30, transfers: 0, walkMinutes: 5, risk: risk(null) });
    expect(recommend([a, b]).balanced?.routeId).toBe("a");
    expect(recommend([b, a]).balanced?.routeId).toBe("a");
    expect(recommend([a, b]).balanced?.reasons.join(" ")).toMatch(/never as an advantage/);
  });

  it("balanced: a moderately slower but low-risk route can beat a fast high-risk one", () => {
    const fastHigh = r("fastHigh", { durationMinutes: 25, transfers: 0, walkMinutes: 5, risk: risk(90) });
    const slowLow = r("slowLow", { durationMinutes: 30, transfers: 0, walkMinutes: 5, risk: risk(10) });
    expect(recommend([fastHigh, slowLow]).balanced?.routeId).toBe("slowLow");
  });

  it("balanced without any risk data drops the risk term and says so", () => {
    const a = r("a", { durationMinutes: 20, transfers: 1, walkMinutes: 5, risk: risk(null) });
    const b = r("b", { durationMinutes: 40, transfers: 0, walkMinutes: 5, risk: risk(null) });
    const rec = recommend([a, b]);
    expect(rec.balanced?.reasons.join(" ")).toMatch(/Risk was left out/);
    expect(rec.balanced?.routeId).toBe("a"); // tempo pesa 40% contra 20% de transferências
  });

  it("a single route is recommended where applicable, never a nonexistent one", () => {
    const only = r("only", { durationMinutes: 33 });
    const rec = recommend([only]);
    expect(rec.fastest?.routeId).toBe("only");
    expect(rec.balanced?.routeId).toBe("only");
    expect(rec.lowerRisk).toBeUndefined();
  });
});
