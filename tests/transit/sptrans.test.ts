import { describe, expect, it, vi } from "vitest";
import { createSptransClient } from "@/server/sptrans/client";
import { normalizeLines, normalizePositions, normalizeStops, parseSptransTimestamp } from "@/server/sptrans/normalize";
import { SptransError } from "@/server/sptrans/types";

const NOW = Date.parse("2026-10-21T15:00:00Z");

const LINES_FIXTURE = [
  { cl: 1273, lc: false, lt: "8000", tl: 10, sl: 1, tp: "PCA.RAMOS DE AZEVEDO", ts: "TERM. JD. BRITANIA" },
  { cl: 34041, lc: false, lt: "8000", tl: 10, sl: 2, tp: "PCA.RAMOS DE AZEVEDO", ts: "TERM. JD. BRITANIA" },
  { cl: "bad", lt: "x", sl: 1 },
  { cl: 5, lt: "1", sl: 3 },
  null,
  { cl: 1273, lt: "8000", tl: 10, sl: 1 }, // duplicada
];

describe("normalização SPTrans", () => {
  it("normaliza linhas e descarta inválidas/duplicadas", () => {
    const lines = normalizeLines(LINES_FIXTURE);
    expect(lines.map((l) => l.id)).toEqual(["sp-1273", "sp-34041"]);
    expect(lines[0]).toMatchObject({ displayCode: "8000-10", direction: 1, source: "SPTRANS", externalCode: "1273" });
    expect(lines[1].name).toBe("TERM. JD. BRITANIA - PCA.RAMOS DE AZEVEDO");
  });

  it("resposta vazia ou não-array", () => {
    expect(normalizeLines([])).toEqual([]);
    expect(normalizeLines({ Message: "x" })).toEqual([]);
    expect(normalizePositions({ hr: "10:00", vs: [] }, "sp-1", NOW).vehicles).toEqual([]);
    expect(normalizePositions(null, "sp-1", NOW).vehicles).toEqual([]);
  });

  it("normaliza paradas e ignora coordenadas inválidas", () => {
    const stops = normalizeStops([
      { cp: 100, np: "Parada A", ed: "R. X", py: -23.55, px: -46.63 },
      { cp: 101, np: "Zero", py: 0, px: 0 },
      { cp: "x", py: -23.5, px: -46.6 },
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ id: "sps-100", source: "SPTRANS" });
  });

  it("converte timestamps: UTC explícito e sem fuso (America/Sao_Paulo)", () => {
    expect(parseSptransTimestamp("2026-10-21T14:59:30Z")?.toISOString()).toBe("2026-10-21T14:59:30.000Z");
    expect(parseSptransTimestamp("2026-10-21T11:59:30")?.toISOString()).toBe("2026-10-21T14:59:30.000Z");
    expect(parseSptransTimestamp("lixo")).toBeNull();
    expect(parseSptransTimestamp(undefined)).toBeNull();
  });

  it("posições: valida ids/coords, descarta antigas (>30min), mantém levemente antigas com observedAt real", () => {
    const raw = {
      hr: "11:59",
      vs: [
        { p: 11001, a: true, ta: "2026-10-21T14:59:40Z", py: -23.55, px: -46.63 }, // fresca
        { p: "11002", a: false, ta: "2026-10-21T14:50:00Z", py: -23.56, px: -46.64 }, // 10min: mantida
        { p: 11003, ta: "2026-10-21T13:00:00Z", py: -23.56, px: -46.64 }, // 2h: descartada
        { p: 11004, ta: "2026-10-21T14:59:00Z", py: 0, px: 0 }, // coord inválida
        { p: "abc", ta: "2026-10-21T14:59:00Z", py: -23.5, px: -46.6 }, // id inválido
        { p: 11005, ta: "nao-e-data", py: -23.5, px: -46.6 },
        { p: 11001, ta: "2026-10-21T14:59:50Z", py: -23.5, px: -46.6 }, // duplicado
      ],
    };
    const { vehicles, discarded } = normalizePositions(raw, "sp-1273", NOW);
    expect(vehicles.map((v) => v.id)).toEqual(["spv-11001", "spv-11002"]);
    expect(vehicles[1].observedAt).toBe("2026-10-21T14:50:00.000Z");
    expect(vehicles.every((v) => v.source === "SPTRANS" && v.lineId === "sp-1273")).toBe(true);
    expect(discarded).toBe(5);
  });
});

function res(body: unknown, init: { status?: number; headers?: Record<string, string>; cookies?: string[] } = {}) {
  const headers = new Headers(init.headers);
  for (const c of init.cookies ?? []) headers.append("set-cookie", c);
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: init.status ?? 200, headers });
}

function mkClient(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return createSptransClient({ token: "TESTTOKEN", baseUrl: "https://example.test/v2.1", fetchImpl, sleep: async () => {}, ...extra });
}

