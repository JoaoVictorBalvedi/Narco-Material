// Service worker mínimo: não guarda cache, para ninguém ver dados desatualizados.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  const dados = evento.data ? evento.data.json() : {};
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "Narcóticos Material", {
      body: dados.corpo,
      icon: "/icones/icone-192.png",
      badge: "/icones/icone-192.png",
      data: { link: dados.link || "/avisos" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const link = evento.notification.data?.link || "/avisos";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas[0];
      if (aberta) return aberta.focus().then((janela) => janela.navigate(link));
      return self.clients.openWindow(link);
    }),
  );
});
