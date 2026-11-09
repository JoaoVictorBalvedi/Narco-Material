import { NextResponse, type NextRequest } from "next/server";
import { ID_VALIDO } from "@/lib/formato";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { ErroSistema } from "@/sistema/erros";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ator = await atorAtual();
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ erro: "Comprovante não encontrado." }, { status: 404 });
  try {
    return NextResponse.redirect(await sistema.financas.urlComprovante(ator.id, id));
  } catch (erro) {
    if (erro instanceof ErroSistema) {
      return NextResponse.json({ erro: erro.message }, { status: erro.codigo === "sem_permissao" ? 403 : 404 });
    }
    throw erro;
  }
}
