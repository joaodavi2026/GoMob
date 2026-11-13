/**
 * Anúncios de DEMONSTRAÇÃO. As marcas são fictícias e a arte é própria do projeto:
 * servem para mostrar como o app se comporta no plano grátis (com anúncios) e no Premium (sem).
 */
export type Creative = {
  id: string;
  brand: string;
  category: string;
  headline: string;
  text: string;
  cta: string;
  badge: string;
  /** gradiente do fundo */
  from: string;
  to: string;
  /** cor do texto do botão (sobre branco) */
  accent: string;
  Art: (p: { className?: string }) => React.ReactElement;
  Mark: (p: { className?: string }) => React.ReactElement;
};

function PetArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <ellipse cx="120" cy="222" rx="70" ry="10" fill="#000" opacity=".15" />
      {/* orelhas */}
      <path d="M52 92c-16 4-26 34-18 70 4 16 22 18 30 2 8-20 6-52-12-72z" fill="#8a5a2b" />
      <path d="M188 92c16 4 26 34 18 70-4 16-22 18-30 2-8-20-6-52 12-72z" fill="#8a5a2b" />
      {/* cabeça */}
      <path d="M120 44c44 0 74 30 74 76 0 50-30 88-74 88s-74-38-74-88c0-46 30-76 74-76z" fill="#f2c079" />
      <path d="M120 44c20 0 34 20 34 52s-14 40-34 40-34-8-34-40 14-52 34-52z" fill="#fff4e0" />
      {/* olhos */}
      <circle cx="92" cy="112" r="10" fill="#2b1d12" />
      <circle cx="148" cy="112" r="10" fill="#2b1d12" />
      <circle cx="95" cy="108" r="3.5" fill="#fff" />
      <circle cx="151" cy="108" r="3.5" fill="#fff" />
      {/* focinho */}
      <ellipse cx="120" cy="156" rx="34" ry="28" fill="#fff4e0" />
      <path d="M106 140c0-8 28-8 28 0 0 8-8 14-14 14s-14-6-14-14z" fill="#2b1d12" />
      <path d="M120 154v10m0 0c-6 10-18 8-20 0m20 0c6 10 18 8 20 0" stroke="#2b1d12" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M110 170c0 14 4 22 10 22s10-8 10-22z" fill="#ff7f8f" />
      {/* coleira */}
      <path d="M70 196c30 18 70 18 100 0l-4 14c-28 14-64 14-92 0z" fill="#ff6b00" />
      <circle cx="120" cy="214" r="9" fill="#ffd34d" />
    </svg>
  );
}

function PharmaArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <ellipse cx="120" cy="224" rx="74" ry="9" fill="#000" opacity=".15" />
      {/* frasco */}
      <rect x="62" y="34" width="84" height="26" rx="8" fill="#fff" />
      <rect x="54" y="56" width="100" height="160" rx="22" fill="#ffffff" />
      <rect x="54" y="100" width="100" height="72" fill="#e11d48" />
      <path d="M104 116v40M84 136h40" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
      <rect x="66" y="184" width="50" height="8" rx="4" fill="#f3b6c2" />
      <rect x="66" y="198" width="34" height="8" rx="4" fill="#f3b6c2" />
      {/* cápsulas */}
      <g transform="rotate(-28 186 96)">
        <rect x="156" y="80" width="60" height="30" rx="15" fill="#fff" />
        <path d="M186 80h15a15 15 0 010 30h-15z" fill="#ffd34d" />
      </g>
      <g transform="rotate(24 184 170)">
        <rect x="158" y="156" width="52" height="26" rx="13" fill="#fff" />
        <path d="M184 156h13a13 13 0 010 26h-13z" fill="#7dd3fc" />
      </g>
      <circle cx="196" cy="214" r="13" fill="#fff" />
      <path d="M187 214h18" stroke="#f3b6c2" strokeWidth="3" />
    </svg>
  );
}

function CoffeeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <ellipse cx="120" cy="224" rx="70" ry="9" fill="#000" opacity=".18" />
      {/* vapor */}
      <path d="M96 40c-12 14 10 22 0 38M122 30c-12 14 10 22 0 38M148 40c-12 14 10 22 0 38" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".75" />
      {/* tampa e copo */}
      <rect x="58" y="88" width="124" height="18" rx="9" fill="#3b2415" />
      <path d="M66 106h108l-12 104a14 14 0 01-14 12H92a14 14 0 01-14-12z" fill="#fff8ee" />
      <path d="M71 140h98l-5 44H76z" fill="#c2743a" />
      <circle cx="120" cy="162" r="15" fill="#fff8ee" />
      <path d="M112 162c0-8 16-8 16 0s-16 8-16 0z" fill="#c2743a" />
      {/* grãos */}
      <g fill="#3b2415">
        <ellipse cx="196" cy="196" rx="12" ry="8" transform="rotate(-30 196 196)" />
        <ellipse cx="42" cy="204" rx="11" ry="7" transform="rotate(24 42 204)" />
        <ellipse cx="208" cy="150" rx="9" ry="6" transform="rotate(40 208 150)" />
      </g>
    </svg>
  );
}

const mark = (d: React.ReactNode) =>
  function Mark({ className }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    );
  };

export const CREATIVES: Creative[] = [
  {
    id: "petlar",
    brand: "PetLar",
    category: "Pet shop",
    headline: "Tudo para o seu pet com 20% OFF",
    text: "Na primeira compra pelo app. Entrega no mesmo dia em São Paulo.",
    cta: "Comprar agora",
    badge: "20% OFF",
    from: "#0d9b8a",
    to: "#0a5c7d",
    accent: "#0a5c7d",
    Art: PetArt,
    Mark: mark(
      <>
        <circle cx="7" cy="9" r="1.8" />
        <circle cx="12" cy="6.5" r="1.8" />
        <circle cx="17" cy="9" r="1.8" />
        <path d="M12 12c-3 0-5 2.6-5 4.8 0 1.6 1.4 2.4 2.8 2 1.4-.4 3-.4 4.4 0 1.4.4 2.8-.4 2.8-2 0-2.2-2-4.8-5-4.8z" />
      </>,
    ),
  },
  {
    id: "farmaviva",
    brand: "Farmaviva",
    category: "Farmácia",
    headline: "Vitaminas e dermocosméticos até 40% OFF",
    text: "Peça pelo app e retire em 30 minutos na loja mais perto de você.",
    cta: "Ver ofertas",
    badge: "até 40% OFF",
    from: "#e11d48",
    to: "#9f1239",
    accent: "#9f1239",
    Art: PharmaArt,
    Mark: mark(<path d="M12 4v16M4 12h16" />),
  },
  {
    id: "cafetrilho",
    brand: "Café Trilho",
    category: "Cafeteria",
    headline: "Seu café antes do ônibus por R$ 4,90",
    text: "Peça pelo app e retire sem fila nos terminais de ônibus.",
    cta: "Pedir agora",
    badge: "R$ 4,90",
    from: "#b45f2a",
    to: "#5b2e12",
    accent: "#5b2e12",
    Art: CoffeeArt,
    Mark: mark(
      <>
        <path d="M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5z" />
        <path d="M16 10h1.5a2.5 2.5 0 010 5H16M8 3v2M12 3v2" />
      </>,
    ),
  },
];
