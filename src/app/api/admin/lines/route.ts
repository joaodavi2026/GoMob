import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { lineListQuerySchema, listLines, setLineActive, type AdminLine, type LineListQuery, type LinesDb } from "@/features/admin/lines";
import { isDbAvailable } from "@/server/db/available";
import { getLines } from "@/server/transit/service";

export const dynamic = "force-dynamic";

const linesDb = db as unknown as LinesDb;

/**
 * Sem banco: lista as linhas monitoradas direto do serviço de transporte (SPTrans ao vivo ou demo),
 * todas ativas. A troca ativa/inativa continua exigindo o banco (PATCH).
 */
async function linesWithoutDb(q: LineListQuery) {
  const { lines } = await getLines({ search: q.search });
  const all: AdminLine[] = lines
    .map((l) => ({
      id: l.id,
      externalCode: l.externalCode,
      displayCode: l.displayCode,
      name: l.name,
      direction: l.direction,
      source: l.source,
      active: true,
      lastSyncedAt: null,
    }))
    .filter((l) => (q.active ? String(l.active) === q.active : true) && (q.source ? l.source === q.source : true))
    .sort((a, b) => a.displayCode.localeCompare(b.displayCode, "pt-BR", { numeric: true }));
  const start = (q.page - 1) * q.pageSize;
  return { lines: all.slice(start, start + q.pageSize), total: all.length, page: q.page, pageSize: q.pageSize, withoutDb: true };
}

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const q = lineListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  if (!(await isDbAvailable())) return ok(await linesWithoutDb(q));
  try {
    return ok(await listLines(linesDb, q));
  } catch {
    return ok(await linesWithoutDb(q));
  }
});

/** Ativa/desativa o monitoramento INTERNO de uma linha. Nunca altera dados da SPTrans. */
export const PATCH = handle(async (req: NextRequest) => {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  let line;
  try {
    line = await setLineActive(linesDb, body, session.userId);
  } catch (e) {
    if (e instanceof ZodError) throw e;
    throw new ApiError(503, "DB_UNAVAILABLE", "Ativar ou desativar linhas exige o banco de dados, que não está conectado nesta demonstração.");
  }
  if (!line) throw new ApiError(404, "NOT_FOUND", "Linha não encontrada.");
  return ok({ line });
});
