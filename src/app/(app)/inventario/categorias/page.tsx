import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { iconeCategoria } from "@/componentes/icone-categoria";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { removerCategoria, salvarCategoria } from "../acoes";

export const metadata = { title: "Categorias | Narcóticos Material" };

function CamposCategoria({ nome, prefixo }: { nome?: string; prefixo?: string }) {
  return (
    <div className="grid grid-cols-[1fr_6rem] gap-2">
      <div className="min-w-0">
        <label className="rotulo">Nome<input name="nome" required defaultValue={nome} className="campo mt-1 font-normal" /></label>
      </div>
      <div>
        <label className="rotulo">Sigla<input name="prefixo" required defaultValue={prefixo} maxLength={5} className="campo mt-1 font-normal uppercase" /></label>
      </div>
    </div>
  );
}

export default async function Page() {
  const ator = await exigirAcao("editar_inventario");
  const categorias = await sistema.inventario.categorias.listar(ator.id);
  return (
    <>
      <Link href="/inventario" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Inventário
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Categorias</h1>
      <p className="mb-4 text-sm text-suave">
        Cada categoria pode ter tipos: Instrumentos tem Caixa, Surdo e outros. A sigla forma o código das peças, como CX-07.
      </p>

      <ul className="space-y-3">
        {categorias.map((c) => {
          const Icone = iconeCategoria(c.prefixo);
          const total = c.total + c.tipos.reduce((soma, t) => soma + t.total, 0);
          return (
            <li key={c.id} className="cartao">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Icone aria-hidden size={22} className="shrink-0 text-marca" />
                <span className="min-w-0 flex-1">{c.nome}</span>
                <span className="selo">{total} {total === 1 ? "item" : "itens"}</span>
              </h2>

              {c.tipos.length > 0 && (
                <ul className="mt-2 divide-y divide-borda">
                  {c.tipos.map((t) => (
                    <li key={t.id}>
                      <details className="sanfona">
                        <summary className="text-sm font-medium">
                          <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                          <span className="selo">{t.prefixo} · {t.total}</span>
                        </summary>
                        <Formulario acao={salvarCategoria} className="space-y-2 pb-3">
                          <input type="hidden" name="id" value={t.id} />
                          <CamposCategoria nome={t.nome} prefixo={t.prefixo} />
                          <BotaoEnviar variante="secundario" className="w-full">Salvar</BotaoEnviar>
                        </Formulario>
                        {t.total === 0 && (
                          <Formulario acao={removerCategoria} className="pb-3">
                            <input type="hidden" name="id" value={t.id} />
                            <BotaoEnviar variante="secundario" className="w-full">Remover {t.nome}</BotaoEnviar>
                          </Formulario>
                        )}
                      </details>
                    </li>
                  ))}
                </ul>
              )}

              <details className="sanfona mt-1 border-t border-borda">
                <summary className="text-sm font-medium text-marca">Adicionar tipo em {c.nome}</summary>
                <Formulario acao={salvarCategoria} limparAoSalvar className="space-y-2 pb-2">
                  <input type="hidden" name="paiId" value={c.id} />
                  <CamposCategoria />
                  <BotaoEnviar variante="secundario" className="w-full">Adicionar tipo</BotaoEnviar>
                </Formulario>
              </details>
              <details className="sanfona border-t border-borda">
                <summary className="text-sm font-medium text-suave">Editar {c.nome}</summary>
                <Formulario acao={salvarCategoria} className="space-y-2 pb-2">
                  <input type="hidden" name="id" value={c.id} />
                  <CamposCategoria nome={c.nome} prefixo={c.prefixo} />
                  <BotaoEnviar variante="secundario" className="w-full">Salvar</BotaoEnviar>
                </Formulario>
                {total === 0 && c.tipos.length === 0 && (
                  <Formulario acao={removerCategoria} className="pb-2">
                    <input type="hidden" name="id" value={c.id} />
                    <BotaoEnviar variante="secundario" className="w-full">Remover categoria</BotaoEnviar>
                  </Formulario>
                )}
              </details>
            </li>
          );
        })}
      </ul>

      <section className="cartao mt-3">
        <h2 className="mb-2 font-semibold">Nova categoria principal</h2>
        <Formulario acao={salvarCategoria} limparAoSalvar className="space-y-2">
          <CamposCategoria />
          <label className="opcao"><input type="checkbox" name="tipoPadrao" value="estoque" /> Normalmente controlada por quantidade</label>
          <BotaoEnviar variante="secundario" className="w-full">Criar categoria</BotaoEnviar>
        </Formulario>
      </section>
    </>
  );
}
