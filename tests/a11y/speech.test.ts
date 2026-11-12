import { describe, expect, it } from "vitest";
import { pickVoice, prepareSpeech, rankVoices, splitForSpeech } from "@/features/a11y/speech";

describe("leitura em voz alta mais clara", () => {
  it("escreve abreviações e códigos de linha como se fala", () => {
    const s = prepareSpeech("Pegue a linha 875A-10, sentido Perdizes, na R. Domingos De Morais, 1725. Desça na Av. Paulista · 22 min");
    expect(s).toContain("linha 8 7 5 A");
    expect(s).not.toContain("-10");
    expect(s).toContain("Rua Domingos");
    expect(s).toContain("Avenida Paulista");
    expect(s).toContain("22 minutos");
    expect(s).not.toContain("·");
  });

  it("lê tarifa, horários e paradas no padrão da SPTrans", () => {
    expect(prepareSpeech("Tarifa R$ 5,30")).toBe("Tarifa 5 reais e 30 centavos");
    expect(prepareSpeech("Funciona 04:00–23:59")).toBe("Funciona das 4 horas às 23 e 59");
    expect(prepareSpeech("Term. Jd. Britânia B/C")).toBe("Terminal Jardim Britânia sentido bairro-centro");
    expect(prepareSpeech("Pça. Da Sé → Lgo. São Bento")).toBe("Praça Da Sé até Largo São Bento");
    expect(prepareSpeech("1 min a pé")).toBe("1 minuto a pé");
  });

  it("prefere vozes naturais em português do Brasil e respeita a escolha da pessoa", () => {
    const voices = [
      { name: "Microsoft Maria - Portuguese (Brazil)", lang: "pt-BR", localService: true },
      { name: "Joana", lang: "pt-PT", localService: true },
      { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR", localService: false },
      { name: "Google português do Brasil", lang: "pt-BR", localService: false },
      { name: "Google US English", lang: "en-US", localService: false },
    ];
    expect(rankVoices(voices)[0].name).toContain("Francisca");
    expect(rankVoices(voices).some((v) => v.lang === "en-US")).toBe(false);
    expect(rankVoices(voices).at(-1)?.lang).toBe("pt-PT");
    expect(pickVoice(voices, "Google português do Brasil")?.name).toBe("Google português do Brasil");
    expect(pickVoice(voices, "voz que não existe")?.name).toContain("Francisca");
  });

  it("fala frase por frase, quebrando frases longas nas vírgulas", () => {
    const parts = splitForSpeech("Primeira frase. Segunda frase! " + "parte, ".repeat(40) + "fim.");
    expect(parts[0]).toBe("Primeira frase.");
    expect(parts[1]).toBe("Segunda frase!");
    expect(parts.slice(2).every((p) => p.length <= 160)).toBe(true);
  });
});
