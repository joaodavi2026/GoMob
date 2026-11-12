import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FavoriteRepo, FavoriteRecord } from "./service";

/**
 * Favoritos sem banco: arquivo .data/favorites.json (fora do git). Se o disco não aceitar gravação
 * (ex.: hospedagem só-leitura), os favoritos ficam na memória do servidor enquanto ele estiver no ar.
 */
const FILE = join(process.cwd(), ".data", "favorites.json");
type Stored = Omit<FavoriteRecord, "createdAt"> & { createdAt: string };

let memory: Stored[] | null = null;

function load(): Stored[] {
  if (memory) return memory;
  try {
    memory = JSON.parse(readFileSync(/*turbopackIgnore: true*/ FILE, "utf8")) as Stored[];
  } catch {
    memory = [];
  }
  return memory;
}
function persist() {
  try {
    mkdirSync(/*turbopackIgnore: true*/ join(process.cwd(), ".data"), { recursive: true });
    writeFileSync(/*turbopackIgnore: true*/ FILE, JSON.stringify(memory ?? [], null, 1));
  } catch {
    // disco só-leitura: segue na memória
  }
}
const toRecord = (s: Stored): FavoriteRecord => ({ ...s, createdAt: new Date(s.createdAt) });

export const localFavoriteRepo: FavoriteRepo = {
  async list(userId, skip, take) {
    return load()
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(skip, skip + take)
      .map(toRecord);
  },
  async count(userId) {
    return load().filter((f) => f.userId === userId).length;
  },
  async create(userId, data) {
    const rec: Stored = { ...data, id: randomUUID(), userId, createdAt: new Date().toISOString() };
    load().push(rec);
    persist();
    return toRecord(rec);
  },
  async findById(id) {
    const f = load().find((x) => x.id === id);
    return f ? toRecord(f) : null;
  },
  async update(id, data) {
    const f = load().find((x) => x.id === id)!;
    Object.assign(f, data);
    persist();
    return toRecord(f);
  },
  async remove(id) {
    memory = load().filter((x) => x.id !== id);
    persist();
  },
};
