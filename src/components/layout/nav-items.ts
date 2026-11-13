import { Accessibility, Compass, Crown, Heart, History, Home, Radio, Route, User, Users, Waypoints, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

/** `mobile`: aparece na cápsula inferior (Início · Linhas · Atividade · Família · Salvos). Rotas abre pela Início; o mapa da rede e o mapa ao vivo, pela tela Linhas; perfil e Premium ficam no avatar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Início", icon: Home, mobile: true },
  { href: "/lines", label: "Linhas", icon: Waypoints, mobile: true },
  { href: "/network", label: "Explorar", icon: Compass, mobile: false },
  { href: "/routes", label: "Rotas", icon: Route, mobile: false },
  { href: "/map", label: "Mapa", icon: Radio, mobile: false },
  { href: "/activity", label: "Atividade", icon: History, mobile: true },
  { href: "/family", label: "Família", icon: Users, mobile: true },
  { href: "/favorites", label: "Salvos", icon: Heart, mobile: true },
  { href: "/premium", label: "Planos", icon: Crown, mobile: false },
  { href: "/accessibility", label: "Acessibilidade", icon: Accessibility, mobile: false },
  { href: "/profile", label: "Perfil", icon: User, mobile: false },
];

/** Telas que desenham o próprio cabeçalho no mobile. */
export const FULL_BLEED_MOBILE = ["/home", "/network"];
