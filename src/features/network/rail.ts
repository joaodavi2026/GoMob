/** Número e nome popular das linhas de metrô e trem de São Paulo (o GTFS traz só "METRÔ L1", "CPTM L09"...). */
export type RailInfo = { number: string; name: string; operator: "Metrô" | "CPTM" };

const RAIL: Record<string, RailInfo> = {
  "METRÔ L1": { number: "1", name: "Azul", operator: "Metrô" },
  "METRÔ L2": { number: "2", name: "Verde", operator: "Metrô" },
  "METRÔ L3": { number: "3", name: "Vermelha", operator: "Metrô" },
  "METRÔ L4": { number: "4", name: "Amarela", operator: "Metrô" },
  "METRÔ L5": { number: "5", name: "Lilás", operator: "Metrô" },
  "METRÔ L6": { number: "6", name: "Laranja", operator: "Metrô" },
  "METRÔ 15": { number: "15", name: "Prata", operator: "Metrô" },
  "METRÔ17A": { number: "17", name: "Ouro (Aeroporto)", operator: "Metrô" },
  "METRÔ17W": { number: "17", name: "Ouro (Washington Luís)", operator: "Metrô" },
  "CPTM L07": { number: "7", name: "Rubi", operator: "CPTM" },
  "CPTM L08": { number: "8", name: "Diamante", operator: "CPTM" },
  "CPTM L09": { number: "9", name: "Esmeralda", operator: "CPTM" },
  "CPTM L10": { number: "10", name: "Turquesa", operator: "CPTM" },
  "CPTM L11": { number: "11", name: "Coral", operator: "CPTM" },
  "CPTM L12": { number: "12", name: "Safira", operator: "CPTM" },
  "CPTM L13": { number: "13", name: "Jade", operator: "CPTM" },
};

export const railInfo = (code: string): RailInfo | null => RAIL[code] ?? null;

/** Texto escuro ou claro sobre a cor da linha (a Amarela e a Prata pedem texto escuro). */
export function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#12151b" : "#ffffff";
}

/** "Terminal Lapa - Praça Ramos" em vez de "TERM. LAPA - PRAÇA RAMOS". */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/(.])([a-zà-ú])/g, (_, p, c: string) => p + c.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase())
    .replace(/(^|\s)(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Xv|Xxiii)(?=$|[\s,.)\-/])/g, (_, p: string, w: string) => p + w.toUpperCase());
}
