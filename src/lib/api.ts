import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiFailure>({ ok: false, error: { code, message, details } }, { status });
}

/** Envolve um handler convertendo exceções em respostas padronizadas (sem vazar detalhes internos). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message);
      if (e instanceof ZodError) return fail(400, "VALIDATION", "Invalid request.", e.flatten());
      console.error("[api]", e instanceof Error ? e.message : "unknown error");
      return fail(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

/** Cliente: faz fetch no próprio backend e desembrulha { ok, data }. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;
  if (!body) throw new Error("Connection problem. Please try again.");
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}
