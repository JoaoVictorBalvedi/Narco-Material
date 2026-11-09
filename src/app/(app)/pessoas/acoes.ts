"use server";

import { redirect } from "next/navigation";
import { executar } from "@/lib/acao";
import type { EstadoAcao } from "@/lib/estado-acao";
import { sistema } from "@/lib/sistema";
import { ErroSistema } from "@/sistema/erros";
import {
  CARGOS,
  CATEGORIAS,
  PERMISSOES_DELEGAVEIS,
  type Cargo,
  type Categoria,
  type PermissaoDelegavel,
  type Situacao,
} from "@/sistema/permissoes";

const SITUACOES: Situacao[] = ["ativa", "suspensa", "desativada"];
const entrada = (valor: boolean) => {
  if (!valor) throw new ErroSistema("regra_violada", "Valor inválido.");
};

export async function salvarPapel(pessoaId: string, _: EstadoAcao, dados: FormData) {
  const categoria = String(dados.get("categoria") ?? "");
  const cargo = String(dados.get("cargo") ?? "");
  return executar("Papel atualizado.", (atorId) => {
    entrada(!categoria || CATEGORIAS.includes(categoria as Categoria));
    entrada(!cargo || CARGOS.includes(cargo as Cargo));
    return sistema.pessoas.definirPapel(atorId, pessoaId, {
      categoria: (categoria || null) as Categoria | null,
      cargo: (cargo || null) as Cargo | null,
    });
  });
}

export async function mudarSituacao(pessoaId: string, _: EstadoAcao, dados: FormData) {
  const situacao = String(dados.get("situacao")) as Situacao;
  return executar("Situação atualizada.", (atorId) => {
    entrada(SITUACOES.includes(situacao));
    return sistema.pessoas.definirSituacao(atorId, pessoaId, situacao);
  });
}

export async function mudarPermissao(pessoaId: string, _: EstadoAcao, dados: FormData) {
  const [operacao, permissao] = String(dados.get("mudanca")).split(":");
  return executar("Permissões atualizadas.", (atorId) => {
    entrada(PERMISSOES_DELEGAVEIS.includes(permissao as PermissaoDelegavel));
    entrada(operacao === "conceder" || operacao === "retirar");
    return operacao === "conceder"
      ? sistema.permissoes.conceder(atorId, pessoaId, permissao as PermissaoDelegavel)
      : sistema.permissoes.retirar(atorId, pessoaId, permissao as PermissaoDelegavel);
  });
}

export async function transferirCargo(pessoaId: string, _: EstadoAcao, dados: FormData) {
  if (dados.get("confirmo") !== "sim") return { erro: "Confirme a transferência." };
  const resultado = await executar("Cargo transferido.", (atorId) =>
    sistema.pessoas.transferirCargoMaterial(atorId, pessoaId),
  );
  // Quem transfere pode perder o acesso a esta página; os avisos confirmam a mudança.
  if (resultado.sucesso) redirect("/avisos");
  return resultado;
}
