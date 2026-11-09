"use server";

import { redirect } from "next/navigation";
import { executar, inteiro, lista, marcado, motivoDe, texto } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal, diferencaDias, somarDias } from "@/sistema/datas";
import { precisaAprovacao } from "@/sistema/emprestimos";

const emp = sistema.emprestimos;

/**
 * Pedido em um passo. Quem não precisa de aprovação pode marcar "pegar agora",
 * e o pedido e a retirada viram uma ação só.
 */
export async function pedir(destino: string | null, _: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  let mensagem = "";
  const estado = await executar("", async (atorId) => {
    const ator = await atorAtual();
    const hoje = dataLocal(new Date());
    const inicio = texto(dados, "inicio") || hoje;
    const fim = texto(dados, "fim") || somarDias(inicio, inteiro(dados, "dias") ?? 3);
    const ids = await emp.pedir(atorId, {
      itemIds: lista(dados, "itens"),
      dataRetirada: inicio,
      dataDevolucao: fim,
      motivo: motivoDe(dados),
      justificativaPrazo: texto(dados, "justificativaPrazo"),
    });
    if (precisaAprovacao(ator, diferencaDias(inicio, fim))) {
      mensagem = "Pedido enviado. Você recebe um aviso quando o Diretor de Material decidir.";
      return;
    }
    if (marcado(dados, "agora")) {
      for (const id of ids) await emp.retirar(atorId, id, true);
      mensagem = "Pronto: está com você. Devolva pela tela inicial quando terminar.";
      return;
    }
    mensagem = "Reservado. Retire pela tela inicial no dia marcado.";
  });
  if (estado.erro) return estado;
  if (destino) redirect(destino);
  return { sucesso: mensagem };
}

export async function entrarNaFila(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Você entrou na fila. Avisamos quando chegar a sua vez.", async (atorId) =>
    emp.entrarNaFila(atorId, {
      itemId,
      dias: inteiro(dados, "dias") ?? 0,
      motivo: motivoDe(dados),
      justificativaPrazo: texto(dados, "justificativaPrazo"),
    }),
  );
}

const decisao = (dados: FormData) => ({
  aprovar: texto(dados, "decisao") === "aprovar",
  justificativa: texto(dados, "justificativa"),
});

export async function decidirPedido(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Decisão registrada.", (atorId) => emp.decidir(atorId, id, decisao(dados)));
}

export async function cancelarEmprestimo(id: string) {
  return executar("Cancelado.", (atorId) => emp.cancelar(atorId, id));
}

export async function retirar(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Retirada registrada.", (atorId) => emp.retirar(atorId, id, marcado(dados, "termo")));
}

export async function devolver(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Devolução registrada. Agora falta a conferência.", (atorId) =>
    emp.devolver(atorId, id, texto(dados, "problema")),
  );
}

export async function conferir(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Conferência registrada.", (atorId) =>
    emp.conferir(atorId, id, {
      resultado: texto(dados, "resultado") === "manutencao" ? "manutencao" : "liberado",
      estado: texto(dados, "estado") || undefined,
    }),
  );
}

export async function pedirRenovacao(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Renovação pedida.", (atorId) =>
    emp.pedirRenovacao(atorId, id, { novaData: texto(dados, "novaData"), motivo: texto(dados, "motivo") }),
  );
}

export async function decidirRenovacao(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Decisão registrada.", (atorId) => emp.decidirRenovacao(atorId, id, decisao(dados)));
}

export async function proporRepasse(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Proposta enviada.", (atorId) => emp.proporRepasse(atorId, id, texto(dados, "para")));
}

export async function responderRepasse(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Resposta registrada.", (atorId) =>
    emp.responderRepasse(atorId, id, texto(dados, "resposta") === "aceitar"),
  );
}

export async function decidirRepasse(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Decisão registrada.", (atorId) => emp.decidirRepasse(atorId, id, decisao(dados)));
}

export async function concluirRepasse(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Repasse concluído. O item agora está com você.", (atorId) =>
    emp.concluirRepasse(atorId, id, {
      aceitouTermo: marcado(dados, "termo"),
      observacaoEstado: texto(dados, "observacao"),
    }),
  );
}
