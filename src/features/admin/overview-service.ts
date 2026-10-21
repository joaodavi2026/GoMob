import { buildOverview, type Overview } from "./overview";
import { operatingMode } from "./weights";

export type OverviewDb = {
  busLine: { findMany(args: { select: { active: true; source: true } }): Promise<{ active: boolean; source: string }[]> };
  busVehicle: {
    findMany(args: { where: { observedAt: { gte: Date } }; select: { observedAt: true; isDemo: true }; take: number; orderBy: { observedAt: "desc" } }): Promise<
      { observedAt: Date; isDemo: boolean }[]
    >;
  };
  riskEstimate: {
    findMany(args: {
      where: { calculatedAt: { gte: Date } };
      select: { riskLevel: true; expiresAt: true; calculatedAt: true };
      take: number;
      orderBy: { calculatedAt: "desc" };
    }): Promise<{ riskLevel: "LOW" | "MODERATE" | "HIGH" | "INSUFFICIENT_DATA"; expiresAt: Date; calculatedAt: Date }[]>;
  };
};

/**
 * Agrega o overview. Cada consulta degrada isoladamente (banco indisponível => zeros),
 * e `dbAvailable` informa a tela. Nenhuma métrica é fabricada.
 */
export async function loadOverview(
  db: OverviewDb,
  opts: { now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<Overview & { dbAvailable: boolean }> {
  const now = opts.now ?? new Date();
  const mode = operatingMode(opts.env ?? process.env);
  let failed = false;
  const safe = async <T>(p: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p();
    } catch {
      failed = true;
      return fallback;
    }
  };
  const since = new Date(now.getTime() - 60 * 60_000);
  const [lines, vehicles, estimates] = await Promise.all([
    safe(() => db.busLine.findMany({ select: { active: true, source: true } }), []),
    safe(() => db.busVehicle.findMany({ where: { observedAt: { gte: since } }, select: { observedAt: true, isDemo: true }, take: 5000, orderBy: { observedAt: "desc" } }), []),
    safe(
      () => db.riskEstimate.findMany({ where: { calculatedAt: { gte: since } }, select: { riskLevel: true, expiresAt: true, calculatedAt: true }, take: 5000, orderBy: { calculatedAt: "desc" } }),
      [],
    ),
  ]);
  const overview = buildOverview({
    now,
    mode,
    lines,
    vehicles,
    estimates,
    integrations: failed ? [{ state: "UNAVAILABLE", configured: true }] : [{ state: "CONNECTED", configured: true }],
  });
  return { ...overview, dbAvailable: !failed };
}
