import { describe, expect, it } from "vitest";
import { advance, buildTrip, instruction, simulationPath, startProgress, type Progress, type TripEvent } from "@/features/trip/logic";
import type { BusRouteOption } from "@/types/transit";

const stops: [number, number, string][] = [
  [-46.6400, -23.5880, "Ponto A"],
  [-46.6430, -23.5850, "Ponto B"],
  [-46.6460, -23.5820, "Ponto C"],
  [-46.6490, -23.5790, "Ponto D"],
  [-46.6520, -23.5760, "Ponto E"],
];
const route: BusRouteOption = {
  id: "t",
  source: "GTFS",
  transfers: 0,
  walkMinutes: 6,
  durationMinutes: 25,
  path: [],
  dataTimestamp: new Date().toISOString(),
  steps: [
    { kind: "WALK", minutes: 3, from: "Casa", to: "Ponto A" },
    { kind: "BUS", lineCode: "875A-10", lineName: "sentido Perdizes", boardStop: "Ponto A", alightStop: "Ponto E", minutes: 12, direction: 0, legStops: stops },
    { kind: "WALK", minutes: 3, from: "Ponto E", to: "MASP" },
  ],
};
const origin = { latitude: -23.5900, longitude: -46.6390, label: "Casa" };
const destination = { latitude: -23.5745, longitude: -46.6530, label: "MASP" };

describe("modo em trajeto", () => {
  it("monta as fases na ordem certa", () => {
    const trip = buildTrip(route, origin, destination)!;
    expect(trip.phases.map((p) => p.kind)).toEqual(["walk", "wait", "ride", "walk", "arrived"]);
    expect(instruction(trip, startProgress()).title).toBe("Vá a pé até o ponto Ponto A");
  });

  it("sem paradas do trecho (rota sem GTFS) não abre o modo", () => {
    const noStops = { ...route, steps: route.steps.map((s) => (s.kind === "BUS" ? { ...s, legStops: undefined } : s)) };
    expect(buildTrip(noStops, origin, destination)).toBeNull();
  });

  it("percorre a viagem simulada inteira: embarca, avisa o ponto e chega", () => {
    const trip = buildTrip(route, origin, destination)!;
    let p: Progress = startProgress();
    const seen: string[] = [];
    const events: TripEvent[] = [];
    for (const pos of simulationPath(trip)) {
      const r = advance(trip, p, pos);
      events.push(...r.events);
      p = r.progress;
      const t = instruction(trip, p, pos).title;
      if (seen.at(-1) !== t) seen.push(t);
    }
    expect(trip.phases[p.phase].kind).toBe("arrived");
    expect(events).toContain("next_is_yours");
    expect(events.filter((e) => e === "next_is_yours")).toHaveLength(1);
    expect(events).toContain("arrived");
    expect(seen).toContain("Aguarde a linha 875A-10");
    expect(seen).toContain("Siga na linha 875A-10");
    expect(seen).toContain("Desça no próximo ponto");
    expect(seen.at(-1)).toBe("Você chegou!");
  });
});
