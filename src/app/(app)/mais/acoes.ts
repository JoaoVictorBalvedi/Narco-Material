"use server";

import { executar, texto } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";

export async function criarExemplos() {
  return executar("Dados de exemplo criados.", (atorId) => sistema.exemplo.criar(atorId));
}

export async function apagarExemplos(_: EstadoAcao, dados: FormData) {
  if (texto(dados, "confirmo") !== "sim") return { erro: "Confirme para apagar." };
  return executar("Dados de exemplo apagados.", (atorId) => sistema.exemplo.apagar(atorId));
}

export type AssinaturaPush = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function salvarAssinaturaPush(assinatura: AssinaturaPush) {
  const ator = await atorAtual();
  await sistema.notificacoes.assinar(ator.id, assinatura);
}

export async function removerAssinaturaPush(endpoint: string) {
  const ator = await atorAtual();
  await sistema.notificacoes.cancelar(ator.id, endpoint);
}
