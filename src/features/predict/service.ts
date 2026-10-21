import { ApiError } from "@/lib/api";
import { loadHistory, loadWeights } from "@/features/intelligence/service";
import { getScenario } from "@/server/demo/scenario";
import { getLine, getSystemStatus } from "@/server/transit/service";
import { buildPrediction, parseTarget, type Prediction } from "./engine";
import type { PredictQuery } from "./schema";

export type PredictResponse = Prediction & { line: { id: string; displayCode: string; name: string; direction: number } };

export async function getPrediction(q: PredictQuery): Promise<PredictResponse> {
  const line = await getLine(q.lineId);
  if (!line) throw new ApiError(404, "LINE_NOT_FOUND", "Bus line not found.");
  const target = parseTarget({ date: q.date, weekday: q.weekday, time: q.time });
  if (!target) throw new ApiError(400, "VALIDATION", "Invalid date or time.");

  const [history, weights, sc] = await Promise.all([loadHistory(line.id), loadWeights(), getScenario()]);
  let mode: "DEMO" | "LIVE" = "DEMO";
  if (!line.id.startsWith("demo-")) {
    try {
      mode = (await getSystemStatus()).mode;
    } catch {
      mode = "LIVE"; // na dúvida, não fabricar cenário demonstrativo para linha real
    }
  }
  const todaySp = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const prediction = buildPrediction({
    target,
    history,
    mode,
    scenario: sc.scenario,
    recoveryStartedAt: sc.recoveryStartedAt,
    lineKey: line.id,
    weights,
    todaySp,
  });
  return { ...prediction, line: { id: line.id, displayCode: line.displayCode, name: line.name, direction: line.direction } };
}
