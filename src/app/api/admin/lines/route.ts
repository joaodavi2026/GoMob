import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { lineListQuerySchema, listLines, setLineActive, type LinesDb } from "@/features/admin/lines";

export const dynamic = "force-dynamic";

const linesDb = db as unknown as LinesDb;

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const q = lineListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  try {
    return ok(await listLines(linesDb, q));
  } catch {
    throw new ApiError(503, "DB_UNAVAILABLE", "Database unavailable. Lines cannot be listed right now.");
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
    throw new ApiError(503, "DB_UNAVAILABLE", "Database unavailable. The change was not saved.");
  }
  if (!line) throw new ApiError(404, "NOT_FOUND", "Line not found.");
  return ok({ line });
});
