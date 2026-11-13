import { describe, expect, it } from "vitest";
import { GeoError, geoErrorText, geoMessage } from "@/lib/geo";
import { COVERAGE_METERS, coverageNotice, kmText, nearestBusStop } from "@/features/network/server";

describe("área atendida pela SPTrans", () => {
  it("dentro de São Paulo não há aviso", () => {
    expect(coverageNotice("Você está", -23.5616, -46.6557)).toBeNull(); // MASP
    expect(nearestBusStop(-23.5616, -46.6557)!.meters).toBeLessThan(COVERAGE_METERS);
  });
  it("fora da cidade (ex.: Caieiras) explica e diz a distância até o ponto mais próximo", () => {
    const msg = coverageNotice("Você está", -23.3643, -46.7406)!;
    expect(msg).toMatch(/^Você está fora da área atendida/);
    expect(msg).toMatch(/fica a \d+,\d km/);
    expect(nearestBusStop(-23.3643, -46.7406)!.meters).toBeGreaterThan(COVERAGE_METERS);
  });
  it("formata distâncias em metros e quilômetros", () => {
    expect(kmText(84)).toBe("80 m");
    expect(kmText(2840)).toBe("2,8 km");
  });
});

describe("mensagens de localização", () => {
  it("cada falha tem uma orientação própria", () => {
    expect(geoMessage("denied")).toMatch(/bloqueada/);
    expect(geoMessage("insecure")).toMatch(/https/);
    expect(geoMessage("timeout")).toMatch(/demorou/);
    expect(geoMessage("unsupported")).toMatch(/não informa/);
    expect(geoMessage("unavailable")).toMatch(/desligado/);
  });
  it("erro desconhecido vira a mensagem genérica", () => {
    expect(geoErrorText(new GeoError("denied"))).toBe(geoMessage("denied"));
    expect(geoErrorText(new Error("x"))).toBe(geoMessage("unavailable"));
  });
});
