"use client";

import { useSyncExternalStore } from "react";
import { instalacao } from "./registrar-pwa";

type Situacao = "carregando" | "instalado" | "ios" | "convite" | "manual";

function assinar(aviso: () => void) {
  window.addEventListener("pwa-instalavel", aviso);
  return () => window.removeEventListener("pwa-instalavel", aviso);
}

function situacaoAtual(): Situacao {
  if (window.matchMedia("(display-mode: standalone)").matches) return "instalado";
  const ehIos =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ehIos) return "ios";
  return instalacao.evento ? "convite" : "manual";
}

export function InstalarApp() {
  const situacao = useSyncExternalStore<Situacao>(assinar, situacaoAtual, () => "carregando");

  if (situacao === "carregando") return null;
  if (situacao === "instalado") {
    return <p className="cartao text-sm">O app já está instalado neste aparelho.</p>;
  }
  if (situacao === "convite") {
    return (
      <button type="button" className="botao w-full" onClick={() => instalacao.evento?.prompt()}>
        Instalar o app
      </button>
    );
  }

  const passos =
    situacao === "ios"
      ? [
          "Abra este link no Safari.",
          "Toque no botão Compartilhar, o quadrado com a seta para cima.",
          "Escolha “Adicionar à Tela de Início”.",
          "Toque em “Adicionar” e abra o app pelo novo ícone.",
        ]
      : [
          "Abra o menu do navegador, nos três pontos.",
          "Escolha “Instalar app” ou “Adicionar à tela inicial”.",
          "Confirme e abra o app pelo novo ícone.",
        ];
  return (
    <div className="cartao">
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {passos.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      {situacao === "ios" && (
        <p className="mt-3 text-sm text-suave">
          No iPhone, as notificações só funcionam depois de adicionar o app à Tela de Início.
        </p>
      )}
    </div>
  );
}
