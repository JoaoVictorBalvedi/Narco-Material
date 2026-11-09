import { Plus } from "lucide-react";
import Link from "next/link";
import { formatarData } from "@/lib/formato";
import { meusEmprestimos, painelDiretoria } from "@/lib/pendencias";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { CartaoConferir, CartaoMeu, CartaoPedido, CartaoRenovacao, CartaoRepasseDecidir, CartaoRepasseRecebido, Secao } from "./cartoes";

export const metadata = { title: "Empréstimos | Narcóticos Material" };

export default async function Page({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ator = await exigirAcao("pedir_emprestimo");
  const { aba } = await searchParams;
  const [{ ativos, repasses, renovacoes, historico }, painel, membros] = await Promise.all([
    meusEmprestimos(ator.id),
    painelDiretoria(ator.id),
    sistema.pessoas.listarMembros(ator.id),
  ]);
  const hoje = dataLocal(new Date());
  const recebidos = repasses.filter((r) => r.paraId === ator.id);
  const paraDiretoria = painel ? painel.pendentes.length + painel.renovacoes.length + painel.repasses.length + painel.conferir.length : 0;
  const naDiretoria = painel && aba === "diretoria";

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Empréstimos</h1>
        <Link href="/emprestimos/novo" className="botao"><Plus aria-hidden size={18} /> Pedir</Link>
      </div>

      {painel && (
        <nav aria-label="Visão" className="mb-4 grid grid-cols-2 rounded-xl bg-borda/50 p-1 text-sm font-semibold">
          <Link href="/emprestimos" aria-current={!naDiretoria ? "page" : undefined} className={`flex min-h-10 items-center justify-center rounded-lg ${!naDiretoria ? "bg-superficie shadow-sm" : "text-suave"}`}>Meus</Link>
          <Link href="/emprestimos?aba=diretoria" aria-current={naDiretoria ? "page" : undefined} className={`flex min-h-10 items-center justify-center gap-1 rounded-lg ${naDiretoria ? "bg-superficie shadow-sm" : "text-suave"}`}>
            Diretoria {paraDiretoria > 0 && <span className="rounded-full bg-marca px-1.5 text-xs text-marca-texto">{paraDiretoria}</span>}
          </Link>
        </nav>
      )}

      {naDiretoria ? (
        <div className="space-y-6">
          {paraDiretoria === 0 && <p className="cartao py-6 text-center text-sm text-suave">Nada para decidir agora.</p>}
          {painel.pendentes.length > 0 && <Secao titulo="Pedidos" total={painel.pendentes.length}>{painel.pendentes.map((e) => <CartaoPedido key={e.id} e={e} />)}</Secao>}
          {painel.conferir.length > 0 && <Secao titulo="Devoluções para conferir" total={painel.conferir.length}>{painel.conferir.map((e) => <CartaoConferir key={e.id} e={e} />)}</Secao>}
          {painel.renovacoes.length > 0 && <Secao titulo="Pedidos de mais tempo" total={painel.renovacoes.length}>{painel.renovacoes.map((r) => <CartaoRenovacao key={r.id} r={r} />)}</Secao>}
          {painel.repasses.length > 0 && <Secao titulo="Repasses" total={painel.repasses.length}>{painel.repasses.map((r) => <CartaoRepasseDecidir key={r.id} r={r} />)}</Secao>}
          {painel.emAndamento.length > 0 && (
            <Secao titulo="Com os membros agora" total={painel.emAndamento.length}>
              {painel.emAndamento.map((e) => (
                <li key={e.id} className="cartao py-3">
                  <Link href={`/inventario/${e.itemId}`} className="block">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">{e.itemRotulo} {e.atrasado && <span className="selo-marca">Atrasado</span>}</span>
                    <span className="block text-sm text-suave">{e.responsavelNome} · até {formatarData(e.dataDevolucao!)}{e.filaTotal ? ` · ${e.filaTotal} na fila` : ""}</span>
                  </Link>
                </li>
              ))}
            </Secao>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {recebidos.length > 0 && <Secao titulo="Repasses para você">{recebidos.map((r) => <CartaoRepasseRecebido key={r.id} r={r} />)}</Secao>}
          {ativos.length > 0 ? (
            <Secao titulo="Seus empréstimos" total={ativos.length}>
              {ativos.map((e) => (
                <CartaoMeu
                  key={e.id}
                  e={e}
                  atorId={ator.id}
                  hoje={hoje}
                  membros={membros}
                  renovacao={renovacoes.find((r) => r.emprestimoId === e.id)}
                  repasse={repasses.find((r) => r.emprestimoId === e.id && r.deId === ator.id)}
                />
              ))}
            </Secao>
          ) : (
            <div className="cartao py-8 text-center">
              <p className="font-semibold">Você não está com nenhum item</p>
              <p className="mb-4 text-sm text-suave">Peça um instrumento e ele aparece aqui.</p>
              <Link href="/emprestimos/novo" className="botao">Pegar um instrumento</Link>
            </div>
          )}
          {historico.length > 0 && (
            <details className="sanfona">
              <summary>Histórico ({historico.length})</summary>
              <ul className="space-y-2">
                {historico.map((e) => (
                  <li key={e.id} className="cartao py-3">
                    <p className="text-sm font-medium">{e.itemRotulo}</p>
                    <p className="text-xs text-suave">
                      {{ recusado: "Recusado", cancelado: "Cancelado", conferido: "Devolvido" }[e.situacao as "recusado"] ?? e.situacao}
                      {e.justificativaDecisao ? `: ${e.justificativaDecisao}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
