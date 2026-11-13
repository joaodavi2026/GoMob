/**
 * Verificação com a biometria do próprio aparelho (WebAuthn): Face ID / Touch ID no iPhone,
 * digital ou PIN no Android, Windows Hello no computador.
 *
 * É uma demonstração: a resposta do aparelho não é conferida no servidor (não há conta real a proteger).
 * Só funciona em contexto seguro (https ou localhost); fora disso o app usa a verificação simulada.
 */
const KEY = "gomob.passkey.v1";
const MODE_KEY = "gomob.verify.mode";

export type VerifyMode = "device" | "sim";

export function getVerifyMode(): VerifyMode {
  try {
    return localStorage.getItem(MODE_KEY) === "sim" ? "sim" : "device";
  } catch {
    return "device";
  }
}
export function setVerifyMode(mode: VerifyMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // armazenamento indisponível: vale só nesta sessão
  }
}

export type DevicePlatform = "ios" | "android" | "desktop";
export function devicePlatform(): { platform: DevicePlatform; samsung: boolean } {
  if (typeof navigator === "undefined") return { platform: "desktop", samsung: false };
  const ua = navigator.userAgent;
  const ipadOs = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || ipadOs) return { platform: "ios", samsung: false };
  if (/Android/i.test(ua)) return { platform: "android", samsung: /SM-|Samsung/i.test(ua) };
  return { platform: "desktop", samsung: false };
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

/** Pede a biometria/PIN do aparelho. Na primeira vez registra uma chave neste aparelho; depois só confirma. */
export async function verifyWithDevice(displayName: string): Promise<"ok" | "cancelled" | "failed"> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    // sem armazenamento: registra de novo
  }
  try {
    if (stored) {
      const got = await navigator.credentials.get({
        publicKey: { challenge: random(32), allowCredentials: [{ type: "public-key", id: fromB64(stored) }], userVerification: "required", timeout: 60_000 },
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
      },
    })) as PublicKeyCredential | null;
    if (!created) return "failed";
    try {
      localStorage.setItem(KEY, toB64(created.rawId));
    } catch {
      // segue sem lembrar a chave
    }
    return "ok";
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    // chave antiga que o aparelho não reconhece mais: na próxima tentativa registra outra
    if (stored && name !== "NotAllowedError") {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // nada a limpar
      }
    }
    return name === "NotAllowedError" ? "cancelled" : "failed";
  }
}

/** Esquece a chave deste aparelho (a próxima verificação registra de novo). */
export function forgetDeviceKey() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a limpar
  }
}

// ---- PIN simulado (quando não há biometria disponível) ----
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
