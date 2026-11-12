import { Accessibility, Compass, Heart, Home, Radio, Route, User, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

/** `mobile`: aparece na cápsula inferior (Início · Explorar · Mapa · Salvos). Rotas abre pela busca da Início; o perfil fica no avatar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Início", icon: Home, mobile: true },
  { href: "/network", label: "Explorar", icon: Compass, mobile: true },
  { href: "/routes", label: "Rotas", icon: Route, mobile: false },
  { href: "/map", label: "Mapa", icon: Radio, mobile: true },
  { href: "/favorites", label: "Salvos", icon: Heart, mobile: true },
  { href: "/accessibility", label: "Acessibilidade", icon: Accessibility, mobile: false },
  { href: "/profile", label: "Perfil", icon: User, mobile: false },
];

/** Telas que desenham o próprio cabeçalho no mobile. */
export const FULL_BLEED_MOBILE = ["/home", "/network"];
