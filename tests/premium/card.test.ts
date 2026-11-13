import { describe, expect, it } from "vitest";
import { detectBrand, expError, formatExp, formatNumber, luhn, maskCard, validateCard } from "@/features/premium/card";

// números de teste públicos (documentação de operadoras de pagamento), nunca cartões reais
const VISA = "4242424242424242";
const MASTER = "5555555555554444";
const AMEX = "378282246310005";

describe("cartão: bandeira e dígito verificador", () => {
  it("reconhece a bandeira pelo início do número", () => {
    expect(detectBrand(VISA)).toBe("Visa");
    expect(detectBrand(MASTER)).toBe("Mastercard");
    expect(detectBrand("2221 0000 0000 0009")).toBe("Mastercard");
    expect(detectBrand(AMEX)).toBe("American Express");
    expect(detectBrand("6362 9700 0045 7013")).toBe("Elo");
    expect(detectBrand("9999")).toBe("Cartão");
  });
  it("valida pelo algoritmo de Luhn", () => {
    expect(luhn(VISA)).toBe(true);
    expect(luhn("5555 5555 5555 4444")).toBe(true);
    expect(luhn("5555555555554445")).toBe(false);
    expect(luhn("1234")).toBe(false);
  });
});

describe("cartão: formatação", () => {
  it("agrupa o número de 4 em 4 (Amex 4-6-5)", () => {
    expect(formatNumber("5555555555554444")).toBe("5555 5555 5555 4444");
    expect(formatNumber(AMEX)).toBe("3782 822463 10005");
    expect(formatNumber("55a55 5")).toBe("5555 5");
  });
  it("aceita validade digitada de vários jeitos, inclusive data completa", () => {
    expect(formatExp("0328")).toBe("03/28");
    expect(formatExp("03/28")).toBe("03/28");
    expect(formatExp("13/03/2028")).toBe("03/28");
    expect(formatExp("0")).toBe("0");
  });
});

describe("cartão: validação do formulário", () => {
  const now = new Date(2026, 10, 12);
  it("validade: formato, mês e vencimento", () => {
    expect(expError("03/28", now)).toBeNull();
    expect(expError("11/26", now)).toBeNull(); // vale até o fim do mês
    expect(expError("10/26", now)).toMatch(/vencido/);
    expect(expError("13/28", now)).toMatch(/mês/);
    expect(expError("3/28", now)).toMatch(/MM\/AA/);
  });
  it("aponta cada campo com problema", () => {
    expect(validateCard({ number: MASTER, exp: "03/28", cvv: "123", holder: "JOAO TESTE" }, now)).toEqual({});
    const e = validateCard({ number: "5555 5555 5555 4445", exp: "01/20", cvv: "12", holder: "J" }, now);
    expect(Object.keys(e).sort()).toEqual(["cvv", "exp", "holder", "number"]);
    expect(validateCard({ number: AMEX, exp: "03/28", cvv: "123", holder: "JOAO TESTE" }, now).cvv).toMatch(/4 dígitos/);
  });
  it("só os dados mascarados saem do formulário (sem número completo nem CVV)", () => {
    const masked = maskCard({ number: "5555 5555 5555 4444", exp: "03/28", cvv: "123", holder: " joão teste " });
    expect(masked).toEqual({ brand: "Mastercard", last4: "4444", exp: "03/28", holder: "JOÃO TESTE" });
    expect(JSON.stringify(masked)).not.toContain("5555");
    expect(JSON.stringify(masked)).not.toContain("123");
  });
});
