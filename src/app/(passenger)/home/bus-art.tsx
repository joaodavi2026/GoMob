/** Ilustração vetorial de ônibus urbano GoMob (sem imagens externas). */
export function BusArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 130" className={className} aria-hidden>
      <defs>
        <linearGradient id="ba-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a33" />
          <stop offset="0.55" stopColor="#ff6b00" />
          <stop offset="1" stopColor="#d65800" />
        </linearGradient>
        <linearGradient id="ba-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b3140" />
          <stop offset="1" stopColor="#0d0f14" />
        </linearGradient>
        <linearGradient id="ba-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ba-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="132" cy="118" rx="122" ry="9" fill="url(#ba-shadow)" />
      {/* carroceria */}
      <path d="M18 30 Q18 14 34 14 H226 Q248 14 250 36 L254 92 Q255 104 243 104 H24 Q14 104 14 94 Z" fill="url(#ba-body)" />
      {/* teto */}
      <rect x="40" y="8" width="150" height="9" rx="4.5" fill="#cc5200" />
      {/* faixa de janelas */}
      <path d="M26 26 H232 Q242 26 243 36 L245 62 H26 Z" fill="url(#ba-glass)" />
      <g stroke="#ff6b00" strokeWidth="4">
        <line x1="70" y1="26" x2="70" y2="62" />
        <line x1="112" y1="26" x2="112" y2="62" />
        <line x1="154" y1="26" x2="154" y2="62" />
        <line x1="196" y1="26" x2="196" y2="62" />
      </g>
      <path d="M30 30 H120 L100 58 H30 Z" fill="url(#ba-shine)" opacity="0.5" />
      {/* letreiro */}
      <rect x="206" y="17" width="34" height="7" rx="2" fill="#12151b" />
      <rect x="209" y="19" width="22" height="3" rx="1.5" fill="#ffd166" />
      {/* porta */}
      <rect x="200" y="66" width="30" height="34" rx="4" fill="#12151b" opacity="0.85" />
      <line x1="215" y1="68" x2="215" y2="98" stroke="#ff8a33" strokeWidth="1.5" />
      {/* faixa lateral */}
      <rect x="18" y="72" width="176" height="5" rx="2.5" fill="#fff" opacity="0.9" />
      <rect x="18" y="80" width="120" height="3" rx="1.5" fill="#fff" opacity="0.45" />
      {/* farol */}
      <rect x="240" y="80" width="12" height="9" rx="3" fill="#fff7d6" />
      <rect x="15" y="82" width="6" height="8" rx="2" fill="#ff3b30" />
      {/* rodas */}
      {[62, 196].map((x) => (
        <g key={x}>
          <circle cx={x} cy="104" r="17" fill="#0d0f14" />
          <circle cx={x} cy="104" r="9" fill="#3a404d" />
          <circle cx={x} cy="104" r="3.5" fill="#9aa3b2" />
        </g>
      ))}
    </svg>
  );
}
