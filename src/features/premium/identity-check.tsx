"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Delete, Fingerprint, ScanFace, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkPin, clearPin, deviceAuthAvailable, devicePlatform, getVerifyMode, hasPin, savePin, verifyWithDevice, type DevicePlatform } from "./webauthn";

type Variant = "device" | "faceid" | "pin";
type Stage = "idle" | "working" | "success";

/**
 * Confirmação de identidade antes de assinar ou cancelar o plano, como nos apps de pagamento:
 *  - biometria real do aparelho (Face ID, digital/PIN do Android, Windows Hello) quando o navegador permite;
 *  - senão, uma simulação: Face ID no iPhone, teclado de PIN no Samsung/Android e no computador.
 */
export function IdentityCheck({
  open,
  reason,
  userName,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  /** O que está sendo confirmado, ex.: "Assinar GoMob Premium · R$ 9,90/mês". */
  reason: string;
  userName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [info, setInfo] = useState<{ platform: DevicePlatform; samsung: boolean }>({ platform: "desktop", samsung: false });
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onSuccess);
  const cancel = useRef(onCancel);
  useEffect(() => {
    done.current = onSuccess;
    cancel.current = onCancel;
  });

  // escolhe o jeito de verificar ao abrir
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const p = devicePlatform();
    const sim: Variant = p.platform === "ios" ? "faceid" : "pin";
    (async () => {
      const real = getVerifyMode() === "device" && (await deviceAuthAvailable());
      if (!alive) return;
      setInfo(p);
      setStage("idle");
      setError(null);
      setVariant(real ? "device" : sim);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const fired = useRef(false);
  useEffect(() => {
    if (open) fired.current = false;
  }, [open]);
  const succeed = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setStage("success");
    setError(null);
    setTimeout(() => done.current(), 900);
  }, []);

  // Esc cancela; trava a rolagem da página
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || !variant || typeof document === "undefined") return null;

  const simVariant: Variant = info.platform === "ios" ? "faceid" : "pin";
  const deviceLabel = info.platform === "ios" ? "Face ID" : info.platform === "android" ? "biometria ou PIN do aparelho" : "Windows Hello ou senha do aparelho";

  const runDevice = async () => {
    setStage("working");
    setError(null);
    const r = await verifyWithDevice(userName);
    if (r === "ok") return succeed();
    setStage("idle");
    setError(r === "cancelled" ? "Verificação cancelada ou não reconhecida. Tente de novo." : "Não foi possível usar a biometria deste aparelho.");
  };

  const runFaceId = () => {
    setStage("working");
    setError(null);
    setTimeout(succeed, 1700);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="idc-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => stage !== "success" && onCancel()} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-[32px] bg-night px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 text-white shadow-float sm:rounded-[32px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Confirmação de segurança</p>
            <h2 id="idc-title" className="mt-1 break-words text-lg font-extrabold leading-snug">
              {reason}
            </h2>
          </div>
          <button type="button" onClick={onCancel} disabled={stage === "success"} aria-label="Cancelar verificação" className="tap -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {stage === "success" ? (
          <div className="flex flex-col items-center py-8" role="status">
            <span className="idc-pop flex h-20 w-20 items-center justify-center rounded-full bg-risk-low">
              <Check className="h-10 w-10" strokeWidth={3} aria-hidden />
            </span>
            <p className="mt-4 text-base font-bold">Identidade confirmada</p>
          </div>
        ) : variant === "pin" ? (
          <PinPad samsung={info.samsung} platform={info.platform} onOk={succeed} />
        ) : (
          <div className="flex flex-col items-center pt-6">
            <span className={cn("relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/10", stage === "working" && "idc-scan")}>
              {variant === "faceid" || info.platform === "ios" ? (
                <ScanFace className="h-14 w-14 text-primary" aria-hidden />
              ) : info.platform === "android" ? (
                <Fingerprint className="h-14 w-14 text-primary" aria-hidden />
              ) : (
                <ShieldCheck className="h-14 w-14 text-primary" aria-hidden />
              )}
            </span>
            <p className="mt-4 text-center text-sm text-white/80" role="status" aria-live="polite">
              {stage === "working"
                ? variant === "faceid"
                  ? "Olhe para o celular… lendo o rosto."
                  : "Aguardando a confirmação no aparelho…"
                : variant === "faceid"
                  ? "Confirme com o Face ID para continuar."
                  : `Confirme com ${deviceLabel} para continuar.`}
            </p>
            {error && (
              <p role="alert" className="mt-3 rounded-2xl bg-risk-high/20 px-3 py-2 text-center text-sm font-semibold text-white">
                {error}
              </p>
            )}
            <button
              type="button"
              autoFocus
              disabled={stage === "working"}
              onClick={variant === "device" ? runDevice : runFaceId}
              className="tap mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white disabled:opacity-60"
            >
              {variant === "faceid" || info.platform === "ios" ? <ScanFace className="h-5 w-5" aria-hidden /> : <Fingerprint className="h-5 w-5" aria-hidden />}
              {variant === "faceid" ? "Confirmar com Face ID" : info.platform === "ios" ? "Confirmar com Face ID" : info.platform === "android" ? "Confirmar com biometria ou PIN" : "Confirmar com o aparelho"}
            </button>
            {variant === "device" && (
              <button type="button" onClick={() => (setError(null), setVariant(simVariant))} className="mt-2 h-11 text-sm font-semibold text-white/70 underline underline-offset-4">
                Verificar de outro jeito
              </button>
            )}
            {variant === "faceid" && <p className="mt-3 text-center text-xs text-white/50">Simulação do Face ID para a demonstração.</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Teclado de PIN (simulação do PIN do aparelho). Na primeira vez a pessoa cria o PIN; depois só digita. */
function PinPad({ samsung, platform, onOk }: { samsung: boolean; platform: DevicePlatform; onOk: () => void }) {
  const [mode, setMode] = useState<"enter" | "create" | "repeat">(() => (hasPin() ? "enter" : "create"));
  const [first, setFirst] = useState("");
  const [pin, setPinState] = useState("");
  const pinRef = useRef("");
  const setPin = (v: string) => {
    pinRef.current = v;
    setPinState(v);
  };
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const state = useRef({ mode, first });
  useEffect(() => {
    state.current = { mode, first };
  });

  const fail = useCallback((msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      pinRef.current = "";
      setPinState("");
    }, 450);
  }, []);

  const submit = useCallback(
    (value: string) => {
      const { mode: m, first: f } = state.current;
      if (m === "enter") return checkPin(value) ? onOk() : fail("PIN incorreto. Tente de novo.");
      if (m === "create") {
        setFirst(value);
        setMode("repeat");
        setPin("");
        setError(null);
        return;
      }
      if (value !== f) {
        setMode("create");
        setFirst("");
        return fail("Os PINs não são iguais. Crie de novo.");
      }
      savePin(value);
      onOk();
    },
    [onOk, fail],
  );

  const press = useCallback(
    (d: string) => {
      if (pinRef.current.length >= 4) return;
      const next = pinRef.current + d;
      pinRef.current = next;
      setPinState(next);
      setError(null);
      if (next.length === 4) setTimeout(() => submit(next), 160);
    },
    [submit],
  );
  const erase = useCallback(() => {
    pinRef.current = pinRef.current.slice(0, -1);
    setPinState(pinRef.current);
  }, []);

  // teclado físico também funciona
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [press, erase]);

  const where = samsung ? "PIN do Samsung" : platform === "android" ? "PIN do aparelho" : "PIN de segurança";
  const title = mode === "enter" ? `Digite seu ${where}` : mode === "create" ? "Crie um PIN de 4 dígitos" : "Repita o PIN para confirmar";

  return (
    <div className="pt-5">
      <p className="text-center text-base font-bold" aria-live="polite">
        {title}
      </p>
      <p className="mt-1 text-center text-xs text-white/50">Simulação do {where} para a demonstração.</p>
      <div className={cn("mt-4 flex justify-center gap-4", shake && "idc-shake")} role="img" aria-label={`${pin.length} de 4 dígitos digitados`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-4 w-4 rounded-full border-2 border-white/60", i < pin.length && "border-primary bg-primary")} />
        ))}
      </div>
      <p role="alert" className="mt-2 min-h-5 text-center text-sm font-semibold text-[#ff9c8f]">
        {error}
      </p>
      <div className="mx-auto mt-2 grid max-w-[280px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="tap flex h-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">
            {d}
          </button>
        ))}
        {mode === "enter" ? (
          <button
            type="button"
            onClick={() => {
              clearPin();
              setMode("create");
              setPin("");
              setError(null);
            }}
            className="flex h-16 items-center justify-center rounded-full text-xs font-semibold text-white/70 underline underline-offset-4"
          >
            Esqueci
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press("0")} className="tap flex h-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">
          0
        </button>
        <button type="button" onClick={erase} aria-label="Apagar último dígito" className="tap flex h-16 items-center justify-center rounded-full text-white/80">
          <Delete className="h-7 w-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}
