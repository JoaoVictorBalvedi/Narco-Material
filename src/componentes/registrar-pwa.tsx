"use client";

import { useEffect } from "react";

export type EventoInstalacao = Event & { prompt(): Promise<void> };

export const instalacao: { evento: EventoInstalacao | null } = { evento: null };

/** Guarda o convite de instalação, que o navegador só dispara uma vez por carregamento. */
export function RegistrarPwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const guardar = (evento: Event) => {
      evento.preventDefault();
      instalacao.evento = evento as EventoInstalacao;
      window.dispatchEvent(new Event("pwa-instalavel"));
    };
    window.addEventListener("beforeinstallprompt", guardar);
    return () => window.removeEventListener("beforeinstallprompt", guardar);
  }, []);
  return null;
}
