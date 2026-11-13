/**
 * "Trajeto em segundo plano" (Premium): mantém a tela ligada durante a viagem e manda os avisos
 * como notificação do sistema quando a pessoa sai do app. É o que um app web consegue fazer:
 * com a tela bloqueada ou o navegador fechado, o sistema pode pausar a página.
 */
export type NotifyState = "granted" | "denied" | "default" | "unsupported";

type Sentinel = { release: () => Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

/** Pede para a tela não apagar. Devolve null quando o navegador não oferece o recurso. */
export async function keepScreenOn(): Promise<Sentinel | null> {
  try {
    return (await (navigator as WakeLockNav).wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}

export function notifyState(): NotifyState {
  return typeof window !== "undefined" && "Notification" in window ? (Notification.permission as NotifyState) : "unsupported";
}

export async function askNotifyPermission(): Promise<NotifyState> {
  if (notifyState() === "unsupported") return "unsupported";
  try {
    registerWorker();
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    return notifyState();
  }
}

/** O Android só mostra notificações de páginas pelo service worker. */
export function registerWorker() {
  try {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch {
    // sem service worker neste navegador
  }
}

export async function systemNotify(title: string, body: string) {
  if (notifyState() !== "granted") return;
  const options = { body, tag: "gomob-trajeto", renotify: true, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", lang: "pt-BR" } as NotificationOptions;
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return void (await reg.showNotification(title, options));
  } catch {
    // tenta a notificação direta abaixo
  }
  try {
    new Notification(title, options);
  } catch {
    // sem notificação neste aparelho
  }
}
