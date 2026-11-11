import { Accessibility, Compass, Heart, Home, Radio, Route, User, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile: boolean };

/** `mobile`: aparece na cápsula de navegação inferior (o perfil fica no avatar). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, mobile: true },
  { href: "/network", label: "Explore", icon: Compass, mobile: true },
  { href: "/routes", label: "Routes", icon: Route, mobile: true },
  { href: "/map", label: "Live", icon: Radio, mobile: true },
  { href: "/favorites", label: "Saved", icon: Heart, mobile: true },
  { href: "/accessibility", label: "Acessibilidade", icon: Accessibility, mobile: false },
  { href: "/profile", label: "Profile", icon: User, mobile: false },
];

/** Telas que desenham o próprio cabeçalho no mobile. */
export const FULL_BLEED_MOBILE = ["/home", "/network"];
