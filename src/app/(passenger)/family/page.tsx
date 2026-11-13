import type { Metadata } from "next";
import { FamilyView } from "@/features/family/family-view";

export const metadata: Metadata = { title: "Família" };

export default function FamilyPage() {
  return <FamilyView />;
}
