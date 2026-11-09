import "server-only";
import { revalidatePath } from "next/cache";
import { ErroSistema, regraViolada } from "@/sistema/erros";
import type { ArquivoEnviado } from "@/sistema/portas";
import type { EstadoAcao } from "./estado-acao";
import { atorAtual } from "./sessao";

/** Roda uma operação em nome de quem está logado e traduz o resultado para o formulário. */
export async function executar(
  sucesso: string,
  operacao: (atorId: string) => Promise<unknown>,
): Promise<EstadoAcao> {
  const ator = await atorAtual();
  try {
    await operacao(ator.id);
  } catch (erro) {
    if (erro instanceof ErroSistema) return { erro: erro.message };
    console.error(erro);
    return { erro: "Algo deu errado. Tente novamente." };
  }
  revalidatePath("/", "layout");
  return { sucesso };
}

export const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();

export const lista = (dados: FormData, campo: string) => dados.getAll(campo).map(String).filter(Boolean);

export const marcado = (dados: FormData, campo: string) => dados.get(campo) === "sim";

export async function arquivo(dados: FormData, campo: string): Promise<ArquivoEnviado | undefined> {
  const valor = dados.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return undefined;
  return { bytes: new Uint8Array(await valor.arrayBuffer()), tipo: valor.type };
}

export function inteiro(dados: FormData, campo: string): number | undefined {
  const valor = texto(dados, campo);
  if (!valor) return undefined;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) throw regraViolada("Informe um número inteiro.");
  return numero;
}

/** Aceita 12, 12,5, 12,50 e 1.234,56. */
export function centavos(dados: FormData, campo: string): number | undefined {
  const valor = texto(dados, campo).replace(/^R\$\s*/, "");
  if (!valor) return undefined;
  if (!/^(\d{1,3}(\.\d{3})+|\d+)([,.]\d{1,2})?$/.test(valor)) {
    throw regraViolada("Informe o valor como 1.234,56.");
  }
  const semMilhar = /\.\d{3}/.test(valor) ? valor.replace(/\./g, "") : valor;
  return Math.round(Number(semMilhar.replace(",", ".")) * 100);
}

export const dadosGasto = async (dados: FormData) => ({
  valorCentavos: centavos(dados, "valor"),
  pagoPor: texto(dados, "pagoPor") || undefined,
  reembolsoPendente: marcado(dados, "reembolso"),
  comprovante: await arquivo(dados, "comprovante"),
});

/** Junta o motivo escolhido no botão com o detalhe digitado. */
export function motivoDe(dados: FormData): string {
  const escolhido = texto(dados, "motivo");
  const detalhe = texto(dados, "detalhe");
  if (escolhido === "Outro" || !escolhido) {
    if (!detalhe) throw regraViolada("Conte rapidamente para que você precisa do item.");
    return detalhe;
  }
  return detalhe ? `${escolhido}: ${detalhe}` : escolhido;
}
