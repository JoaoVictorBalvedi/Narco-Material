import { Download, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { formatarData, formatarMoeda } from "@/lib/formato";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal, dataValida } from "@/sistema/datas";
import { pode } from "@/sistema/permissoes";
import { marcarReembolsado, removerLancamento } from "./acoes";

export const metadata = { title: "Finanças | Narcóticos Material" };

/** O período padrão é o semestre atual, o mesmo do relatório à Assembleia. */
function semestreDe(hoje: string) {
  const ano = hoje.slice(0, 4);
  return Number(hoje.slice(5, 7)) <= 6
    ? { de: `${ano}-01-01`, ate: `${ano}-06-30` }
    : { de: `${ano}-07-01`, ate: `${ano}-12-31` };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const ator = await exigirAcao("ver_financas");
  const busca = await searchParams;
  const semestre = semestreDe(dataLocal(new Date()));
  const de = busca.de && dataValida(busca.de) ? busca.de : semestre.de;
  const ateInformado = busca.ate && dataValida(busca.ate) ? busca.ate : semestre.ate;
  const ate = ateInformado < de ? de : ateInformado;
  const [resumo, movimentacoes] = await Promise.all([
    sistema.financas.resumo(ator.id, de, ate),
    sistema.financas.listar(ator.id, { de, ate }),
  ]);
  const lancar = pode(ator, "lancar_custos");

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Finanças</h1>
        {lancar && <Link href="/financas/novo" className="botao"><Plus aria-hidden size={18} /> Lançar</Link>}
      </div>

      <form className="mb-4 grid grid-cols-2 items-end gap-2">
        <div className="min-w-0">
          <label htmlFor="de" className="rotulo">De</label>
          <input id="de" name="de" type="date" defaultValue={de} className="campo" />
        </div>
        <div className="min-w-0">
          <label htmlFor="ate" className="rotulo">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={ate} className="campo" />
        </div>
        <button type="submit" className="botao-secundario col-span-2">Ver período</button>
      </form>

      <div className="space-y-4">
        <section className="cartao">
          <h2 className="sr-only">Totais do período</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-sm text-suave">Entradas</dt>
              <dd className="text-xl font-bold tabular-nums text-sucesso">{formatarMoeda(resumo.entradas)}</dd>
            </div>
            <div>
              <dt className="text-sm text-suave">Saídas</dt>
              <dd className="text-xl font-bold tabular-nums">{formatarMoeda(resumo.saidas)}</dd>
            </div>
          </dl>
          <a href={`/financas/relatorio?de=${de}&ate=${ate}`} className="botao-secundario mt-3 w-full">
            <Download aria-hidden size={18} /> Exportar relatório (planilha)
          </a>
        </section>

        {resumo.reembolsos.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Reembolsos pendentes</h2>
            <ul className="divide-y divide-borda">
              {resumo.reembolsos.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium">{m.pagoPor ?? "Quem pagou não informado"}: <span className="tabular-nums">{formatarMoeda(m.valorCentavos)}</span></span>
                    <span className="block truncate text-xs text-suave">{m.descricao}</span>
                  </span>
                  {lancar && (
                    <Formulario acao={marcarReembolsado}>
                      <input type="hidden" name="id" value={m.id} />
                      <BotaoEnviar variante="secundario" className="shrink-0">Pago</BotaoEnviar>
                    </Formulario>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {resumo.porCategoria.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Saídas por categoria</h2>
            <ul className="space-y-1 text-sm">
              {resumo.porCategoria.map((c) => (
                <li key={c.categoria} className="flex justify-between gap-3"><span className="min-w-0 truncate">{c.categoria}</span><span className="tabular-nums">{formatarMoeda(c.totalCentavos)}</span></li>
              ))}
            </ul>
          </section>
        )}

        {resumo.porItem.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Itens que mais custaram</h2>
            <ul className="space-y-1 text-sm">
              {resumo.porItem.map((i) => (
                <li key={i.itemId} className="flex justify-between gap-3">
                  <Link href={`/inventario/${i.itemId}`} className="min-w-0 truncate underline-offset-2 hover:underline">{i.rotulo}</Link>
                  <span className="tabular-nums">{formatarMoeda(i.totalCentavos)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-semibold">Movimentações</h2>
          {movimentacoes.length === 0 && <p className="cartao py-6 text-center text-sm text-suave">Nada nesse período.</p>}
          <ul className="space-y-2">
            {movimentacoes.map((m) => (
              <li key={m.id} className="cartao py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium">{m.descricao}</p>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${m.tipo === "entrada" ? "text-sucesso" : ""}`}>
                    {m.tipo === "entrada" ? "+" : "−"}{formatarMoeda(m.valorCentavos)}
                  </p>
                </div>
                <p className="text-xs text-suave">{[formatarData(m.data), m.quemFez, m.pagoPor ? `Pago por ${m.pagoPor}` : null].filter(Boolean).join(" · ")}</p>
                {m.itens.length > 0 && <p className="text-xs text-suave">Itens: {m.itens.join(", ")}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {m.temComprovante && (
                    <a href={`/financas/comprovante/${m.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca">
                      <FileText aria-hidden size={16} /> Comprovante
                    </a>
                  )}
                  {lancar && (
                    <details className="sanfona w-full">
                      <summary className="text-sm">Corrigir</summary>
                      <p className="mb-1 text-xs text-suave">
                        Remova e lance de novo se houver erro.{m.ligadaManutencao ? " A reforma continua no histórico do item, sem o valor." : ""}
                      </p>
                      <Formulario acao={removerLancamento}>
                        <input type="hidden" name="id" value={m.id} />
                        <BotaoEnviar variante="secundario" className="w-full">Remover lançamento</BotaoEnviar>
                      </Formulario>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
