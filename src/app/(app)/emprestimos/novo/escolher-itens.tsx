"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export type ItemEscolha = { id: string; nome: string; codigo: string | null; grupo: string; fotoUrl: string | null };

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca na hora, sem recarregar a página. Os marcados continuam marcados ao filtrar. */
export function EscolherItens({ itens, inicial }: { itens: ItemEscolha[]; inicial?: string }) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(inicial ? [inicial] : []));
  const termo = normalizar(busca.trim());
  const grupos = [...new Set(itens.map((i) => i.grupo))];

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <div>
      <div className="relative mb-2">
        <Search aria-hidden size={18} className="absolute left-3 top-3.5 text-suave" />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar instrumento" placeholder="Buscar: caixa, surdo, CX-07…" autoComplete="off" className="campo pl-9" />
      </div>
      <p className="mb-2 text-sm text-suave" aria-live="polite">
        {marcados.size ? `${marcados.size} ${marcados.size === 1 ? "item escolhido" : "itens escolhidos"}` : "Escolha um ou mais itens"}
      </p>
      {itens.length === 0 && <p className="cartao text-sm text-suave">Nenhum item livre agora. Abra o item no inventário para entrar na fila.</p>}
      <div className="space-y-3">
        {grupos.map((grupo) => {
          const doGrupo = itens.filter((i) => i.grupo === grupo);
          return (
            <fieldset key={grupo}>
              <legend className="mb-1 text-sm font-semibold text-suave">{grupo}</legend>
              <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
                {doGrupo.map((i) => {
                  const visivel = !termo || normalizar(`${i.nome} ${i.codigo ?? ""}`).includes(termo);
                  return (
                    <li key={i.id} hidden={!visivel}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 has-[:checked]:bg-marca-suave">
                        <input type="checkbox" name="itens" value={i.id} checked={marcados.has(i.id)} onChange={() => alternar(i.id)} className="size-5 shrink-0 accent-marca" />
                        {i.fotoUrl ? (
                          <Image src={i.fotoUrl} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="size-10 shrink-0 rounded-lg bg-fundo" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{i.nome}</span>
                          {i.codigo && <span translate="no" className="block text-xs text-suave">{i.codigo}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
