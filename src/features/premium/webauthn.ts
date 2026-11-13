/**
 * Verificação com a biometria do próprio aparelho (WebAuthn): Face ID / Touch ID no iPhone,
 * digital ou PIN no Android, Windows Hello no computador.
 *
 * É uma demonstração: a resposta do aparelho não é conferida no servidor (não há conta real a proteger).
 * Só funciona em contexto seguro (https ou localhost); fora disso o app usa a verificação simulada.
 *
 * No computador: um site NÃO consegue pedir a senha da conta do Windows. O que existe é o Windows Hello
 * (PIN, rosto ou digital, os mesmos da tela de bloqueio), e só quando ele está configurado. Sem ele, o Chrome
 * oferece o Gerenciador de senhas do Google no lugar. Por isso, no computador o padrão é o PIN de segurança
 * do próprio app, e o Windows Hello é uma opção para quem o tem configurado.
 */
const KEY = "gomob.passkey.v2";
const MODE_KEY = "gomob.verify.mode";

export type VerifyMode = "device" | "sim";
export type DevicePlatform = "ios" | "android" | "desktop";
/** Quem guardou a chave e pediu a confirmação. */
export type KeyProvider = "windows-hello" | "google" | "apple" | "samsung" | "device";

export function devicePlatform(ua = typeof navigator === "undefined" ? "" : navigator.userAgent, touchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints): { platform: DevicePlatform; samsung: boolean } {
  const ipadOs = /Macintosh/i.test(ua) && touchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || ipadOs) return { platform: "ios", samsung: false };
  if (/Android/i.test(ua)) return { platform: "android", samsung: /SM-|Samsung/i.test(ua) };
  return { platform: "desktop", samsung: false };
}

/** Celular: biometria do aparelho. Computador: PIN de segurança do app (ver comentário no topo). */
export const defaultVerifyMode = (platform: DevicePlatform): VerifyMode => (platform === "desktop" ? "sim" : "device");

export function getVerifyMode(): VerifyMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "sim" || saved === "device") return saved;
  } catch {
    // sem armazenamento: usa o padrão do aparelho
  }
  return defaultVerifyMode(devicePlatform().platform);
}
export function setVerifyMode(mode: VerifyMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // armazenamento indisponível: vale só nesta sessão
  }
}

export async function deviceAuthAvailable(): Promise<boolean> {
  try {
    return (
      typeof window !== "undefined" &&
      window.isSecureContext &&
      "PublicKeyCredential" in window &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Identificadores públicos (AAGUID) de quem guarda chaves de acesso. */
const AAGUIDS: Record<string, KeyProvider> = {
  "08987058-cadc-51b2-a6f2-f9b0f43d6ed5": "windows-hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "windows-hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "windows-hello",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "google",
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "apple",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "apple",
  "53414d53-554e-4700-0000-000000000000": "samsung",
};

/** AAGUID dentro dos dados do autenticador (bytes 37 a 52, quando há credencial anexada). */
export function aaguidOf(authData: ArrayBuffer | Uint8Array | null | undefined): string | null {
  if (!authData) return null;
  const b = authData instanceof Uint8Array ? authData : new Uint8Array(authData);
  if (b.length < 53 || (b[32] & 0x40) === 0) return null;
  const hex = Array.from(b.slice(37, 53), (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Quem respondeu: pelo AAGUID; sem ele, uma chave sincronizada ("hybrid") no computador indica o Google. */
export function providerOf(aaguid: string | null, transports: string[], platform: DevicePlatform): KeyProvider {
  const known = aaguid ? AAGUIDS[aaguid] : undefined;
  if (known) return known;
  if (platform === "desktop" && transports.includes("hybrid")) return "google";
  return "device";
}

export const providerLabel = (p: KeyProvider): string =>
  ({ "windows-hello": "Windows Hello", google: "Gerenciador de senhas do Google", apple: "Chaves do iCloud (Face ID / Touch ID)", samsung: "Samsung Pass", device: "biometria deste aparelho" })[p];

type Stored = { id: string; provider: KeyProvider };
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Stored | null } = { raw: null, value: null };

function readKey(): Stored | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.value;
  let value: Stored | null = null;
  try {
    const s = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    if (s && typeof s.id === "string" && typeof s.provider === "string") value = { id: s.id, provider: s.provider as KeyProvider };
  } catch {
    value = null;
  }
  cached = { raw, value };
  return value;
}
function writeKey(value: Stored | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // segue sem lembrar a chave
  }
  listeners.forEach((l) => l());
}

/** Chave registrada neste aparelho (para a tela do Premium mostrar quem confirma). */
export const deviceKeyInfo = (): Stored | null => readKey();
export function subscribeDeviceKey(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Pede a biometria/PIN do aparelho. Na primeira vez registra uma chave neste aparelho; depois só confirma. */
export async function verifyWithDevice(displayName: string): Promise<"ok" | "cancelled" | "failed"> {
  const stored = readKey();
  // "client-device": pede ao navegador o autenticador do próprio aparelho (no Windows, o Windows Hello)
  const hints = ["client-device"];
  try {
    if (stored) {
      const got = await navigator.credentials.get({
        publicKey: { challenge: random(32), allowCredentials: [{ type: "public-key", id: fromB64(stored.id) }], userVerification: "required", timeout: 60_000, hints } as PublicKeyCredentialRequestOptions,
      });
      return got ? "ok" : "failed";
    }
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: "GoMob" },
        user: { id: random(16), name: "gomob", displayName },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        attestation: "none",
        timeout: 60_000,
        hints,
      } as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;
    if (!created) return "failed";
    const res = created.response as AuthenticatorAttestationResponse;
    let authData: ArrayBuffer | null = null;
    let transports: string[] = [];
    try {
      authData = res.getAuthenticatorData?.() ?? null;
      transports = res.getTransports?.() ?? [];
    } catch {
      // navegador antigo: fica como "biometria deste aparelho"
    }
    writeKey({ id: toB64(created.rawId), provider: providerOf(aaguidOf(authData), transports, devicePlatform().platform) });
    return "ok";
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    // chave antiga que o aparelho não reconhece mais: na próxima tentativa registra outra
    if (stored && name !== "NotAllowedError") writeKey(null);
    return name === "NotAllowedError" ? "cancelled" : "failed";
  }
}

/** Esquece a chave deste aparelho (a próxima verificação registra de novo). */
export function forgetDeviceKey() {
  writeKey(null);
}

// ---- PIN de segurança do app (quando não há biometria disponível, e padrão no computador) ----
const PIN_KEY = "gomob.pin.v1";
const hash = (pin: string) => {
  let h = 5381;
  for (const c of `gomob:${pin}`) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return String(h);
};
export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
}
export function savePin(pin: string) {
  try {
    localStorage.setItem(PIN_KEY, hash(pin));
  } catch {
    // sem armazenamento: o PIN vale só agora
  }
}
export function checkPin(pin: string): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === hash(pin);
  } catch {
    return false;
  }
}
export function clearPin() {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    // nada a limpar
  }
}
