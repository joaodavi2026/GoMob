import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { MapView } from "./map-view";

export const metadata = { title: "Map | GoMob" };

export default function MapPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[60dvh] w-full" />}>
      <MapView />
    </Suspense>
  );
}
