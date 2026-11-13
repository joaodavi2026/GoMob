import type { Metadata } from "next";
import { LineView } from "@/features/lines/line-view";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Linha ${decodeURIComponent(code)}` };
}

export default async function LinePage({ params }: Props) {
  const { code } = await params;
  return <LineView code={decodeURIComponent(code).slice(0, 16)} />;
}
