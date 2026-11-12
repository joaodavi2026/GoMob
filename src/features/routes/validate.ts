import type { BusRouteOption, RouteStep } from "@/types/transit";

/** Tipos de veículo (Google Routes) aceitos: somente ônibus. Metrô, trem, VLT, monotrilho etc. são rejeitados. */
export function isBusVehicleType(type: string | null | undefined): boolean {
  return type === "BUS";
}

const NON_BUS_TEXT =
  /(metr[oô]|subway|\btrem\b|\btrain\b|\bcptm\b|\bvlt\b|monotrilho|monorail|\brail\b|\btram\b|ferry|barca|telef[eé]rico|cable\s?car)/i;
const METRO_LINE_NAME = /^linha\s*\d+\s*[-–]\s*(azul|verde|vermelha|amarela|lil[aá]s|rubi|diamante|esmeralda|turquesa|coral|safira|jade|prata)/i;

/** Heurística textual: o nome/código da linha sugere transporte que não é ônibus? */
export function looksNonBus(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => !!t && (NON_BUS_TEXT.test(t) || METRO_LINE_NAME.test(t.trim())));
}

export type TransferPoint = { stopName: string; lineCodes: string[] };

export type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Valida que uma opção é exclusivamente de ônibus (com caminhadas):
 * - passos só WALK/BUS, ao menos um BUS;
 * - nenhum nome/código de linha sugere metrô/trem/VLT/monotrilho;
 * - transferências == (nº de passos BUS - 1);
 * - passos BUS consecutivos se conectam no mesmo ponto (ou via caminhada que liga desembarque a embarque);
 * - com `transferPoints`, a troca de linhas só é válida em ponto de transferência declarado para ambas as linhas.
 */
export function validateBusOnlyRoute(option: BusRouteOption, transferPoints?: TransferPoint[]): ValidationResult {
  const steps: RouteStep[] = option.steps;
  if (!Array.isArray(steps) || steps.length === 0) return { valid: false, reason: "A rota não tem etapas." };
  const buses = steps.filter((s): s is Extract<RouteStep, { kind: "BUS" }> => s.kind === "BUS");
  for (const s of steps) {
    if (s.kind !== "WALK" && s.kind !== "BUS") return { valid: false, reason: "A rota contém uma etapa que não é de ônibus nem de caminhada." };
  }
  if (buses.length === 0) return { valid: false, reason: "A rota não tem etapa de ônibus." };
  for (const b of buses) {
    // No GTFS o tipo da linha é oficial (route_type 3 = ônibus); nomes como "Metrô Santana - Itaim Bibi"
    // são de ônibus que vão até a estação, então a heurística por texto só vale para as outras fontes.
    if (option.source !== "GTFS" && looksNonBus(b.lineCode, b.lineName)) return { valid: false, reason: `A linha ${b.lineCode} não é um serviço de ônibus.` };
    if (!b.lineCode || !b.boardStop || !b.alightStop) return { valid: false, reason: "Etapa de ônibus sem linha ou paradas." };
  }
  if (option.transfers !== buses.length - 1) return { valid: false, reason: "O número de baldeações não corresponde às etapas de ônibus." };

  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i];
    if (a.kind !== "BUS") continue;
    // próximo passo BUS (possivelmente após uma caminhada de conexão)
    const n1 = steps[i + 1];
    let next: Extract<RouteStep, { kind: "BUS" }> | null = null;
    if (n1.kind === "BUS") {
      if (n1.boardStop !== a.alightStop) return { valid: false, reason: "Etapas de ônibus consecutivas não se conectam na mesma parada." };
      next = n1;
    } else if (n1.kind === "WALK" && steps[i + 2]?.kind === "BUS") {
      const n2 = steps[i + 2] as Extract<RouteStep, { kind: "BUS" }>;
      if (n1.from !== a.alightStop || n1.to !== n2.boardStop) return { valid: false, reason: "A caminhada de baldeação não liga a parada de desembarque à de embarque." };
      next = n2;
    }
    if (next && transferPoints) {
      const stop = a.alightStop;
      const declared = transferPoints.some(
        (t) => t.stopName === stop && t.lineCodes.includes(a.lineCode) && t.lineCodes.includes(next!.lineCode),
      );
      if (!declared) return { valid: false, reason: `Não há ponto de baldeação declarado entre ${a.lineCode} e ${next.lineCode} em ${stop}.` };
    }
  }
  return { valid: true };
}

/** Mantém apenas opções válidas e somente de ônibus; informa quantas foram rejeitadas e por quê. */
export function filterBusOnly(options: BusRouteOption[], transferPoints?: TransferPoint[]) {
  const accepted: BusRouteOption[] = [];
  const rejected: { id: string; reason: string }[] = [];
  for (const o of options) {
    const r = validateBusOnlyRoute(o, transferPoints);
    if (r.valid) accepted.push(o);
    else rejected.push({ id: o.id, reason: r.reason });
  }
  return { accepted, rejected };
}