describe("cliente SPTrans", () => {
  it("autentica, envia cookie de sessão e usa cache/dedupe", async () => {
    const calls: { url: string; cookie: string | null; method: string }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, cookie: new Headers(init?.headers).get("cookie"), method: init?.method ?? "GET" });
      if (u.includes("/Login/Autenticar")) return res("true", { cookies: ["apiCredentials=abc123; path=/; HttpOnly"] });
      return res({ hr: "11:59", vs: [] });
    }) as unknown as typeof fetch;
    const c = mkClient(fetchImpl);
    const [a, b] = await Promise.all([c.positionsByLine(1273), c.positionsByLine(1273)]); // concorrentes
    await c.positionsByLine(1273); // cache
    expect(a).toEqual(b);
    const logins = calls.filter((x) => x.url.includes("Login"));
    const gets = calls.filter((x) => x.url.includes("/Posicao/Linha"));
    expect(logins).toHaveLength(1);
    expect(logins[0].method).toBe("POST");
    expect(gets).toHaveLength(1);
    expect(gets[0].cookie).toContain("apiCredentials=abc123");
    expect(gets[0].url).toContain("codigoLinha=1273");
  });

  it("erro de autenticação externa (login retorna false) -> AUTH e backoff sem martelar a API", async () => {
    const fetchImpl = vi.fn(async () => res("false")) as unknown as typeof fetch;
    const c = mkClient(fetchImpl);
    await expect(c.searchLines("8000")).rejects.toMatchObject({ kind: "AUTH" });
    await expect(c.searchLines("8000")).rejects.toMatchObject({ kind: "AUTH" });
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(c.getHealth().lastFailureKind).toBe("AUTH");
    expect(c.getHealth().authenticated).toBe(false);
  });

  it("sem token: NOT_CONFIGURED e nenhuma chamada de rede", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const c = createSptransClient({ token: "", fetchImpl });
    await expect(c.searchLines("x")).rejects.toBeInstanceOf(SptransError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reautentica uma vez ao receber 401", async () => {
    let logins = 0;
    let gets = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("Login")) {
        logins++;
        return res("true", { cookies: [`apiCredentials=s${logins}`] });
      }
      gets++;
      if (gets === 1) return res({ Message: "Authorization has been denied for this request." }, { status: 401 });
      return res([]);
    }) as typeof fetch;
    const c = mkClient(fetchImpl);
    await expect(c.searchLines("8000")).resolves.toEqual([]);
    expect(logins).toBe(2);
  });

  it("retries limitados em 5xx e depois falha", async () => {
    let gets = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes("Login")) return res("true");
      gets++;
      return res("err", { status: 503 });
    }) as typeof fetch;
    const c = mkClient(fetchImpl, { maxRetries: 2 });
    await expect(c.positionsByLine(1)).rejects.toMatchObject({ kind: "HTTP", status: 503 });
    expect(gets).toBe(3);
  });

  it("rate limit 429: respeita cooldown sem novas chamadas", async () => {
    let t = 1_000_000;
    let gets = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes("Login")) return res("true");
      gets++;
      return res("slow down", { status: 429, headers: { "retry-after": "10" } });
    }) as typeof fetch;
    const c = mkClient(fetchImpl, { now: () => t });
    await expect(c.positionsByLine(1)).rejects.toMatchObject({ kind: "RATE_LIMIT" });
    await expect(c.positionsByLine(2)).rejects.toMatchObject({ kind: "RATE_LIMIT" });
    expect(gets).toBe(1);
    t += 11_000;
    await expect(c.positionsByLine(3)).rejects.toMatchObject({ kind: "RATE_LIMIT" });
    expect(gets).toBe(2);
  });

  it("timeout vira TIMEOUT", async () => {
    const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("Login")) return Promise.resolve(res("true"));
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    }) as typeof fetch;
    const c = mkClient(fetchImpl, { timeoutMs: 20, maxRetries: 0 });
    await expect(c.positionsByLine(1)).rejects.toMatchObject({ kind: "TIMEOUT" });
  });

  it("catálogo (linhas) serve cópia antiga em erro; posições nunca", async () => {
    let t = 0;
    let fail = false;
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("Login")) return res("true");
      if (fail) return res("x", { status: 500 });
      return res(u.includes("Linha/Buscar") ? LINES_FIXTURE : { vs: [] });
    }) as typeof fetch;
    const c = mkClient(fetchImpl, { now: () => t, maxRetries: 0 });
    await c.searchLines("8000");
    await c.positionsByLine(1);
    t += 24 * 3_600_000;
    fail = true;
    await expect(c.searchLines("8000")).resolves.toEqual(LINES_FIXTURE);
    await expect(c.positionsByLine(1)).rejects.toBeDefined();
  });
});
