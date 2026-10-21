export type KnownPlace = { id: string; label: string; area: string; latitude: number; longitude: number };

/** Static São Paulo reference points (approximate public coordinates). Not a geocoder. */
export const KNOWN_PLACES: KnownPlace[] = [
  { id: "paulista", label: "Av. Paulista (MASP)", area: "Bela Vista", latitude: -23.5614, longitude: -46.6559 },
  { id: "dom-pedro", label: "Terminal Pq. Dom Pedro II", area: "Centro", latitude: -23.5503, longitude: -46.628 },
  { id: "luz", label: "Estação da Luz", area: "Luz", latitude: -23.5336, longitude: -46.6366 },
  { id: "se", label: "Praça da Sé", area: "Centro", latitude: -23.5505, longitude: -46.6333 },
  { id: "vila-madalena", label: "Vila Madalena", area: "Zona Oeste", latitude: -23.5565, longitude: -46.6911 },
  { id: "pinheiros", label: "Pinheiros (Largo da Batata)", area: "Zona Oeste", latitude: -23.5668, longitude: -46.7017 },
  { id: "santo-amaro", label: "Santo Amaro (Largo 13)", area: "Zona Sul", latitude: -23.654, longitude: -46.709 },
  { id: "bandeira", label: "Terminal Bandeira", area: "Centro", latitude: -23.5547, longitude: -46.6428 },
  { id: "usp", label: "USP Butantã", area: "Zona Oeste", latitude: -23.5606, longitude: -46.7311 },
  { id: "tiete", label: "Terminal Tietê", area: "Zona Norte", latitude: -23.5163, longitude: -46.6256 },
  { id: "ibirapuera", label: "Parque Ibirapuera", area: "Zona Sul", latitude: -23.5874, longitude: -46.6576 },
  { id: "congonhas", label: "Aeroporto de Congonhas", area: "Zona Sul", latitude: -23.6261, longitude: -46.6564 },
];

export type PickedPoint = { latitude: number; longitude: number; label: string };

export function toPoint(p: KnownPlace): PickedPoint {
  return { latitude: p.latitude, longitude: p.longitude, label: p.label };
}

/** Builds the /routes URL: o=lat,lng,label&d=lat,lng,label */
export function routesHref(o: PickedPoint, d: PickedPoint): string {
  const enc = (p: PickedPoint) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)},${p.label}`;
  const qs = new URLSearchParams({ o: enc(o), d: enc(d) });
  return `/routes?${qs.toString()}`;
}
