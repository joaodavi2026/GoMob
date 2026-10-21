"use client";

import dynamic from "next/dynamic";
import type { GeoPoint, TransitStop, TransitVehicle } from "@/types/transit";
import { Skeleton } from "@/components/ui/primitives";

export type TransitMapProps = {
  vehicles: TransitVehicle[];
  stops?: TransitStop[];
  /** Trajeto a destacar, em [lng, lat]. Reutilizável por /routes e admin. */
  highlightPath?: [number, number][];
  pathColor?: string;
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string | null) => void;
  /** Se definido, cliques no mapa selecionam um ponto (origem/destino). */
  onPickPoint?: (p: GeoPoint) => void;
  pickedPoint?: GeoPoint | null;
  /** Marcadores adicionais (ex.: origem e destino de uma rota). */
  extraPoints?: GeoPoint[];
  showLocate?: boolean;
  showReset?: boolean;
  fitToPath?: boolean;
  /** Instante de referência para classificar frescor (padrão: Date.now()). */
  now?: number;
  className?: string;
  /** Sobreposições (painéis, bottom sheet) renderizadas dentro do container do mapa. */
  children?: React.ReactNode;
};

/** Mapa reutilizável (MapLibre GL JS carregado dinamicamente apenas no cliente). */
export const TransitMap = dynamic<TransitMapProps>(() => import("./transit-map-impl"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[320px] w-full rounded-none" />,
});
