import { z } from "zod";

export const lineListQuerySchema = z.object({
  search: z.string().trim().max(60).optional(),
  active: z.enum(["true", "false"]).optional(),
  source: z.enum(["SPTRANS", "DEMO"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type LineListQuery = z.infer<typeof lineListQuerySchema>;

export const lineToggleSchema = z
  .object({ id: z.string().min(1).max(64).optional(), externalCode: z.string().min(1).max(32).optional(), active: z.boolean() })
  .refine((v) => Boolean(v.id) !== Boolean(v.externalCode), { message: "Provide exactly one of id or externalCode." });
export type LineToggle = z.infer<typeof lineToggleSchema>;

/** Monta o filtro Prisma para listagem (pura, testável). */
export function buildLineWhere(q: LineListQuery) {
  const where: Record<string, unknown> = {};
  if (q.active) where.active = q.active === "true";
  if (q.source) where.source = q.source;
  if (q.search) {
    where.OR = [
      { displayCode: { contains: q.search, mode: "insensitive" } },
      { externalCode: { contains: q.search, mode: "insensitive" } },
      { name: { contains: q.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export type AdminLine = {
  id: string;
  externalCode: string;
  displayCode: string;
  name: string;
  direction: number;
  source: string;
  active: boolean;
  lastSyncedAt: string | null;
};

type LineRow = Omit<AdminLine, "lastSyncedAt"> & { lastSyncedAt: Date | null };

export type LinesDb = {
  busLine: {
    findMany(args: { where: Record<string, unknown>; orderBy: unknown; skip: number; take: number }): Promise<LineRow[]>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
    findFirst(args: { where: Record<string, unknown> }): Promise<LineRow | null>;
    updateMany(args: { where: Record<string, unknown>; data: { active: boolean } }): Promise<{ count: number }>;
  };
  auditLog: { create(args: { data: { actorId: string; action: string; entityType: string; entityId: string } }): Promise<unknown> };
};

export function serializeLine(l: LineRow): AdminLine {
  return { ...l, lastSyncedAt: l.lastSyncedAt ? l.lastSyncedAt.toISOString() : null };
}

export async function listLines(db: LinesDb, q: LineListQuery) {
  const where = buildLineWhere(q);
  const [rows, total] = await Promise.all([
    db.busLine.findMany({ where, orderBy: [{ active: "desc" }, { displayCode: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    db.busLine.count({ where }),
  ]);
  return { lines: rows.map(serializeLine), total, page: q.page, pageSize: q.pageSize };
}

/** Altera apenas a configuração interna do GoMob (campo `active`); nunca toca a SPTrans. */
export async function setLineActive(db: LinesDb, input: unknown, actorId: string): Promise<AdminLine | null> {
  const t = lineToggleSchema.parse(input);
  const where = t.id ? { id: t.id } : { externalCode: t.externalCode };
  const found = await db.busLine.findFirst({ where });
  if (!found) return null;
  await db.busLine.updateMany({ where: { id: found.id }, data: { active: t.active } });
  await db.auditLog.create({
    data: { actorId, action: t.active ? "LINE_MONITORING_ENABLED" : "LINE_MONITORING_DISABLED", entityType: "BusLine", entityId: found.id },
  });
  return serializeLine({ ...found, active: t.active });
}
