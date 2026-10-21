import type { Metadata } from "next";
import { PredictView } from "@/features/predict/ui/predict-view";

export const metadata: Metadata = { title: "Predict" };

export default function PredictPage() {
  return <PredictView />;
}
