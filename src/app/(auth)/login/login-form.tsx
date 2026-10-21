"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormError = { kind: "credentials" | "network" | "server"; message: string } | null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<FormError>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const emailError = !touched ? undefined : !email.trim() ? "Enter your email." : !EMAIL_RE.test(email.trim()) ? "Enter a valid email address." : undefined;
  const passError = !touched ? undefined : !password ? "Enter your password." : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    const emailBad = !email.trim() || !EMAIL_RE.test(email.trim());
    if (emailBad) return emailRef.current?.focus();
    if (!password) return passRef.current?.focus();

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; data: { redirectTo?: string } }
        | { ok: false; error: { message: string } }
        | null;
      if (res.ok && body?.ok) {
        setSuccess(true);
        router.replace(body.data.redirectTo || "/home");
        router.refresh();
        return;
      }
      if (res.status === 401 || res.status === 400) {
        // Same message for unknown account and wrong password: never reveal which accounts exist.
        setFormError({ kind: "credentials", message: "Incorrect email or password." });
      } else if (res.status === 429) {
        setFormError({ kind: "server", message: "Too many attempts. Please wait a moment and try again." });
      } else {
        setFormError({ kind: "server", message: "We could not sign you in right now. Please try again shortly." });
      }
    } catch {
      setFormError({ kind: "network", message: "Connection problem. Check your internet and try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby={formError ? "login-error" : undefined}>
      {formError && (
        <div id="login-error" role="alert" className="flex items-start gap-2 rounded-xl border border-risk-high/25 bg-risk-high/5 p-3 text-sm text-risk-high">
          {formError.kind === "network" ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          <span>{formError.message}</span>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-risk-low/25 bg-risk-low/5 p-3 text-sm text-risk-low">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Signed in. Redirecting...
        </div>
      )}

      <Input
        ref={emailRef}
        label="Email"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailError}
        leading={<Mail className="h-4 w-4" aria-hidden />}
        disabled={loading}
      />
      <Input
        ref={passRef}
        label="Password"
        type={show ? "text" : "password"}
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passError}
        leading={<Lock className="h-4 w-4" aria-hidden />}
        disabled={loading}
        trailing={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="rounded-md p-1.5 text-muted hover:text-ink"
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        }
      />

      <Button type="submit" size="lg" className="w-full" loading={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
