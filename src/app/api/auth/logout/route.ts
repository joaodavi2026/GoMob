import { handle, ok } from "@/lib/api";
import { clearSessionCookie } from "@/server/auth/session";

export const POST = handle(async () => {
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
