"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CampoFoto } from "@/componentes/campo-foto";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { DICA_CATEGORIA, IconeCategoria, nomeNoSingular } from "@/componentes/icone-categoria";
import type { CategoriaPrincipal, TipoItem } from "@/sistema/inventario";
import { cadastrarItem } from "../acoes";
import { ESTADOS_OPCOES } from "../opcoes";

export function FormularioCadastro({ categorias }: { categorias: CategoriaPrincipal[] }) {
  const [grupo, setGrupo] = useState<CategoriaPrincipal | null>(null);
  const [tipoCategoria, setTipoCategoria] = useState("");
  const [controle, setControle] = useState<TipoItem>("individual");

  if (!grupo) {
    return (
      <>
        <Link href="/inventario" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
          <ArrowLeft aria-hidden size={18} /> Inventário
        </Link>
        <h1 className="mb-1 text-2xl font-bold">O que você vai cadastrar?</h1>
        <p className="mb-4 text-sm text-suave">Escolha o que mais se parece. Dá para mudar depois.</p>
        <ul className="grid grid-cols-2 gap-2">
          {categorias.map((c) => {
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setGrupo(c);
                    setTipoCategoria("");
                    setControle(c.tipoPadrao);
                  }}
                  className="flex h-full min-h-28 w-full flex-col items-start gap-1 rounded-xl border border-borda bg-superficie p-3 text-left hover:border-marca"
                >
                  <IconeCategoria prefixo={c.prefixo} aria-hidden size={26} className="text-marca" />
                  <span className="font-semibold leading-tight">{c.nome}</span>
                  {DICA_CATEGORIA[c.prefixo] && <span className="text-xs text-suave">{DICA_CATEGORIA[c.prefixo]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  const singular = nomeNoSingular(grupo.prefixo);
  const categoriaId = tipoCategoria || (grupo.tipos.length ? "" : grupo.id);
  const unica = controle === "individual";

  return (
    <>
      <button type="button" onClick={() => setGrupo(null)} className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Escolher outra categoria
      </button>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <IconeCategoria prefixo={grupo.prefixo} aria-hidden size={26} className="shrink-0 text-marca" /> Cadastrar {singular}
      </h1>

      <Formulario acao={cadastrarItem} limparAoSalvar className="space-y-5">
        <input type="hidden" name="tipo" value={controle} />
        <input type="hidden" name="categoriaId" value={categoriaId} />

        {grupo.tipos.length > 0 && (
          <fieldset>
            <legend className="rotulo text-base font-semibold">Qual {singular === "instrumento" ? "instrumento" : "tipo"}?</legend>
            <div className="flex flex-wrap gap-2">
              {grupo.tipos.map((t) => (
                <label key={t.id} className="pilula">
                  <input
                    type="radio"
                    name="tipoEscolhido"
                    required
                    checked={tipoCategoria === t.id}
                    onChange={() => {
                      setTipoCategoria(t.id);
                      setControle(t.tipoPadrao);
                    }}
                    className="sr-only"
                  />
                  {t.nome}
                </label>
              ))}
              <label className="pilula">
                <input
                  type="radio"
                  name="tipoEscolhido"
                  required
                  checked={tipoCategoria === grupo.id}
                  onChange={() => {
                    setTipoCategoria(grupo.id);
                    setControle(grupo.tipoPadrao);
                  }}
                  className="sr-only"
                />
                Outro
              </label>
            </div>
          </fieldset>
        )}

        <CampoFoto rotulo="Foto" />

        <div>
          <label htmlFor="nome" className="rotulo text-base font-semibold">Como vocês chamam?</label>
          <input id="nome" name="nome" required placeholder={grupo.prefixo === "IN" ? "Ex.: Caixa de guerra 12 polegadas" : "Dê um nome claro"} className="campo" />
        </div>

        <fieldset>
          <legend className="rotulo text-base font-semibold">É uma peça só ou várias iguais?</legend>
          <div className="grid gap-2">
            {([
              ["individual", "Uma peça só", "Tem código, histórico e pode ser emprestada. Ex.: a caixa 7."],
              ["estoque", "Várias iguais", "Controladas por quantidade. Ex.: 30 pares de baquetas."],
            ] as const).map(([valor, nome, ajuda]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={controle === valor}
                onClick={() => setControle(valor)}
                className={`rounded-lg border p-3 text-left ${controle === valor ? "border-marca bg-marca-suave" : "border-borda bg-superficie"}`}
              >
                <span className="block text-sm font-semibold">{nome}</span>
                <span className="block text-xs text-suave">{ajuda}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {!unica && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="quantidade" className="rotulo">Quantos tem hoje?</label>
                <input id="quantidade" name="quantidade" type="number" min={0} inputMode="numeric" required className="campo" />
              </div>
              <div>
                <label htmlFor="quantidadeMinima" className="rotulo">Avisar abaixo de</label>
                <input id="quantidadeMinima" name="quantidadeMinima" type="number" min={0} inputMode="numeric" placeholder="Opcional" className="campo" />
              </div>
            </div>
            <div>
              <label htmlFor="variacao" className="rotulo">Tamanho ou modelo (opcional)</label>
              <input id="variacao" name="variacao" placeholder="Ex.: 14 polegadas, tamanho M" className="campo" />
            </div>
          </div>
        )}

        <fieldset>
          <legend className="rotulo text-base font-semibold">Em que estado está?</legend>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_OPCOES.map(([valor, nome]) => (
              <label key={valor} className="pilula">
                <input type="radio" name="estado" value={valor} defaultChecked={valor === "bom"} className="sr-only" />
                {nome}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="sanfona">
          <summary>
            <span className="flex items-center gap-1"><ChevronRight aria-hidden size={16} className="text-suave" /> Mais detalhes (opcional)</span>
          </summary>
          <div className="space-y-3 pt-1">
            <div>
              <label htmlFor="descricao" className="rotulo">Descrição</label>
              <textarea id="descricao" name="descricao" rows={3} className="campo py-2" />
            </div>
            <div>
              <label htmlFor="localizacao" className="rotulo">Onde fica</label>
              <input id="localizacao" name="localizacao" placeholder="Salinha" className="campo" />
            </div>
            <div>
              <label htmlFor="codigo" className="rotulo">Código ou número</label>
              <input id="codigo" name="codigo" placeholder={unica ? "O app gera um, como CX-07" : "Opcional"} className="campo" />
              {unica && <p className="mt-1 text-xs text-suave">Preencha só se a peça já tiver numeração.</p>}
            </div>
          </div>
        </details>

        <BotaoEnviar className="w-full text-base">Salvar {singular}</BotaoEnviar>
      </Formulario>
    </>
  );
}
