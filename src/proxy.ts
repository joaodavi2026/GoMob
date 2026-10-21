import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/session";
import { decideAccess } from "@/server/auth/route-policy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let session = null;
  try {
    session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    session = null; // SESSION_SECRET ausente: trata como não autenticado
  }
  const decision = decideAccess(pathname, session);
  if (decision.action === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));
  return NextResponse.next();
}

export const config = {
  // Ignora /api (rotas se protegem), _next, branding, icons, manifest e arquivos estáticos.
  matcher: ["/((?!api/|_next/|branding/|icons/|manifest|favicon|.*\\.[a-zA-Z0-9]+$).*)"],
};
