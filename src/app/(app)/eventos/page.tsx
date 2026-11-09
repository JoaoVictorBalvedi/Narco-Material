import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { formatarData } from "@/lib/formato";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { pode } from "@/sistema/permissoes";

export const metadata = { title: "Eventos | Narcóticos Material" };

type Evento = Awaited<ReturnType<typeof sistema.eventos.listar>>[number];

function Lista({ titulo, eventos }: { titulo: string; eventos: Evento[] }) {
  if (!eventos.length) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
        {eventos.map((e) => (
          <li key={e.id}>
            <Link href={`/eventos/${e.id}`} className="flex items-center gap-2 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.nome}</span>
                <span className="block truncate text-xs text-suave">
                  {[formatarData(e.dataInicio) + (e.dataFim !== e.dataInicio ? ` a ${formatarData(e.dataFim)}` : ""), e.tipo, e.local].filter(Boolean).join(" · ")}
                </span>
                <span className="mt-1 block text-xs text-suave">{e.totalItens} {e.totalItens === 1 ? "item" : "itens"}</span>
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-suave" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Page() {
  const ator = await exigirAcao("ver_eventos");
  const eventos = await sistema.eventos.listar(ator.id);
  const hoje = dataLocal(new Date());
  const proximos = eventos.filter((e) => e.dataFim >= hoje).reverse();
  const passados = eventos.filter((e) => e.dataFim < hoje);
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Eventos</h1>
        {pode(ator, "gerenciar_eventos") && <Link href="/eventos/novo" className="botao"><Plus aria-hidden size={18} /> Novo</Link>}
      </div>
      {eventos.length === 0 && <p className="cartao py-8 text-center text-sm text-suave">Nenhum evento cadastrado.</p>}
      <div className="space-y-6">
        <Lista titulo="Próximos" eventos={proximos} />
        <Lista titulo="Anteriores" eventos={passados} />
      </div>
    </>
  );
}
