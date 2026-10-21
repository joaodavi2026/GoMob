import { computeHourlyDemandFactor, type DemandSupport, type HistoryRow } from "@/features/intelligence/demand";
import { demoFactors, DEMO_LABEL, hashUnit } from "@/features/intelligence/demo";
import { clamp, computeRisk, type RiskInputs } from "@/features/intelligence/engine";
import type { RiskWeights } from "@/features/intelligence/weights";
import type { DemoScenario, RiskResult } from "@/types/transit";

export type PredictTarget = { weekday: number; hour: number; minute: number; date?: string };

export type DataQuality = { level: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "DEMO"; label: string; notes: string[] };

export type HistoricalSource = {
  kind: "HISTORICAL" | "DEMO_SCENARIO" | "NONE";
  granularity: "HOURLY" | "DAILY" | "NONE";
  samples: number;
  distinctDates: number;
  description: string;
};

export type Prediction = {
  risk: RiskResult;
  dataQuality: DataQuality;
  historicalSource: HistoricalSource;
  limitations: string[];
  isDemo: boolean;
  requested: { weekday: number; weekdayLabel: string; time: string; date?: string };
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const PREDICT_DEMO_NOTICE = "Illustrative demonstration scenario, not a validated forecast.";

/** Perfil de demanda ILUSTRATIVO (não derivado de dados): picos de dias úteis às 6-9h e 16-19h. */
export function illustrativeDemandProfile(weekday: number, hour: number): number {
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return hour >= 10 && hour <= 19 ? 40 : 18;
  if ((hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19)) return 85;
  if (hour >= 10 && hour <= 15) return 50;
  return 22;
}

export function parseTarget(input: { date?: string; weekday?: number; time: string }): PredictTarget | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input.time);
  if (!m) return null;
  let weekday = input.weekday;
  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
    const d = new Date(`${input.date}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    weekday = d.getUTCDay();
  }
  if (weekday === undefined || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  return { weekday, hour: Number(m[1]), minute: Number(m[2]), date: input.date };
}

function qualityFromConfidence(c: number | null): DataQuality["level"] {
  if (c === null) return "NONE";
  return c >= 0.7 ? "HIGH" : c >= 0.45 ? "MEDIUM" : "LOW";
}

const SUPPORT_REASON: Record<NonNullable<DemandSupport["reason"]>, string> = {
  NO_DATA: "No historical demand records exist for this line.",
  DAILY_AGGREGATE_ONLY: "Only day-level aggregated records exist; hourly peaks cannot be derived from them.",
  INSUFFICIENT_SAMPLES: "Hourly records exist but are too sparse to sustain a pattern for this weekday and hour.",
};

/**
 * Previsão por padrões: só quando o histórico HORÁRIO sustenta o padrão (amostras mínimas). Caso contrário:
 * - modo DEMO: cenário demonstrativo explicitamente rotulado (source DEMO, isDemo true);
 * - modo LIVE: INSUFFICIENT_DATA (nada é inventado).
 */
export function buildPrediction(args: {
  target: PredictTarget;
  history: HistoryRow[];
  mode: "DEMO" | "LIVE";
  scenario: DemoScenario;
  recoveryStartedAt?: string | null;
  lineKey: string;
  weights?: RiskWeights;
  now?: Date;
  todaySp?: string;
}): Prediction {
  const { target, history, mode, scenario, lineKey } = args;
  const now = args.now ?? new Date();
  const time = `${String(target.hour).padStart(2, "0")}:${String(target.minute).padStart(2, "0")}`;
  const requested = { weekday: target.weekday, weekdayLabel: WEEKDAYS[target.weekday], time, date: target.date };
  const limitations: string[] = [
    "This is an estimate of crowding risk, not a passenger count or a calibrated probability.",
    "Live signals such as bus spacing and delays cannot be known in advance and are not part of this estimate.",
  ];
  if (target.date && args.todaySp && target.date < args.todaySp) limitations.push("The selected date is in the past; this is not a forecast.");

  const { factor, support } = computeHourlyDemandFactor(history, { weekday: target.weekday, hour: target.hour });

  if (factor.value !== null) {
    const risk = computeRisk({ demand: factor }, {
      weights: args.weights,
      now,
      essential: ["demand"],
      minCoverage: 0,
      ignoreFreshness: true,
      confidenceCap: 0.6,
      explanationPrefix: "Pattern-based estimate from hourly history only.",
    });
    limitations.push(`Based on ${support.distinctDates} ${WEEKDAYS[target.weekday]}(s) of hourly records; patterns may change and may not repeat.`);
    const level = qualityFromConfidence(risk.confidence);
    return {
      risk,
      dataQuality: {
        level,
        label: level === "HIGH" ? "Good" : level === "MEDIUM" ? "Fair" : "Limited",
        notes: [`${support.samples} hourly records across ${support.distinctDates} dates and ${support.hoursCovered} hours.`, "Confidence is a data-quality indicator, not statistical accuracy."],
      },
      historicalSource: {
        kind: "HISTORICAL",
        granularity: "HOURLY",
        samples: support.samples,
        distinctDates: support.distinctDates,
        description: `Hourly historical demand (${support.sources.join(", ") || "unspecified source"}).`,
      },
      limitations,
      isDemo: false,
      requested,
    };
  }

  const reason = support.reason ? SUPPORT_REASON[support.reason] : SUPPORT_REASON.NO_DATA;

  if (mode === "DEMO") {
    const sc = demoFactors(scenario, `predict:${lineKey}`, { recoveryStartedAt: args.recoveryStartedAt, now });
    const inputs: RiskInputs = sc ? { ...sc } : {};
    if (sc) {
      inputs.demand = {
        value: Math.round(clamp(illustrativeDemandProfile(target.weekday, target.hour) + hashUnit(`${lineKey}:${target.weekday}:${target.hour}`) * 5)),
        granularity: "HOURLY",
        origin: "DEMO",
      };
      // Previsão futura não tem atualidade de observação: remove carimbos de tempo dos fatores.
      for (const k of ["headway", "delay", "operations"] as const) inputs[k] = { ...sc[k]!, observedAt: null, granularity: "REFERENCE" };
    }
    const risk = computeRisk(inputs, {
      weights: args.weights,
      now,
      forceSource: "DEMO",
      ignoreFreshness: true,
      confidenceCap: 0.4,
      explanationPrefix: `${PREDICT_DEMO_NOTICE} ${DEMO_LABEL}`,
    });
    limitations.unshift(PREDICT_DEMO_NOTICE, reason);
    return {
      risk,
      dataQuality: { level: "DEMO", label: "Demonstration", notes: ["No sustained historical pattern is available, so a labeled demonstration scenario is shown."] },
      historicalSource: { kind: "DEMO_SCENARIO", granularity: support.granularity, samples: support.samples, distinctDates: support.distinctDates, description: `Demonstration scenario ${scenario}; not derived from real history.` },
      limitations,
      isDemo: true,
      requested,
    };
  }

  limitations.unshift(reason, "Not enough historical data to estimate risk for this selection.");
  const risk = computeRisk({}, { weights: args.weights, now, essential: ["demand"], explanationPrefix: "No prediction available." });
  return {
    risk,
    dataQuality: { level: "NONE", label: "Insufficient", notes: [reason] },
    historicalSource: { kind: "NONE", granularity: support.granularity, samples: support.samples, distinctDates: support.distinctDates, description: "No historical source supports this prediction." },
    limitations,
    isDemo: false,
    requested,
  };
}
