"use client";

import { useEffect, useState } from "react";
import { removerAssinaturaPush, salvarAssinaturaPush, type AssinaturaPush } from "@/app/(app)/mais/acoes";

type Situacao = "carregando" | "sem_suporte" | "bloqueada" | "desligada" | "ligada";

function chaveEmBytes(chave: string) {
  const base64 = (chave + "=".repeat((4 - (chave.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function AtivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function verificar(): Promise<Situacao> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "sem_suporte";
      if (Notification.permission === "denied") return "bloqueada";
      const registro = await navigator.serviceWorker.ready;
      return (await registro.pushManager.getSubscription()) ? "ligada" : "desligada";
    }
    verificar().then(setSituacao).catch(() => setSituacao("sem_suporte"));
  }, []);

  async function ligar() {
    setErro("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setSituacao(permissao === "denied" ? "bloqueada" : "desligada");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(chavePublica),
      });
      await salvarAssinaturaPush(assinatura.toJSON() as AssinaturaPush);
      setSituacao("ligada");
    } catch {
      setErro("Não foi possível ligar as notificações neste aparelho.");
    }
  }

  async function desligar() {
    setErro("");
    try {
      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.getSubscription();
      if (assinatura) {
        await removerAssinaturaPush(assinatura.endpoint);
        await assinatura.unsubscribe();
      }
      setSituacao("desligada");
    } catch {
      setErro("Não foi possível desligar as notificações.");
    }
  }

  if (situacao === "carregando") return null;

  return (
    <section className="cartao mb-4">
      <h2 className="mb-1 font-semibold">Notificações no celular</h2>
      {situacao === "sem_suporte" && <p className="text-sm text-suave">Neste aparelho, instale o app para receber notificações. Os avisos continuam aparecendo no sino.</p>}
      {situacao === "bloqueada" && <p className="text-sm text-suave">As notificações estão bloqueadas nos ajustes do aparelho. Os avisos continuam aparecendo no sino.</p>}
      {situacao === "desligada" && (
        <>
          <p className="mb-2 text-sm text-suave">Receba pedidos, prazos e a sua vez na fila mesmo com o app fechado.</p>
          <button type="button" onClick={ligar} className="botao w-full">Ligar notificações</button>
        </>
      )}
      {situacao === "ligada" && (
        <>
          <p className="mb-2 text-sm text-sucesso">Ligadas neste aparelho.</p>
          <button type="button" onClick={desligar} className="botao-secundario w-full">Desligar</button>
        </>
      )}
      {erro && <p role="alert" className="mt-2 text-sm font-medium text-marca">{erro}</p>}
    </section>
  );
}
