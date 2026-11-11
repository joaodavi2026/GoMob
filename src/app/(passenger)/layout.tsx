import { PassengerShell } from "@/components/layout/passenger-shell";

/** Acesso aberto (sem login) para a apresentação. */
export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  return <PassengerShell>{children}</PassengerShell>;
}
