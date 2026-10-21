import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { RoutesView } from "@/features/routes/ui/routes-view";

export const metadata: Metadata = { title: "Routes" };

export default function RoutesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-6"><Skeleton className="h-40 w-full" /></div>}>
      <RoutesView />
    </Suspense>
  );
}
