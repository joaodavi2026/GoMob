import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo oficial (raster em /public/branding/gomob-logo.png). `mark` usa apenas o símbolo (pin + ônibus). */
export function Logo({ variant = "full", className, priority, tone = "orange" }: { variant?: "full" | "mark"; className?: string; priority?: boolean; tone?: "orange" | "white" }) {
  if (variant === "mark") {
    return <Image src="/branding/gomob-mark.png" alt="GoMob" width={256} height={256} priority={priority} className={cn("h-9 w-9 object-contain", className)} />;
  }
  return <Image src={tone === "white" ? "/branding/gomob-logo-white.png" : "/branding/gomob-logo-transparent.png"} alt="GoMob" width={1256} height={1256} priority={priority} className={cn("h-28 w-28 object-contain", className)} />;
}
