import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { ErroSistema } from "@/sistema/erros";
import {
  CARGOS,
  CATEGORIAS,
  NOME_CARGO,
  NOME_CATEGORIA,
  NOME_PERMISSAO,
  NOME_SITUACAO,
  PERMISSOES_DELEGAVEIS,
  pode,
} from "@/sistema/permissoes";
import { formatarDataHora, ID_VALIDO } from "@/lib/formato";
import { mudarPermissao, mudarSituacao, salvarPapel, transferirCargo } from "../acoes";

export const metadata = { title: "Pessoa | Narcóticos Material" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirAcao("definir_papeis");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();

  const pessoa = await sistema.pessoas.obter(ator.id, id).catch((erro) => {
    if (erro instanceof ErroSistema && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  });

  const ehEuMesmo = ator.id === pessoa.id;
  const ehDiretorMaterial = pessoa.cargo === "diretor_material";
  const podeDelegar = pode(ator, "delegar_permissoes") && pessoa.cargo && !ehDiretorMaterial;
  const delegacoes = podeDelegar ? await sistema.permissoes.listar(ator.id, pessoa.id) : [];
  const podeTransferir =
    pode(ator, "transferir_cargo_material") && !ehDiretorMaterial && pessoa.situacao === "ativa" && !ehEuMesmo;
  const cargoEditavel = !ehEuMesmo && !ehDiretorMaterial;

  return (
    <>
      <Link href="/pessoas" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Pessoas
      </Link>
      <h1 className="text-2xl font-bold break-words">{pessoa.nome}</h1>
      <p className="mb-4 text-sm break-all text-suave">{pessoa.email}</p>

      <div className="space-y-4">
        <section className="cartao">
          <h2 className="mb-3 font-semibold">Papel</h2>
          <Formulario acao={salvarPapel.bind(null, pessoa.id)} className="space-y-3">
            <div>
              <label htmlFor="categoria" className="rotulo">Categoria</label>
              <select id="categoria" name="categoria" defaultValue={pessoa.categoria ?? ""} className="campo">
                <option value="">Sem categoria</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{NOME_CATEGORIA[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cargo" className="rotulo">Cargo na diretoria</label>
              {cargoEditavel ? (
                <select id="cargo" name="cargo" defaultValue={pessoa.cargo ?? ""} className="campo">
                  <option value="">Sem cargo</option>
                  {CARGOS.filter((c) => c !== "diretor_material").map((c) => (
                    <option key={c} value={c}>{NOME_CARGO[c]}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" name="cargo" value={pessoa.cargo ?? ""} />
                  <p id="cargo" className="text-sm">{pessoa.cargo ? NOME_CARGO[pessoa.cargo] : "Sem cargo"}</p>
                  <p className="mt-1 text-xs text-suave">
                    {ehDiretorMaterial ? "Este cargo só muda por transferência." : "Outro diretor precisa alterar o seu cargo."}
                  </p>
                </>
              )}
            </div>
            <BotaoEnviar className="w-full">Salvar papel</BotaoEnviar>
          </Formulario>
        </section>

        {podeDelegar && (
          <section className="cartao">
            <h2 className="mb-1 font-semibold">Permissões delegadas</h2>
            <p className="mb-3 text-sm text-suave">Você pode conceder e retirar quando quiser.</p>
            <Formulario acao={mudarPermissao.bind(null, pessoa.id)}>
              <ul className="space-y-2">
                {PERMISSOES_DELEGAVEIS.map((p) => {
                  const atual = delegacoes.find((d) => d.permissao === p);
                  return (
                    <li key={p} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{NOME_PERMISSAO[p]}</span>
                        {atual && (
                          <span className="block text-xs text-suave">
                            Por {atual.concedidaPorNome ?? "conta removida"} em {formatarDataHora(atual.concedidaEm)}
                          </span>
                        )}
                      </span>
                      <BotaoEnviar
                        variante={atual ? "secundario" : "principal"}
                        className="shrink-0"
                        name="mudanca"
                        value={`${atual ? "retirar" : "conceder"}:${p}`}
                      >
                        {atual ? "Retirar" : "Conceder"}
                      </BotaoEnviar>
                    </li>
                  );
                })}
              </ul>
            </Formulario>
          </section>
        )}

        {!ehEuMesmo && (
          <section className="cartao">
            <h2 className="mb-1 font-semibold">Situação: {NOME_SITUACAO[pessoa.situacao]}</h2>
            <p className="mb-3 text-sm text-suave">Desativar encerra o acesso, mas mantém o histórico.</p>
            <Formulario acao={mudarSituacao.bind(null, pessoa.id)}>
              <div className="flex flex-wrap gap-2">
                {pessoa.situacao !== "ativa" && <BotaoEnviar variante="secundario" name="situacao" value="ativa">Reativar</BotaoEnviar>}
                {pessoa.situacao !== "suspensa" && <BotaoEnviar variante="secundario" name="situacao" value="suspensa">Suspender</BotaoEnviar>}
                {pessoa.situacao !== "desativada" && <BotaoEnviar variante="secundario" name="situacao" value="desativada">Desativar</BotaoEnviar>}
              </div>
            </Formulario>
          </section>
        )}

        {podeTransferir && (
          <section className="cartao">
            <h2 className="mb-1 font-semibold">Transferir cargo de Material</h2>
            <p className="mb-3 text-sm text-suave">
              {pessoa.nome} assume todos os poderes do cargo. O diretor atual vira membro comum, e o histórico é mantido.
            </p>
            <Formulario acao={transferirCargo.bind(null, pessoa.id)} className="space-y-3">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="confirmo" value="sim" required className="size-5 accent-marca" />
                Confirmo a transferência para esta pessoa
              </label>
              <BotaoEnviar className="w-full">Transferir cargo</BotaoEnviar>
            </Formulario>
          </section>
        )}
      </div>
    </>
  );
}
