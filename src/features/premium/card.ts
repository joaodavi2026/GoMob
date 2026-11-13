/**
 * Validação do formulário de cartão (simulação de compra). Tudo acontece no navegador:
 * só bandeira, 4 últimos dígitos, validade e nome seguem para o servidor.
 */
export type Brand = "Mastercard" | "Visa" | "Elo" | "American Express" | "Hipercard" | "Cartão";

export const digits = (s: string) => s.replace(/\D/g, "");

const ELO = ["4011", "4312", "4389", "4514", "4576", "5041", "5066", "5090", "6277", "6362", "6363", "6504", "6505", "6516", "6550"];

export function detectBrand(number: string): Brand {
  const n = digits(number);
  if (ELO.some((p) => n.startsWith(p))) return "Elo";
  if (/^3[47]/.test(n)) return "American Express";
  if (/^606282|^3841/.test(n)) return "Hipercard";
  if (/^4/.test(n)) return "Visa";
  const two = Number(n.slice(0, 2));
  const four = Number(n.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "Mastercard";
  return "Cartão";
}

/** Dígito verificador (algoritmo de Luhn). */
export function luhn(number: string): boolean {
  const n = digits(number);
  if (n.length < 13 || n.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** 5555555555554444 -> "5555 5555 5555 4444" (Amex: 4-6-5). */
export function formatNumber(input: string): string {
  const n = digits(input).slice(0, 19);
  if (/^3[47]/.test(n)) return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  return n.replace(/(.{4})/g, "$1 ").trim();
}

/** Aceita "0328", "03/28" e também datas completas como "13/03/2028" (fica 03/28). */
export function formatExp(input: string): string {
  const full = input.match(/^\s*\d{1,2}\/(\d{1,2})\/(\d{4})\s*$/);
  if (full) return `${full[1].padStart(2, "0")}/${full[2].slice(2)}`;
  const n = digits(input).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function expError(exp: string, now = new Date()): string | null {
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return "Digite a validade no formato MM/AA.";
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return "O mês da validade vai de 01 a 12.";
  const end = new Date(year, month, 1); // primeiro dia do mês seguinte
  if (end <= now) return "Este cartão está vencido.";
  if (year > now.getFullYear() + 20) return "Confira o ano da validade.";
  return null;
}

export type CardForm = { number: string; exp: string; cvv: string; holder: string };
export type CardErrors = Partial<Record<keyof CardForm, string>>;

export function validateCard(f: CardForm, now = new Date()): CardErrors {
  const e: CardErrors = {};
  const n = digits(f.number);
  if (n.length < 13) e.number = "Digite o número completo do cartão.";
  else if (!luhn(n)) e.number = "Número de cartão inválido. Confira os dígitos.";
  const ex = expError(f.exp, now);
  if (ex) e.exp = ex;
  const cvvLen = detectBrand(n) === "American Express" ? 4 : 3;
  if (digits(f.cvv).length !== cvvLen) e.cvv = `O código de segurança tem ${cvvLen} dígitos.`;
  if (f.holder.trim().length < 3) e.holder = "Digite o nome como está no cartão.";
  return e;
}

/** O que pode sair do navegador: nada do número além dos 4 últimos dígitos, e nunca o CVV. */
export function maskCard(f: CardForm) {
  const n = digits(f.number);
  return { brand: detectBrand(n), last4: n.slice(-4), exp: f.exp, holder: f.holder.trim().toUpperCase().slice(0, 40) };
}
