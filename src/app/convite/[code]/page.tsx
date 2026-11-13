import type { Metadata } from "next";
import { JoinView } from "@/features/family/join-view";

export const metadata: Metadata = { title: "Convite para a família" };

/** Link de convite da família: /convite/CODIGO (sem login nem senha). */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinView code={code.toUpperCase().slice(0, 12)} />;
}
