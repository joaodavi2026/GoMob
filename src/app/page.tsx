import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  let session: SessionPayload | null = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  if (!session) redirect("/login");
  redirect(session.role === "ADMIN" ? "/admin" : "/home");
}
