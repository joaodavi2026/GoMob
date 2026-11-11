import { redirect } from "next/navigation";

/** Não há mais login: endereços antigos de /login vão direto para o app. */
export default function LoginRedirect() {
  redirect("/home");
}
