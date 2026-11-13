/**
 * Localização do aparelho, com duas tentativas e mensagens claras.
 *
 * 1ª tentativa: rápida (rede/Wi-Fi), que é a que funciona em computadores e dentro de prédios.
 * 2ª tentativa: GPS de alta precisão, com mais tempo. Uma posição recente (até 5 min) também serve.
 */
export type GeoFailure = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";
export class GeoError extends Error {
  constructor(public reason: GeoFailure) {
    super(reason);
  }
}
export type Fix = { lat: number; lon: number; accuracy: number };

const once = (options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));

export async function locate(): Promise<Fix> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) throw new GeoError("unsupported");
  // fora de https (ou localhost) o navegador nem pergunta: nega direto
  if (typeof window !== "undefined" && !window.isSecureContext) throw new GeoError("insecure");
  const done = (p: GeolocationPosition): Fix => ({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
  try {
    return done(await once({ enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 }));
  } catch (first) {
    const e = first as GeolocationPositionError;
    if (e?.code === 1) throw new GeoError("denied");
    try {
      return done(await once({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 5 * 60_000 }));
    } catch (second) {
      const s = second as GeolocationPositionError;
      throw new GeoError(s?.code === 1 ? "denied" : s?.code === 3 ? "timeout" : "unavailable");
    }
  }
}

/** A permissão já foi dada antes? (para usar a localização sem perguntar de novo) */
export async function locationAlreadyAllowed(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.permissions) return false;
    return (await navigator.permissions.query({ name: "geolocation" })).state === "granted";
  } catch {
    return false;
  }
}

export function geoMessage(reason: GeoFailure): string {
  switch (reason) {
    case "unsupported":
      return "Este aparelho não informa a localização.";
    case "insecure":
      return "A localização só funciona em endereço seguro (https). Neste endereço, escolha o lugar pelo nome.";
    case "denied":
      return "A localização está bloqueada para este site. Libere nas permissões do navegador (ícone ao lado do endereço) ou escolha o lugar pelo nome.";
    case "timeout":
      return "A localização demorou demais para responder. Tente de novo em um lugar aberto ou escolha o lugar pelo nome.";
    default:
      return "O aparelho não conseguiu descobrir a localização (o serviço de localização pode estar desligado). Escolha o lugar pelo nome.";
  }
}

export const geoErrorText = (e: unknown) => geoMessage(e instanceof GeoError ? e.reason : "unavailable");
