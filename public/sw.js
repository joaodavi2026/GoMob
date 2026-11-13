// GoMob: service worker mínimo, só para os avisos do trajeto em segundo plano (Premium).
// Não guarda nada em cache nem intercepta requisições.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// tocar no aviso volta para o app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      return open ? open.focus() : self.clients.openWindow("/routes");
    }),
  );
});
