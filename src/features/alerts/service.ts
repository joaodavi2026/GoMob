import { db } from "@/server/db";
import { getLineRisk, isDemoLineId } from "@/features/intelligence/service";
import { getLines, getSystemStatus, getVehicles } from "@/server/transit/service";
import { deriveLineAlerts, deriveSystemAlerts, sortAlerts, type AlertType, type GomobAlert, type LineSignals } from "./derive";

const MAX_LINES = 6;
const LAST_RISK_KEY = (lineId: string) => `alerts.lastRisk.${lineId}`;

const CHANGE_WINDOW_MS = 30 * 60_000;

/**
 * Guarda o último nível calculado por linha. Se o nível mudou, registra a origem da mudança e a mantém por 30 min,
 * para o alerta "mudança relevante" não sumir na leitura seguinte. Falha de banco => sem alerta de mudança.
 */
async function previousRisk(lineId: string, current: { level: string; score: number | null }, now: Date) {
  try {
    const key = LAST_RISK_KEY(lineId);
    const row = await db.appSetting.findUnique({ where: { key } });
    const prev = row?.value as { level?: string; from?: string | null; since?: string } | null | undefined;
    let next = { level: current.level, from: prev?.from ?? null, since: prev?.since ?? now.toISOString() };
    if (!prev?.level) next = { level: current.level, from: null, since: now.toISOString() };
    else if (prev.level !== current.level) next = { level: current.level, from: prev.level, since: now.toISOString() };
    if (!prev || prev.level !== next.level) {
      await db.appSetting.upsert({ where: { key }, create: { key, value: next }, update: { value: next } });
    }
    const recent = next.from && now.getTime() - Date.parse(next.since) < CHANGE_WINDOW_MS;
    return recent ? ({ level: next.from, score: null } as LineSignals["previous"]) : null;
  } catch {
    return null;
  }
}

async function signalsFor(lineId: string, label: string): Promise<LineSignals | null> {
  try {
    const [veh, risk] = await Promise.all([getVehicles(lineId), getLineRisk(lineId)]);
    const previous = await previousRisk(lineId, { level: risk.level, score: risk.score }, new Date());
    return {
      lineId,
      lineLabel: label,
      vehiclesState: veh.state,
      vehicleCount: veh.vehicles.length,
      risk,
      previous,
      isDemo: isDemoLineId(lineId) || risk.source === "DEMO",
    };
  } catch {
    return null;
  }
}

/** Alertas persistidos (criados por admin/seed) + derivados. Falhas de banco/serviço degradam sem erro. */
export async function getAlerts(opts: { lineId?: string; now?: Date } = {}): Promise<GomobAlert[]> {
  const now = opts.now ?? new Date();
  const alerts: GomobAlert[] = [];

  try {
    const rows = await db.alert.findMany({
      where: {
        ...(opts.lineId ? { lineId: opts.lineId } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    for (const r of rows) {
      alerts.push({ id: r.id, lineId: r.lineId, type: r.type as AlertType, title: r.title, description: r.description, createdAt: r.createdAt.toISOString(), isDemo: r.isDemo });
    }
  } catch {
    // banco indisponível
  }

  try {
    let targets: { id: string; label: string }[] = [];
    if (opts.lineId) {
      targets = [{ id: opts.lineId, label: opts.lineId }];
    } else {
      const sys = await getSystemStatus();
      alerts.push(...deriveSystemAlerts(sys.integrations, sys.mode === "DEMO", now));
    }
    const lines = await getLines();
    const byId = new Map(lines.lines.map((l) => [l.id, l.displayCode]));
    if (!opts.lineId) targets = lines.lines.filter((l) => l.active).slice(0, MAX_LINES).map((l) => ({ id: l.id, label: l.displayCode }));
    else targets = [{ id: opts.lineId, label: byId.get(opts.lineId) ?? opts.lineId }];
    const signals = await Promise.all(targets.map((t) => signalsFor(t.id, t.label)));
    for (const s of signals) if (s) alerts.push(...deriveLineAlerts(s, now));
  } catch {
    // serviço de transporte indisponível: sem alertas derivados
  }

  const seen = new Set<string>();
  return sortAlerts(alerts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))));
}
