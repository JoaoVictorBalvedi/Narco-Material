"use server";

import { redirect } from "next/navigation";
import { executar, inteiro, lista, marcado, texto } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { sistema } from "@/lib/sistema";
import type { DadosEvento, Etapa, Funcao } from "@/sistema/eventos";

const ev = sistema.eventos;

const dadosEvento = (dados: FormData): DadosEvento => ({
  nome: texto(dados, "nome"),
  tipo: texto(dados, "tipo"),
  dataInicio: texto(dados, "dataInicio"),
  dataFim: texto(dados, "dataFim") || texto(dados, "dataInicio"),
  local: texto(dados, "local"),
  observacoes: texto(dados, "observacoes"),
  antecedenciaDias: inteiro(dados, "antecedenciaDias"),
  kitEmergencia: marcado(dados, "kit"),
});

export async function criarEvento(_: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  let id = "";
  const estado = await executar("", async (atorId) => {
    id = await ev.criar(atorId, dadosEvento(dados));
  });
  if (!estado.erro) redirect(`/eventos/${id}`);
  return estado;
}

export async function editarEvento(id: string, _: EstadoAcao, dados: FormData) {
  return executar("Evento salvo.", (atorId) => ev.editar(atorId, id, dadosEvento(dados)));
}

export async function removerEvento(id: string): Promise<EstadoAcao> {
  const estado = await executar("", (atorId) => ev.remover(atorId, id));
  if (!estado.erro) redirect("/eventos");
  return estado;
}

export async function adicionarItem(id: string, _: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  let conflitos = 0;
  const estado = await executar("", async (atorId) => {
    conflitos = await ev.adicionarItem(atorId, id, {
      itemId: texto(dados, "itemId"),
      quantidade: inteiro(dados, "quantidade"),
      responsavelId: texto(dados, "responsavelId") || null,
    });
  });
  if (estado.erro) return estado;
  return { sucesso: conflitos ? "Item adicionado. Há conflito com um empréstimo, e o Diretor de Material foi avisado." : "Item adicionado." };
}

export async function atualizarItem(id: string, itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Salvo.", (atorId) =>
    ev.atualizarItem(atorId, id, itemId, {
      quantidade: inteiro(dados, "quantidade"),
      responsavelId: texto(dados, "responsavelId") || null,
    }),
  );
}

export async function removerItemDoEvento(id: string, itemId: string) {
  return executar("Item removido do evento.", (atorId) => ev.removerItem(atorId, id, itemId));
}

export async function liberarReserva(id: string, itemId: string) {
  return executar("Reserva liberada.", (atorId) => ev.liberarReserva(atorId, id, itemId));
}

export async function definirResponsaveis(id: string, funcao: Funcao, _: EstadoAcao, dados: FormData) {
  return executar("Responsáveis salvos.", (atorId) => ev.definirResponsaveis(atorId, id, funcao, lista(dados, "pessoas")));
}

export async function definirEscala(id: string, itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Escala salva.", (atorId) => ev.definirEscala(atorId, id, itemId, lista(dados, "pessoas")));
}

export async function marcarChecklist(id: string, alvo: string, etapa: Etapa, marcar: boolean) {
  return executar("", (atorId) => ev.marcarChecklist(atorId, id, alvo, etapa, marcar));
}
