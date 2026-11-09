import "server-only";
import { cache } from "react";
import { pode, type Ator } from "@/sistema/permissoes";
import { sistema } from "./sistema";

/** Lidos uma vez por requisição, mesmo usados no menu e na página. */
export const meusEmprestimos = cache((atorId: string) => sistema.emprestimos.meus(atorId));
export const painelDiretoria = cache((atorId: string) => sistema.emprestimos.painel(atorId));

/** O que espera uma ação da pessoa. Mostrado no menu e no início. */
export async function contarPendencias(ator: Ator) {
  const [meus, painel] = await Promise.all([
    pode(ator, "pedir_emprestimo") ? meusEmprestimos(ator.id) : null,
    painelDiretoria(ator.id),
  ]);
  const minhas = meus
    ? meus.ativos.filter(
        (e) =>
          (e.situacao === "retirado" && e.atrasado) ||
          (e.situacao === "aprovado" && (!e.emFila || (e.filaSituacao === "vez" && e.vezExpiraEm))),
      ).length + meus.repasses.filter((r) => r.paraId === ator.id && r.situacao !== "aguardando_aprovacao").length
    : 0;
  const diretoria = painel
    ? painel.pendentes.length + painel.renovacoes.length + painel.repasses.length + painel.conferir.length
    : 0;
  return { minhas, diretoria, total: minhas + diretoria };
}
