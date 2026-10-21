import { Heart, Home, Map as MapIcon, Route, User, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
];
