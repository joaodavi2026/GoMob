import { describe, expect, it } from "vitest";
import { parseRoute } from "@/features/assistant/brain";
import { normalizeForecast } from "@/features/network/arrivals";
import { railInfo, readableOn, titleCase } from "@/features/network/rail";
import { findLine, headwayNow, hhmm, nextDepartures, norm, resolvePlace, runsNow } from "@/features/network/server";

describe("Gobi: entender a pergunta de trajeto", () => {
  it("separa origem e destino", () => {
    expect(parseRoute("Como vou do Paraíso para a Sé?")).toEqual({ from: "Paraiso", to: "Se" });
    expect(parseRoute("da Sé até o Terminal Lapa")).toEqual({ from: "Se", to: "Terminal Lapa" });
    expect(parseRoute("saindo de Pinheiros pra Barra Funda")).toEqual({ from: "Pinheiros", to: "Barra Funda" });
  });
  it("aceita só o destino", () => {
    expect(parseRoute("quero ir para o Ibirapuera")).toEqual({ to: "Ibirapuera" });
    expect(parseRoute("ônibus para Pinheiros")).toEqual({ to: "Pinheiros" });
    expect(parseRoute("como chego na Paulista?")).toEqual({ to: "Paulista" });
  });
  it("não confunde outras perguntas com trajeto", () => {
    expect(parseRoute("quanto custa a passagem")).toBeNull();
    expect(parseRoute("oi")).toBeNull();
  });
});

describe("rede GTFS no servidor", () => {
  it("acha linhas pelo código completo, sem sufixo e pelo nome dos trilhos", () => {
    expect(findLine("horário da linha 875A-10")?.code).toBe("875A-10");
    expect(findLine("onde está o 8000?")?.code).toBe("8000-10");
    expect(findLine("linha azul do metrô")?.code).toBe("METRÔ L1");
    expect(findLine("horário da linha 3 vermelha")?.code).toBe("METRÔ L3");
    expect(findLine("linha esmeralda")?.code).toBe("CPTM L09");
    expect(findLine("quanto custa a passagem")).toBeNull();
  });
  it("resolve lugares citados: locais conhecidos, estações e terminais", () => {
    expect(resolvePlace("a Sé")?.label).toBe("Praça da Sé");
    expect(resolvePlace("Paulista")?.label).toMatch(/Paulista/);
    expect(resolvePlace("o Terminal Lapa")?.label).toBe("Terminal Lapa");
    expect(resolvePlace("xyzxyz inexistente")).toBeNull();
  });
  it("horário programado: janela de operação, intervalo e próximas partidas", () => {
    const dir = { days: "1111111", first: "04:00", last: "23:59", minHeadway: 8, freq: [[4, 30], [5, 15], [12, 20]] as [number, number][] };
    const noon = new Date("2026-11-12T15:10:00Z"); // 12:10 em São Paulo
    const dawn = new Date("2026-11-12T05:30:00Z"); // 02:30
    expect(runsNow(dir, noon)).toBe(true);
    expect(runsNow(dir, dawn)).toBe(false);
    expect(runsNow({ days: "1111111", first: "22:00", last: "04:00" }, dawn)).toBe(true); // cruza a meia-noite
    expect(headwayNow(dir, noon)).toBe(20);
    expect(headwayNow(dir, dawn)).toBe(8);
    expect(nextDepartures(dir, noon, 3)).toEqual(["12:20", "12:40", "04:00"]);
    expect(hhmm(1445)).toBe("00:05");
    expect(norm("Praça da Sé!")).toBe("praca da se");
  });
});

describe("previsão de chegada (Olho Vivo)", () => {
  const raw = {
    hr: "23:55",
    p: {
      l: [
        { c: "475R-10", sl: 1, lt0: "TERM. PQ. D. PEDRO II", lt1: "JD. SÃO SAVÉRIO", vs: [{ p: "52827", t: "23:58", a: true }, { p: "52810", t: "00:20", a: false }] },
        { c: "5106-10", sl: 2, lt0: "LGO. SÃO FRANCISCO", lt1: "MAR PAULISTA", vs: [{ p: 63377, t: "23:56", a: true }, { p: "x", t: "12:00" }, { p: "y", t: "ruim" }] },
      ],
    },
  };
  it("calcula os minutos (inclusive virando a meia-noite), ordena e descarta previsões inválidas", () => {
    const { clock, arrivals } = normalizeForecast(raw, () => undefined);
    expect(clock).toBe("23:55");
    expect(arrivals.map((a) => [a.code, a.minutes])).toEqual([
      ["5106-10", 1],
      ["475R-10", 3],
      ["475R-10", 25],
    ]);
    expect(arrivals[1].headsign).toBe("Term. Pq. D. Pedro II");
    expect(arrivals[0].headsign).toBe("Mar Paulista"); // sentido 2: destino é o outro terminal
    expect(arrivals[1].accessible).toBe(true);
  });
  it("resposta vazia ou estranha vira lista vazia", () => {
    expect(normalizeForecast({ hr: "23:55", p: null }, () => undefined).arrivals).toEqual([]);
    expect(normalizeForecast(null, () => undefined)).toEqual({ clock: null, arrivals: [] });
  });
});

describe("linhas de trilhos e textos", () => {
  it("número e nome popular", () => {
    expect(railInfo("METRÔ L1")).toMatchObject({ number: "1", name: "Azul", operator: "Metrô" });
    expect(railInfo("CPTM L09")).toMatchObject({ number: "9", name: "Esmeralda" });
    expect(railInfo("875A-10")).toBeNull();
  });
  it("cor de texto legível e nomes sem caixa alta", () => {
    expect(readableOn("#FFFF00")).toBe("#12151b");
    expect(readableOn("#0455A1")).toBe("#ffffff");
    expect(titleCase("TERM. PQ. D. PEDRO II")).toBe("Term. Pq. D. Pedro II");
    expect(titleCase("PRAÇA DA SÉ")).toBe("Praça da Sé");
  });
});
