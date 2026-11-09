import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { NOME_CARGO, NOME_CATEGORIA, NOME_SITUACAO } from "@/sistema/permissoes";

export const metadata = { title: "Pessoas | Narcóticos Material" };

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ator = await exigirAcao("definir_papeis");
  const { q = "" } = await searchParams;
  const busca = normalizar(q.trim());
  const pessoas = (await sistema.pessoas.listar(ator.id)).filter(
    (p) => !busca || normalizar(`${p.nome} ${p.email}`).includes(busca),
  );

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Pessoas</h1>
      <form role="search" className="relative mb-4">
        <Search aria-hidden size={18} className="absolute left-3 top-3.5 text-suave" />
        <input name="q" type="search" defaultValue={q} aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" className="campo pl-9" />
      </form>
      {pessoas.length === 0 && <p className="cartao text-center text-sm text-suave">Ninguém encontrado.</p>}
      <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie empty:hidden">
        {pessoas.map((p) => (
          <li key={p.id}>
            <Link href={`/pessoas/${p.id}`} className="flex min-h-14 items-center gap-2 px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.nome}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {p.cargo && <span className="selo-marca">{NOME_CARGO[p.cargo]}</span>}
                  {p.categoria && <span className="selo">{NOME_CATEGORIA[p.categoria]}</span>}
                  {!p.cargo && !p.categoria && <span className="selo-alerta">Novo cadastro</span>}
                  {p.situacao !== "ativa" && <span className="selo-alerta">{NOME_SITUACAO[p.situacao]}</span>}
                </span>
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-suave" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
