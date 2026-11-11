import { redirect } from "next/navigation";

/** Sem login: a raiz abre direto o app do passageiro. */
export default function RootPage() {
  redirect("/home");
}
