import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo oficial (gerado por scripts/build-brand.mjs). `full`: pin + ônibus + rota; `mark`: só o pin com o ônibus (tamanhos pequenos). */
export function Logo({ variant = "full", className, priority, tone = "orange" }: { variant?: "full" | "mark"; className?: string; priority?: boolean; tone?: "orange" | "white" }) {
  if (variant === "mark") {
    return <Image src="/branding/gomob-mark.png" alt="GoMob" width={512} height={512} priority={priority} className={cn("h-9 w-9 object-contain", className)} />;
  }
  return <Image src={tone === "white" ? "/branding/gomob-logo-white.png" : "/branding/gomob-logo-transparent.png"} alt="GoMob" width={1024} height={1024} priority={priority} className={cn("h-28 w-28 object-contain", className)} />;
}
