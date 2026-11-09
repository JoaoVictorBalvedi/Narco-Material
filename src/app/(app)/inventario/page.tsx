import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { SelectAutoEnviar } from "@/componentes/auto-enviar";
import { FotoItem } from "@/componentes/foto-item";
import { iconeCategoria } from "@/componentes/icone-categoria";
import { SeloDisponibilidade } from "@/componentes/selo-disponibilidade";
import { formatarData } from "@/lib/formato";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { NOME_DISPONIBILIDADE, type Disponibilidade, type ItemResumo } from "@/sistema/inventario";
import { pode } from "@/sistema/permissoes";

export const metadata = { title: "Inventário | Narcóticos Material" };

function agrupar(itens: ItemResumo[]) {
  const grupos = new Map<string, { nome: string; itens: ItemResumo[] }>();
  for (const item of itens) {
    const grupo = grupos.get(item.grupoId) ?? { nome: item.grupo, itens: [] };
    grupo.itens.push(item);
    grupos.set(item.grupoId, grupo);
  }
  return [...grupos.entries()];
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; situacao?: string; local?: string }>;
}) {
  const ator = await atorAtual();
  const { q = "", categoria = "", situacao = "", local = "" } = await searchParams;
  const [categorias, todos] = await Promise.all([
    sistema.inventario.categorias.listar(ator.id),
    sistema.inventario.listar(ator.id),
  ]);
  const itens = await sistema.inventario.listar(ator.id, {
    busca: q,
    categoriaId: categoria || undefined,
    disponibilidade: (situacao as Disponibilidade) || undefined,
    localizacao: local || undefined,
  });
  const locais = [...new Set(todos.map((i) => i.localizacao))].sort();
  const editar = pode(ator, "editar_inventario");
  const comItens = categorias.filter((c) => todos.some((i) => i.grupoId === c.id));
  const grupoAtual = categorias.find((c) => c.id === categoria);
  const tiposDoGrupo = grupoAtual?.tipos.filter((t) => todos.some((i) => i.categoriaId === t.id)) ?? [];
  const tipoAtual = categorias.flatMap((c) => c.tipos.map((t) => ({ ...t, grupo: c }))).find((t) => t.id === categoria);
  const grupoDosTipos = grupoAtual ?? tipoAtual?.grupo;
  const filtrosExtras = Boolean(situacao || local);

  const url = (categoriaId: string) => {
    const busca = new URLSearchParams();
    if (q) busca.set("q", q);
    if (categoriaId) busca.set("categoria", categoriaId);
    if (situacao) busca.set("situacao", situacao);
    if (local) busca.set("local", local);
    const texto = busca.toString();
    return texto ? `/inventario?${texto}` : "/inventario";
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Inventário</h1>
        {editar && <Link href="/inventario/novo" className="botao"><Plus aria-hidden size={18} /> Cadastrar</Link>}
      </div>

      <form role="search" className="mb-3">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        <div className="relative">
          <Search aria-hidden size={18} className="absolute left-3 top-3.5 text-suave" />
          <input name="q" type="search" defaultValue={q} aria-label="Buscar por nome, código ou descrição" placeholder="Buscar por nome, código ou descrição…" className="campo pl-9" />
        </div>
        <details className="sanfona mt-1" open={filtrosExtras}>
          <summary className="text-sm font-medium text-suave">Filtrar por status ou local</summary>
          <div className="grid grid-cols-2 gap-2 pb-1">
            <SelectAutoEnviar name="situacao" defaultValue={situacao} aria-label="Filtrar por status" className="campo min-w-0 px-2 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(NOME_DISPONIBILIDADE).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
            </SelectAutoEnviar>
            <SelectAutoEnviar name="local" defaultValue={local} aria-label="Filtrar por localização" className="campo min-w-0 px-2 text-sm">
              <option value="">Todos os locais</option>
              {locais.map((l) => <option key={l} value={l}>{l}</option>)}
            </SelectAutoEnviar>
          </div>
        </details>
      </form>

      {comItens.length > 0 && (
        <nav aria-label="Categorias" className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={url("")} aria-current={!categoria ? "true" : undefined} className={`pilula shrink-0 ${!categoria ? "pilula-ativa" : ""}`}>Tudo</Link>
          <Link
            href={situacao === "disponivel" ? url(categoria).replace(/([?&])situacao=disponivel&?/, "$1").replace(/[?&]$/, "") : `${url(categoria)}${url(categoria).includes("?") ? "&" : "?"}situacao=disponivel`}
            aria-current={situacao === "disponivel" ? "true" : undefined}
            className={`pilula shrink-0 ${situacao === "disponivel" ? "pilula-ativa" : ""}`}
          >
            Livres agora
          </Link>
          {comItens.map((c) => {
            const Icone = iconeCategoria(c.prefixo);
            const ativa = grupoDosTipos?.id === c.id;
            return (
              <Link key={c.id} href={url(c.id)} aria-current={ativa ? "true" : undefined} className={`pilula shrink-0 gap-1 ${ativa ? "pilula-ativa" : ""}`}>
                <Icone aria-hidden size={16} /> {c.nome}
              </Link>
            );
          })}
        </nav>
      )}
      {grupoDosTipos && (tiposDoGrupo.length > 0 || tipoAtual) && (
        <nav aria-label="Tipos" className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1">
          {grupoDosTipos.tipos.filter((t) => todos.some((i) => i.categoriaId === t.id)).map((t) => (
            <Link key={t.id} href={url(t.id)} aria-current={tipoAtual?.id === t.id ? "true" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm ${tipoAtual?.id === t.id ? "bg-marca-suave font-semibold text-marca" : "text-suave"}`}>
              {t.nome}
            </Link>
          ))}
        </nav>
      )}

      {itens.length === 0 && (
        <div className="cartao py-8 text-center text-sm text-suave">
          {todos.length === 0
            ? editar
              ? "Nada cadastrado ainda. Comece pelo botão Cadastrar."
              : "Nada cadastrado ainda."
            : "Nenhum item com esses filtros."}
        </div>
      )}

      <div className="space-y-5">
        {agrupar(itens).map(([id, grupo]) => (
          <section key={id}>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              {grupo.nome} <span className="selo">{grupo.itens.length}</span>
            </h2>
            <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
              {grupo.itens.map((i) => (
                <li key={i.id}>
                  <Link href={`/inventario/${i.id}`} className="flex items-center gap-3 p-3">
                    <FotoItem url={i.fotoUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.nome}{i.variacao ? ` ${i.variacao}` : ""}</span>
                      <span className="block truncate text-xs text-suave">
                        {[i.codigo, i.categoria !== i.grupo ? i.categoria : null, i.tipo === "estoque" ? `${i.quantidade} em estoque` : null].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <SeloDisponibilidade valor={i.disponibilidade} />
                        {i.exemplo && <span className="selo">Exemplo</span>}
                        {i.filaTotal > 0 && <span className="selo">Fila: {i.filaTotal}</span>}
                      </span>
                      {i.comQuem && (
                        <span className="mt-1 block truncate text-xs text-suave">
                          Com {i.comQuem}{i.devolucaoPrevista ? ` até ${formatarData(i.devolucaoPrevista)}` : ""}
                        </span>
                      )}
                    </span>
                    <ChevronRight aria-hidden size={18} className="shrink-0 text-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
