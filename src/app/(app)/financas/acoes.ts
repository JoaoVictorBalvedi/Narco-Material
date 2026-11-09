"use server";

import { redirect } from "next/navigation";
import { arquivo, centavos, executar, lista, marcado, texto } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { sistema } from "@/lib/sistema";

const fin = sistema.financas;

export async function lancar(_: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const estado = await executar("", async (atorId) =>
    fin.lancar(atorId, {
      tipo: texto(dados, "tipo") === "entrada" ? "entrada" : "saida",
      data: texto(dados, "data"),
      descricao: texto(dados, "descricao"),
      valorCentavos: centavos(dados, "valor") ?? 0,
      quemFez: texto(dados, "quemFez"),
      pagoPor: texto(dados, "pagoPor"),
      reembolsoPendente: marcado(dados, "reembolso"),
      itemIds: lista(dados, "itens"),
      comprovante: await arquivo(dados, "comprovante"),
    }),
  );
  if (!estado.erro) redirect("/financas");
  return estado;
}

export async function marcarReembolsado(_: EstadoAcao, dados: FormData) {
  return executar("Reembolso registrado.", (atorId) => fin.marcarReembolsado(atorId, texto(dados, "id")));
}

export async function removerLancamento(_: EstadoAcao, dados: FormData) {
  return executar("Lançamento removido.", (atorId) => fin.remover(atorId, texto(dados, "id")));
}
