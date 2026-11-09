import { NextResponse, type NextRequest } from "next/server";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { ErroSistema } from "@/sistema/erros";

/** Texto vindo de usuários não pode virar fórmula ao abrir na planilha. */
function celula(valor: string | number | null | undefined) {
  if (typeof valor === "number") return valor.toFixed(2).replace(".", ",");
  let texto = valor ?? "";
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

const linha = (...valores: (string | number | null | undefined)[]) => valores.map(celula).join(";");
const reais = (centavos: number | null) => (centavos === null ? null : centavos / 100);

export async function GET(request: NextRequest) {
  const ator = await atorAtual();
  const de = request.nextUrl.searchParams.get("de") ?? "";
  const ate = request.nextUrl.searchParams.get("ate") ?? "";
  try {
    const r = await sistema.financas.relatorio(ator.id, de, ate);
    const entradas = r.movimentacoes.filter((m) => m.tipo === "entrada");
    const saidas = r.movimentacoes.filter((m) => m.tipo === "saida");
    const soma = (lista: typeof entradas) => lista.reduce((t, m) => t + m.valorCentavos, 0);
    const conteudo = [
      linha("Relatório de patrimônio e gastos - Bateria Narcóticos"),
      linha(`Período: ${formatarData(de)} a ${formatarData(ate)}`),
      "",
      linha("TOTAIS"),
      linha("Entradas", reais(soma(entradas))),
      linha("Saídas", reais(soma(saidas))),
      "",
      linha("MOVIMENTAÇÕES"),
      linha("Data", "Tipo", "Descrição", "Itens", "Quem fez", "Pago por", "Valor (R$)", "Reembolso"),
      ...r.movimentacoes.map((m) =>
        linha(formatarData(m.data), m.tipo === "entrada" ? "Entrada" : "Saída", m.descricao, m.itens.join(", "), m.quemFez, m.pagoPor, reais(m.valorCentavos), m.reembolso === "pendente" ? "Pendente" : m.reembolso === "pago" ? "Pago" : ""),
      ),
      "",
      linha("MANUTENÇÕES"),
      linha("Data", "Serviço", "Itens", "Quem fez", "Valor (R$)"),
      ...r.manutencoes.map((m) => linha(formatarData(m.data), m.servico, m.itens, m.quemFez, reais(m.valorCentavos))),
      "",
      linha("ITENS CADASTRADOS NO PERÍODO"),
      linha("Item", "Categoria", "Cadastrado em"),
      ...r.novosItens.map((i) => linha(i.rotulo, i.categoria, formatarDataHora(i.criadoEm))),
    ].join("\r\n");
    return new NextResponse(`﻿${conteudo}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-material-${de}-a-${ate}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erro) {
    if (erro instanceof ErroSistema) {
      return NextResponse.json({ erro: erro.message }, { status: erro.codigo === "sem_permissao" ? 403 : 400 });
    }
    throw erro;
  }
}
