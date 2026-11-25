import { describe, expect, it } from "vitest";
import { crowdingLabel, crowdingNow, lineIndex, morningShare, pickEmptiest, routeCrowding, type LineSchedule } from "@/features/routes/crowding";
import { risk } from "./helpers";

const every = (min: number, from = 4, to = 23): [number, number][] => Array.from({ length: to - from + 1 }, (_, i) => [from + i, min]);
const often: LineSchedule = { freq: every(8), days: "1111111" };
const rare: LineSchedule = { freq: every(30), days: "1111100" };
const WED_7H = new Date("2026-11-25T10:10:00Z"); // quarta, 7h10 em São Paulo
const WED_2H = new Date("2026-11-25T05:10:00Z"); // quarta, 2h10

describe("índice de lotação por horário (aproximado)", () => {
  it("pico é mais cheio que o meio da noite, e linha espaçada mais cheia que linha frequente", () => {
    expect(lineIndex(often, 3, 7)!).toBeGreaterThan(lineIndex(often, 3, 22)!);
    expect(lineIndex(rare, 3, 12)!).toBeGreaterThan(lineIndex(often, 3, 12)!);
  });
  it("fora do horário ou do dia de operação não há índice", () => {
    expect(lineIndex(often, 3, 2)).toBeNull();
    expect(lineIndex(rare, 0, 12)).toBeNull(); // domingo
    expect(lineIndex(rare, 6, 12)).toBeNull(); // sábado
    expect(lineIndex(rare, 1, 12)).not.toBeNull(); // segunda
  });
  it("o sentido pesa: mais viagens de manhã puxam o pico da manhã", () => {
    const inbound: LineSchedule = { freq: [[7, 10], [17, 20]], days: null };
    const outbound: LineSchedule = { freq: [[7, 20], [17, 10]], days: null };
    expect(morningShare(inbound.freq)).toBeGreaterThan(0.5);
    expect(morningShare(outbound.freq)).toBeLessThan(0.5);
    expect(morningShare([])).toBe(0.5);
  });
  it("sempre fica entre 0 e 100", () => {
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) for (const s of [often, rare, null]) {
      const v = lineIndex(s, d, h);
      if (v !== null) expect(v >= 0 && v <= 100).toBe(true);
    }
  });
});

describe("lotação da rota", () => {
  it("vale o trecho mais cheio; se uma linha não opera na hora, a rota não existe", () => {
    const c = routeCrowding([{ code: "A", schedule: often }, { code: "B", schedule: rare }], WED_7H)!;
    expect(c.weekday).toBe(3);
    expect(c.hour).toBe(7);
    expect(c.typical).toBe(lineIndex(rare, 3, 7));
    expect(c.line).toBe("B");
    expect(c.week[0].every((v) => v === null)).toBe(true); // B não roda no domingo
    expect(routeCrowding([], WED_7H)).toBeNull();
  });
  it("ajusta ao vivo só com irregularidade medida; a estimativa de reserva e a demonstração não contam", () => {
    const measured = risk(100, { source: "DERIVED" });
    const fallback = risk(100, { source: "DERIVED", factors: { demand: 50, headway: 100, delay: null, operations: null } });
    const at = (r: ReturnType<typeof risk>) => routeCrowding([{ code: "A", schedule: often, risk: r }], WED_7H)!;
    expect(at(measured).live!).toBeGreaterThan(at(measured).typical!);
    expect(at(fallback).live).toBeNull();
    expect(at(risk(100)).live).toBeNull(); // DEMO
    expect(crowdingNow(at(fallback))).toBe(at(fallback).typical);
  });
  it("fora do horário não tem índice agora", () => {
    const c = routeCrowding([{ code: "A", schedule: often }], WED_2H)!;
    expect(crowdingNow(c)).toBeNull();
    expect(crowdingLabel(null)).toBe("Fora do horário");
  });
});

describe("rota mais vazia", () => {
  const mk = (id: string, s: LineSchedule, now = WED_7H, durationMinutes = 30) => ({ id, durationMinutes, crowding: routeCrowding([{ code: id, schedule: s }], now)! });
  it("escolhe o menor índice e explica", () => {
    const e = pickEmptiest([mk("rara", rare), mk("frequente", often)])!;
    expect(e.routeId).toBe("frequente");
    expect(e.reasons.join(" ")).toMatch(/a menor entre 2 rotas/);
  });
  it("empate vai para a mais rápida e é dito na explicação", () => {
    const e = pickEmptiest([mk("lenta", often, WED_7H, 50), mk("rapida", often, WED_7H, 20)])!;
    expect(e.routeId).toBe("rapida");
    expect(e.reasons[0]).toMatch(/empatada/);
  });
  it("sem ao menos 2 rotas comparáveis não há selo", () => {
    expect(pickEmptiest([mk("so", often)])).toBeUndefined();
    expect(pickEmptiest([mk("a", often, WED_2H), mk("b", often, WED_2H)])).toBeUndefined();
    expect(pickEmptiest([])).toBeUndefined();
  });
});
