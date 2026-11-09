import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sistema } from "@/lib/sistema";

function autorizado(cabecalho: string | null) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/** Chamada pelo agendador diário da hospedagem: lembretes, atrasos e filas. */
export async function GET(request: NextRequest) {
  if (!autorizado(request.headers.get("authorization"))) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  await sistema.emprestimos.executarRotinas();
  return NextResponse.json({ ok: true });
}
