import { redirect } from "next/navigation";
import { PassengerShell } from "@/components/layout/passenger-shell";
import { getSession, type SessionPayload } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function PassengerLayout({ children }: { children: React.ReactNode }) {
  let session: SessionPayload | null = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  if (!session) redirect("/login");
  return <PassengerShell>{children}</PassengerShell>;
}
