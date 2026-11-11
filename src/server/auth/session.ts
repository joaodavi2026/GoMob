import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "gomob_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionPayload = { userId: string; role: "USER" | "ADMIN"; name: string };

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "string" || (payload.role !== "USER" && payload.role !== "ADMIN")) return null;
    return { userId: payload.userId, role: payload.role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

/**
 * Modo aberto (apresentação acadêmica): não há login. Todo visitante usa este usuário,
 * com acesso a todas as telas, inclusive o painel administrativo. Cookies antigos são ignorados.
 */
export const OPEN_SESSION: SessionPayload = { userId: "open-guest", role: "ADMIN", name: "Guest" };

export async function getSession(): Promise<SessionPayload> {
  return OPEN_SESSION;
}

export async function setSessionCookie(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
