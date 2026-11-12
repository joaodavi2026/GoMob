/**
 * Clareza da leitura em voz alta (Web Speech API):
 * 1) escolher a voz em português mais natural disponível no aparelho;
 * 2) reescrever abreviações e códigos para a forma falada ("R." -> "Rua", "875A-10" -> "8 7 5 A");
 * 3) falar frase por frase (pausas naturais e sem o corte de textos longos do Chrome).
 */

type VoiceLike = { name: string; lang: string; localService?: boolean; default?: boolean };

/** Pontuação de qualidade: vozes neurais/online e as de melhor reputação em pt-BR primeiro. */
export function voiceScore(v: VoiceLike): number {
  const lang = (v.lang || "").toLowerCase().replace("_", "-");
  if (!lang.startsWith("pt")) return -1;
  const n = v.name.toLowerCase();
  let s = lang === "pt-br" ? 100 : 40; // pt-PT soa estranho para quem é do Brasil
  if (/natural|neural|online|premium|enhanced|aprimorad|wavenet|studio/.test(n)) s += 60;
  if (/google/.test(n)) s += 45;
  if (/francisca|antonio|antônio|thalita|brenda|donato|elza|giovanna|leila|luciana|felipe/.test(n)) s += 30;
  if (/compact|espeak|e-speak/.test(n)) s -= 50;
  if (v.localService === false) s += 10; // vozes em nuvem costumam ser mais claras
  return s;
}

export function rankVoices<T extends VoiceLike>(voices: T[]): T[] {
  return voices.filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function pickVoice<T extends VoiceLike>(voices: T[], preferredName?: string | null): T | undefined {
  if (preferredName) {
    const chosen = voices.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  return rankVoices(voices)[0];
}

// abreviações comuns em nomes de paradas, linhas e endereços de São Paulo
const ABBR: [RegExp, string][] = [
  [/\bAv\./g, "Avenida"],
  [/\bR\./g, "Rua"],
  [/\bPça\./gi, "Praça"],
  [/\bPç\./gi, "Praça"],
  [/\bLgo\./gi, "Largo"],
  [/\bTerm\./gi, "Terminal"],
  [/\bEst\./gi, "Estação"],
  [/\bJd\./gi, "Jardim"],
  [/\bJ\.\s/g, "Jardim "],
  [/\bVl\./gi, "Vila"],
  [/\bV\.\s/g, "Vila "],
  [/\bPq\./gi, "Parque"],
  [/\bSto\./gi, "Santo"],
  [/\bSta\./gi, "Santa"],
  [/\bS\.\s/g, "São "],
  [/\bDr\./gi, "Doutor"],
  [/\bProf\./gi, "Professor"],
  [/\bEng\./gi, "Engenheiro"],
  [/\bGal\./gi, "General"],
  [/\bCel\./gi, "Coronel"],
  [/\bCjto?\./gi, "Conjunto"],
  [/\bConj\./gi, "Conjunto"],
  [/\bPte\./gi, "Ponte"],
  [/\bEstr\./gi, "Estrada"],
  [/\bRod\./gi, "Rodovia"],
  [/\bPl\.?\s?(\d)/g, "Plataforma $1"],
  [/\bB\/C\b/gi, "sentido bairro-centro"],
  [/\bC\/B\b/gi, "sentido centro-bairro"],
  [/\bCptm\b/gi, "CPTM"],
];

/** "875A-10" -> "8 7 5 A" (o sufixo -10/-21 é variante interna e só atrapalha ao ouvir). */
function speakLineCode(code: string): string {
  const base = code.replace(/-\d{1,2}$/, "");
  return base.replace(/([0-9A-Z])(?=[0-9A-Z])/gi, "$1 ").toUpperCase();
}

/** Reescreve o texto para a forma falada em português do Brasil. */
export function prepareSpeech(text: string): string {
  let s = text;
  // códigos de linha (ex.: 875A-10, 6000-10, N701-11) viram dígitos separados
  s = s.replace(/\b([A-Z]?\d{3,4}[A-Z]?)-(\d{1,2})\b/g, (_, a: string, b: string) => speakLineCode(`${a}-${b}`));
  for (const [re, rep] of ABBR) s = s.replace(re, rep);
  // dinheiro: "R$ 5,30" -> "5 reais e 30 centavos"
  s = s.replace(/R\$\s?(\d+),(\d{2})/g, (_, r: string, c: string) => (c === "00" ? `${r} reais` : `${r} reais e ${Number(c)} centavos`));
  // horários: "04:00–23:59" -> "das 4 às 23 e 59"; "07:30" -> "7 e 30"
  const hora = (h: string, m: string) => `${Number(h)}${m === "00" ? " horas" : ` e ${Number(m)}`}`;
  s = s.replace(/\b(\d{1,2}):(\d{2})\s?[–-]\s?(\d{1,2}):(\d{2})\b/g, (_, h1, m1, h2, m2) => `das ${hora(h1, m1)} às ${hora(h2, m2)}`);
  s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => hora(h, m));
  // unidades e símbolos
  s = s.replace(/(\d)\s?min\b/g, "$1 minutos").replace(/\b1 minutos\b/g, "1 minuto");
  s = s.replace(/(\d)\s?km\b/g, "$1 quilômetros").replace(/(\d)\s?m\b(?![a-zà-ú])/g, "$1 metros");
  s = s.replace(/\s?→\s?/g, " até ").replace(/\s?[·•|]\s?/g, ", ").replace(/\s?–\s?/g, " a ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Divide em frases curtas (pausa natural entre elas e sem limite de duração por fala). */
export function splitForSpeech(text: string, max = 160): string[] {
  const sentences = text.split(/(?<=[.!?;:])\s+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      out.push(sentence);
      continue;
    }
    // frase longa: quebra nas vírgulas
    let buf = "";
    for (const part of sentence.split(/,\s*/)) {
      if (buf && (buf + ", " + part).length > max) {
        out.push(buf);
        buf = part;
      } else buf = buf ? `${buf}, ${part}` : part;
    }
    if (buf) out.push(buf);
  }
  return out;
}
