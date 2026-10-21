/** Formatos brutos da Olho Vivo v2.1 (documentação oficial). Campos tratados como não confiáveis. */
export type RawLine = { cl?: unknown; lc?: unknown; lt?: unknown; tl?: unknown; sl?: unknown; tp?: unknown; ts?: unknown };
export type RawStop = { cp?: unknown; np?: unknown; ed?: unknown; py?: unknown; px?: unknown };
export type RawVehicle = { p?: unknown; a?: unknown; ta?: unknown; py?: unknown; px?: unknown };

export class SptransError extends Error {
  constructor(
    public kind: "AUTH" | "RATE_LIMIT" | "TIMEOUT" | "NETWORK" | "HTTP" | "BAD_RESPONSE" | "NOT_CONFIGURED",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "SptransError";
  }
}
