import { describe, expect, it } from "vitest";
import { aaguidOf, defaultVerifyMode, devicePlatform, providerLabel, providerOf } from "@/features/premium/webauthn";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
};

/** Dados do autenticador com credencial anexada: 32 bytes de hash, flags, contador e o AAGUID. */
function authData(aaguid: string, attested = true): Uint8Array {
  const b = new Uint8Array(60);
  b[32] = attested ? 0x45 : 0x05;
  const hex = aaguid.replace(/-/g, "");
  for (let i = 0; i < 16; i++) b[37 + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

describe("confirmação de segurança: aparelho e padrão", () => {
  it("reconhece o tipo de aparelho", () => {
    expect(devicePlatform(UA.iphone, 5)).toEqual({ platform: "ios", samsung: false });
    expect(devicePlatform(UA.samsung, 5)).toEqual({ platform: "android", samsung: true });
    expect(devicePlatform(UA.windows, 0)).toEqual({ platform: "desktop", samsung: false });
    expect(devicePlatform(UA.mac, 0).platform).toBe("desktop");
    expect(devicePlatform(UA.mac, 5).platform).toBe("ios"); // iPad se apresenta como Mac
  });
  it("celular usa a biometria; computador usa o PIN do app (nunca cai no Google por padrão)", () => {
    expect(defaultVerifyMode("ios")).toBe("device");
    expect(defaultVerifyMode("android")).toBe("device");
    expect(defaultVerifyMode("desktop")).toBe("sim");
  });
});

describe("quem respondeu à confirmação", () => {
  const HELLO = "9ddd1817-af5a-4672-a2b9-3e3dd95000a9";
  const GOOGLE = "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4";

  it("lê o AAGUID dos dados do autenticador", () => {
    expect(aaguidOf(authData(HELLO))).toBe(HELLO);
    expect(aaguidOf(authData(GOOGLE).buffer as ArrayBuffer)).toBe(GOOGLE);
    expect(aaguidOf(authData(HELLO, false))).toBeNull(); // sem credencial anexada
    expect(aaguidOf(new Uint8Array(10))).toBeNull();
    expect(aaguidOf(null)).toBeNull();
  });
  it("distingue Windows Hello do Gerenciador de senhas do Google", () => {
    expect(providerOf(HELLO, ["internal"], "desktop")).toBe("windows-hello");
    expect(providerOf(GOOGLE, ["internal", "hybrid"], "desktop")).toBe("google");
    expect(providerLabel("windows-hello")).toBe("Windows Hello");
    expect(providerLabel("google")).toMatch(/Google/);
  });
  it("sem AAGUID conhecido: chave sincronizada no computador indica o Google; no celular é o próprio aparelho", () => {
    const unknown = "00000000-0000-0000-0000-000000000000";
    expect(providerOf(unknown, ["internal", "hybrid"], "desktop")).toBe("google");
    expect(providerOf(null, ["internal"], "desktop")).toBe("device");
    expect(providerOf(unknown, ["internal", "hybrid"], "android")).toBe("device");
  });
});
