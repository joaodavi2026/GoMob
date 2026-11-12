import type { Metadata } from "next";
import { PredictView } from "@/features/predict/ui/predict-view";

export const metadata: Metadata = { title: "Previsão" };

export default function PredictPage() {
  return <PredictView />;
}
