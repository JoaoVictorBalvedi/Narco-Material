"use server";

import { redirect } from "next/navigation";
import { arquivo, dadosGasto, executar, inteiro, lista, texto } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { sistema } from "@/lib/sistema";
import { regraViolada } from "@/sistema/erros";
import type { Estado, TipoItem } from "@/sistema/inventario";

const inv = sistema.inventario;

export async function cadastrarItem(_: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  let salvo = "";
  const estado = await executar("", async (atorId) => {
    const foto = await arquivo(dados, "foto");
    if (!foto) throw regraViolada("Tire ou escolha uma foto.");
    const { codigo } = await inv.cadastrar(atorId, {
      tipo: texto(dados, "tipo") as TipoItem,
      categoriaId: texto(dados, "categoriaId"),
      nome: texto(dados, "nome"),
      estado: texto(dados, "estado") as Estado,
      foto,
      codigo: texto(dados, "codigo") || undefined,
      variacao: texto(dados, "variacao") || undefined,
      descricao: texto(dados, "descricao") || undefined,
      localizacao: texto(dados, "localizacao") || undefined,
      quantidade: inteiro(dados, "quantidade"),
      quantidadeMinima: inteiro(dados, "quantidadeMinima"),
    });
    salvo = `${texto(dados, "nome")}${codigo ? ` (${codigo})` : ""}`;
  });
  return estado.erro ? estado : { sucesso: `Salvo: ${salvo}. Pode cadastrar o próximo.` };
}

export async function editarItem(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Dados salvos.", (atorId) =>
    inv.editar(atorId, itemId, {
      nome: texto(dados, "nome"),
      categoriaId: texto(dados, "categoriaId"),
      estado: texto(dados, "estado") as Estado,
      codigo: texto(dados, "codigo"),
      variacao: texto(dados, "variacao"),
      descricao: texto(dados, "descricao"),
      localizacao: texto(dados, "localizacao"),
      quantidadeMinima: inteiro(dados, "quantidadeMinima") ?? null,
    }),
  );
}

export async function removerItem(itemId: string, _: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  if (texto(dados, "confirmo") !== "sim") return { erro: "Confirme para remover." };
  const estado = await executar("", (atorId) => inv.remover(atorId, itemId));
  if (!estado.erro) redirect("/inventario");
  return estado;
}

export async function adicionarFoto(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Foto adicionada.", async (atorId) => {
    const foto = await arquivo(dados, "foto");
    if (!foto) throw regraViolada("Escolha uma foto.");
    await inv.adicionarFoto(atorId, itemId, foto);
  });
}

export async function adicionarVideo(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Vídeo adicionado.", (atorId) => inv.adicionarVideo(atorId, itemId, texto(dados, "url")));
}

export async function removerMidia(_: EstadoAcao, dados: FormData) {
  return executar("Removido.", (atorId) => inv.removerMidia(atorId, texto(dados, "midiaId")));
}

export async function registrarManutencao(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Registrado no histórico.", async (atorId) => {
    const pecaId = texto(dados, "pecaId");
    await inv.registrarManutencao(atorId, {
      itemIds: [itemId, ...lista(dados, "outrosItens")],
      data: texto(dados, "data"),
      servico: texto(dados, "servico"),
      quemFez: texto(dados, "quemFez"),
      pecas: pecaId ? [{ itemId: pecaId, quantidade: inteiro(dados, "pecaQuantidade") ?? 1 }] : [],
      ...(await dadosGasto(dados)),
    });
  });
}

export async function movimentarEstoque(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Estoque atualizado.", async (atorId) => {
    await inv.movimentarEstoque(atorId, {
      itemId,
      tipo: texto(dados, "tipo") === "saida" ? "saida" : "entrada",
      quantidade: inteiro(dados, "quantidade") ?? 0,
      motivo: texto(dados, "motivo"),
      ...(await dadosGasto(dados)),
    });
  });
}

export async function avisarProblema(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Aviso enviado. Obrigado!", (atorId) => inv.avisarProblema(atorId, itemId, texto(dados, "descricao")));
}

export async function resolverProblema(_: EstadoAcao, dados: FormData) {
  return executar("Problema resolvido.", (atorId) => inv.resolverProblema(atorId, texto(dados, "problemaId")));
}

export async function definirEscalaEnsaio(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Escala salva.", (atorId) => inv.definirEscalaEnsaio(atorId, itemId, lista(dados, "pessoas")));
}

export async function definirManutencao(itemId: string, _: EstadoAcao, dados: FormData) {
  return executar("Situação atualizada.", (atorId) =>
    sistema.emprestimos.definirManutencao(atorId, itemId, texto(dados, "manutencao") === "sim"),
  );
}

export async function salvarCategoria(_: EstadoAcao, dados: FormData) {
  return executar("Categoria salva.", (atorId) =>
    inv.categorias.salvar(atorId, {
      id: texto(dados, "id") || undefined,
      nome: texto(dados, "nome"),
      prefixo: texto(dados, "prefixo"),
      paiId: texto(dados, "paiId") || null,
      tipoPadrao: texto(dados, "tipoPadrao") === "estoque" ? "estoque" : undefined,
    }),
  );
}

export async function removerCategoria(_: EstadoAcao, dados: FormData) {
  return executar("Categoria removida.", (atorId) => inv.categorias.remover(atorId, texto(dados, "id")));
}
