import type { GeoPoint } from "@/types/transit";

/** Pontos conhecidos de São Paulo (coordenadas aproximadas) usados para escolher origem/destino na demonstração. */
export type KnownPlace = { id: string; label: string; latitude: number; longitude: number };

export const KNOWN_PLACES: KnownPlace[] = [
  { id: "paraiso", label: "Paraíso", latitude: -23.5885, longitude: -46.6415 },
  { id: "brigadeiro", label: "Av. Brigadeiro Luís Antônio", latitude: -23.5762, longitude: -46.6473 },
  { id: "masp", label: "MASP - Av. Paulista", latitude: -23.5616, longitude: -46.6557 },
  { id: "consolacao", label: "Consolação", latitude: -23.5556, longitude: -46.6618 },
  { id: "higienopolis", label: "Higienópolis", latitude: -23.5512, longitude: -46.6668 },
  { id: "republica", label: "Praça da República", latitude: -23.5434, longitude: -46.6429 },
  { id: "se", label: "Praça da Sé", latitude: -23.5503, longitude: -46.6331 },
  { id: "tatuape", label: "Tatuapé", latitude: -23.5407, longitude: -46.5762 },
  { id: "pinheiros", label: "Largo da Batata - Pinheiros", latitude: -23.5666, longitude: -46.6917 },
  { id: "itaim", label: "Itaim Bibi", latitude: -23.5848, longitude: -46.6808 },
  { id: "ibirapuera", label: "Parque Ibirapuera", latitude: -23.5872, longitude: -46.6574 },
  { id: "santoamaro", label: "Largo Treze - Santo Amaro", latitude: -23.6543, longitude: -46.7088 },
  { id: "barrafunda", label: "Barra Funda", latitude: -23.5267, longitude: -46.6668 },
  { id: "pompeia", label: "Pompeia", latitude: -23.5282, longitude: -46.6828 },
];

export function placeToPoint(p: KnownPlace): GeoPoint {
  return { latitude: p.latitude, longitude: p.longitude, label: p.label };
}

export function findPlace(id: string): KnownPlace | undefined {
  return KNOWN_PLACES.find((p) => p.id === id);
}

/** Lugar conhecido mais próximo de um ponto (tolerância em graus ~110 m). */
export function matchKnownPlace(p: { latitude: number; longitude: number }): KnownPlace | undefined {
  return KNOWN_PLACES.find((k) => Math.abs(k.latitude - p.latitude) < 0.001 && Math.abs(k.longitude - p.longitude) < 0.001);
}
