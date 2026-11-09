import { Boxes, CalendarDays, ChevronRight, CirclePlus, Handshake, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { meusEmprestimos, painelDiretoria } from "@/lib/pendencias";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { CATEGORIAS, NOME_CATEGORIA, pode } from "@/sistema/permissoes";
import { CartaoConferir, CartaoMeu, CartaoPedido, CartaoRenovacao, CartaoRepasseDecidir, CartaoRepasseRecebido, Secao } from "../emprestimos/cartoes";
import { salvarPapel } from "../pessoas/acoes";

export const metadata = { title: "Início | Narcóticos Material" };

const LIMITE = 3;

function Atalho({ href, icone: Icone, titulo }: { href: string; icone: LucideIcon; titulo: string }) {
  return (
    <li>
      <Link href={href} className="flex h-full min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-borda bg-superficie p-2 text-center text-sm font-semibold leading-tight hover:border-marca">
        <Icone aria-hidden size={26} className="text-marca" />
        {titulo}
      </Link>
    </li>
  );
}

const VerTudo = ({ total }: { total: number }) =>
  total > LIMITE ? <Link href="/emprestimos?aba=diretoria" className="link-acao">Ver todos ({total})</Link> : null;

export default async function Page() {
  const ator = await atorAtual();
  const podePedir = pode(ator, "pedir_emprestimo");
  const [meus, painel, membros, pessoas] = await Promise.all([
    podePedir ? meusEmprestimos(ator.id) : null,
    painelDiretoria(ator.id),
    podePedir ? sistema.pessoas.listarMembros(ator.id) : [],
    pode(ator, "definir_papeis") ? sistema.pessoas.listar(ator.id) : [],
  ]);
  const hoje = dataLocal(new Date());
  const novos = pessoas.filter((p) => !p.categoria && !p.cargo && p.situacao === "ativa");
  const ativos = meus?.ativos ?? [];
  const recebidos = meus?.repasses.filter((r) => r.paraId === ator.id) ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold break-words">Olá, {ator.nome.split(" ")[0]}!</h1>
      <p className="mb-4 text-sm text-suave">{ativos.some((e) => e.situacao === "retirado") ? "Seus itens estão logo abaixo." : "O que você precisa hoje?"}</p>

      {podePedir && (
        <Link href="/emprestimos/novo" className="mb-6 flex min-h-20 items-center gap-3 rounded-2xl bg-marca p-4 text-marca-texto shadow-sm hover:bg-marca-forte">
          <Handshake aria-hidden size={32} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold leading-tight">Pegar um instrumento</span>
            <span className="block text-sm opacity-90">Escolha, diga por quantos dias e pronto</span>
          </span>
          <ChevronRight aria-hidden size={22} className="shrink-0" />
        </Link>
      )}

      <div className="space-y-6">
        {recebidos.length > 0 && (
          <Secao titulo="Repasses para você">{recebidos.map((r) => <CartaoRepasseRecebido key={r.id} r={r} />)}</Secao>
        )}

        {ativos.length > 0 && (
          <Secao titulo="Seus empréstimos" total={ativos.length}>
            {ativos.map((e) => (
              <CartaoMeu
                key={e.id}
                e={e}
                atorId={ator.id}
                hoje={hoje}
                membros={membros}
                renovacao={meus?.renovacoes.find((r) => r.emprestimoId === e.id)}
                repasse={meus?.repasses.find((r) => r.emprestimoId === e.id && r.deId === ator.id)}
              />
            ))}
          </Secao>
        )}

        {painel && painel.pendentes.length > 0 && (
          <Secao titulo="Pedidos para decidir" total={painel.pendentes.length} acao={<VerTudo total={painel.pendentes.length} />}>
            {painel.pendentes.slice(0, LIMITE).map((e) => <CartaoPedido key={e.id} e={e} />)}
          </Secao>
        )}
        {painel && painel.conferir.length > 0 && (
          <Secao titulo="Devoluções para conferir" total={painel.conferir.length} acao={<VerTudo total={painel.conferir.length} />}>
            {painel.conferir.slice(0, LIMITE).map((e) => <CartaoConferir key={e.id} e={e} />)}
          </Secao>
        )}
        {painel && painel.renovacoes.length > 0 && (
          <Secao titulo="Pedidos de mais tempo" total={painel.renovacoes.length} acao={<VerTudo total={painel.renovacoes.length} />}>
            {painel.renovacoes.slice(0, LIMITE).map((r) => <CartaoRenovacao key={r.id} r={r} />)}
          </Secao>
        )}
        {painel && painel.repasses.length > 0 && (
          <Secao titulo="Repasses para aprovar" total={painel.repasses.length} acao={<VerTudo total={painel.repasses.length} />}>
            {painel.repasses.slice(0, LIMITE).map((r) => <CartaoRepasseDecidir key={r.id} r={r} />)}
          </Secao>
        )}

        {novos.length > 0 && (
          <Secao titulo="Novos cadastros" total={novos.length} acao={novos.length > LIMITE ? <Link href="/pessoas" className="link-acao">Ver todos</Link> : null}>
            {novos.slice(0, LIMITE).map((p) => (
              <li key={p.id} className="cartao">
                <p className="font-semibold break-words">{p.nome}</p>
                <p className="mb-2 text-xs break-all text-suave">{p.email}</p>
                <Formulario acao={salvarPapel.bind(null, p.id)}>
                  <input type="hidden" name="cargo" value="" />
                  <p className="mb-1 text-sm">Quem é na bateria?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIAS.map((c) => (
                      <BotaoEnviar key={c} name="categoria" value={c} variante="secundario" className="px-2">{NOME_CATEGORIA[c]}</BotaoEnviar>
                    ))}
                  </div>
                </Formulario>
              </li>
            ))}
          </Secao>
        )}

        <section>
          <h2 className="mb-2 text-lg font-semibold">Atalhos</h2>
          <ul className="grid grid-cols-3 gap-2">
            <Atalho href="/inventario" icone={Boxes} titulo="Material" />
            {podePedir && <Atalho href="/emprestimos" icone={Handshake} titulo="Empréstimos" />}
            {pode(ator, "ver_eventos") && <Atalho href="/eventos" icone={CalendarDays} titulo="Eventos" />}
            {pode(ator, "editar_inventario") && <Atalho href="/inventario/novo" icone={CirclePlus} titulo="Cadastrar" />}
            {pode(ator, "ver_financas") && <Atalho href="/financas" icone={Wallet} titulo="Finanças" />}
            {pode(ator, "definir_papeis") && <Atalho href="/pessoas" icone={Users} titulo="Pessoas" />}
          </ul>
        </section>
      </div>
    </>
  );
}
