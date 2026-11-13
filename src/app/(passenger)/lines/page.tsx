import type { Metadata } from "next";
import { LinesView } from "@/features/lines/lines-view";

export const metadata: Metadata = { title: "Linhas" };

export default function LinesPage() {
  return <LinesView />;
}
