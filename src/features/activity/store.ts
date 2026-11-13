import { randomUUID } from "node:crypto";
import { jsonStore } from "@/server/store/local";

/** Histórico de trajetos feitos no modo "em trajeto" (como a aba Atividade de apps de corrida). */
export type Activity = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  /** tempo real com o modo aberto, em segundos */
  elapsedSec: number;
  /** duração prevista da rota, em minutos */
  plannedMin: number | null;
  origin: string;
  destination: string;
  from: [number, number]; // [lat, lon]
  to: [number, number];
  lines: string[];
  transfers: number;
  distanceM: number;
  fare: number | null;
  status: "COMPLETED" | "CANCELED";
  /** como a posição foi acompanhada */
  mode: "gps" | "sim" | "manual";
  path: [number, number][]; // [lon, lat], reduzido
};
export type NewActivity = Omit<Activity, "id" | "userId">;

const store = jsonStore<{ items: Activity[] }>("activity", () => ({ items: [] }));
const MAX_PER_USER = 200;

export function listActivity(userId: string): Activity[] {
  return store
    .read()
    .items.filter((a) => a.userId === userId)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}

export function addActivity(userId: string, data: NewActivity): Activity {
  return store.update((d) => {
    const rec: Activity = { ...data, id: randomUUID(), userId };
    d.items.push(rec);
    const mine = d.items.filter((a) => a.userId === userId);
    if (mine.length > MAX_PER_USER) {
      const drop = new Set(
        mine
          .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
          .slice(0, mine.length - MAX_PER_USER)
          .map((a) => a.id),
      );
      d.items = d.items.filter((a) => !drop.has(a.id));
    }
    return rec;
  });
}

export function removeActivity(userId: string, id: string): boolean {
  return store.update((d) => {
    const before = d.items.length;
    d.items = d.items.filter((a) => !(a.id === id && a.userId === userId));
    return d.items.length < before;
  });
}

export function clearActivity(userId: string) {
  store.update((d) => {
    d.items = d.items.filter((a) => a.userId !== userId);
  });
}
