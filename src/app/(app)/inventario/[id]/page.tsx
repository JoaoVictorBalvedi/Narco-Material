import { ArrowLeft, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampoFoto } from "@/componentes/campo-foto";
import { CamposGasto } from "@/componentes/campos-gasto";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { SeloDisponibilidade } from "@/componentes/selo-disponibilidade";
import { formatarData, formatarDataHora, formatarMoeda, ID_VALIDO } from "@/lib/formato";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { ErroSistema } from "@/sistema/erros";
import { NOME_ESTADO } from "@/sistema/inventario";
import { pode } from "@/sistema/permissoes";
import { CampoTermo, CamposPedido } from "@/componentes/campos-pedido";
import { meusEmprestimos } from "@/lib/pendencias";
import { precisaAprovacao } from "@/sistema/emprestimos";
import { devolver, entrarNaFila, pedir as pedirEmprestimo } from "../../emprestimos/acoes";
import {
  adicionarFoto,
  adicionarVideo,
  avisarProblema,
  definirEscalaEnsaio,
  definirManutencao,
  editarItem,
  movimentarEstoque,
  registrarManutencao,
  removerItem,
  removerMidia,
  resolverProblema,
} from "../acoes";
import { ESTADOS_OPCOES } from "../opcoes";

export const metadata = { title: "Item | Narcóticos Material" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ator = await atorAtual();
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const ficha = await sistema.inventario.obter(ator.id, id).catch((erro) => {
    if (erro instanceof ErroSistema && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  });
  const { item } = ficha;

  const individual = item.tipo === "individual";
  const pedir = pode(ator, "pedir_emprestimo");
  const editar = pode(ator, "editar_inventario");
  const custos = pode(ator, "lancar_custos");
  const manutencao = editar || custos;
  const fila = pode(ator, "ver_responsavel") && individual ? await sistema.emprestimos.filaDoItem(ator.id, id) : [];
  const meus = pedir && individual ? await meusEmprestimos(ator.id) : null;
  const comigo = meus?.ativos.find((e) => e.itemId === id && e.situacao === "retirado" && e.responsavelId === ator.id);
  const semAprovacao = !precisaAprovacao(ator, 3);
  const reservas = individual ? await sistema.emprestimos.reservasDoItem(ator.id, id) : [];
  const [categorias, todos, membros] = await Promise.all([
    editar ? sistema.inventario.categorias.listar(ator.id) : [],
    manutencao ? sistema.inventario.listar(ator.id) : [],
    editar && individual ? sistema.pessoas.listarMembros(ator.id) : [],
  ]);
  const estoques = todos.filter((i) => i.tipo === "estoque");
  const outros = todos.filter((i) => i.tipo === "individual" && i.id !== id);
  const hoje = dataLocal(new Date());
  const naEscala = new Set(ficha.escala.map((e) => e.id));
  const jaNaFila = fila.some((f) => f.pessoaId === ator.id);
  const disponivel = item.disponibilidade === "disponivel";
  const podeEntrarNaFila = pedir && individual && !disponivel && item.disponibilidade !== "fora_de_uso" && !jaNaFila && !comigo;

  return (
    <>
      <Link href="/inventario" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Inventário
      </Link>

      {ficha.fotos.length > 0 && (
        <ul className="-mx-4 mb-3 flex snap-x gap-2 overflow-x-auto px-4">
          {ficha.fotos.map((f) => (
            <li key={f.id} className="shrink-0 snap-start">
              <Image src={f.url} alt={`Foto de ${item.nome}`} width={280} height={280} unoptimized className="h-56 w-56 rounded-xl object-cover" />
              {editar && ficha.fotos.length > 1 && (
                <Formulario acao={removerMidia}>
                  <input type="hidden" name="midiaId" value={f.id} />
                  <BotaoEnviar variante="secundario" className="mt-1 w-full"><Trash2 aria-hidden size={16} /> Remover foto</BotaoEnviar>
                </Formulario>
              )}
            </li>
          ))}
        </ul>
      )}

      <h1 className="text-2xl font-bold break-words">{item.nome}{item.variacao ? ` ${item.variacao}` : ""}</h1>
      <p className="mb-2 text-sm text-suave">{[item.codigo, item.grupo === item.categoria ? item.grupo : `${item.grupo} › ${item.categoria}`].filter(Boolean).join(" · ")}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        <SeloDisponibilidade valor={item.disponibilidade} />
        <span className="selo">{NOME_ESTADO[item.estado]}</span>
        {item.exemplo && <span className="selo">Exemplo</span>}
      </div>
      {item.descricao && <p className="mb-3 text-sm whitespace-pre-wrap">{item.descricao}</p>}

      <div className="space-y-3">
        <section className="cartao text-sm">
          <dl className="space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-suave">Localização</dt><dd className="text-right font-medium">{item.comQuem ? `Com ${item.comQuem}` : item.localizacao}</dd></div>
            {item.devolucaoPrevista && <div className="flex justify-between gap-3"><dt className="text-suave">Devolução prevista</dt><dd className="font-medium">{formatarData(item.devolucaoPrevista)}</dd></div>}
            {item.eventoReservado && <div className="flex justify-between gap-3"><dt className="text-suave">Reservado para</dt><dd className="text-right font-medium">{item.eventoReservado}</dd></div>}
            {!individual && <div className="flex justify-between gap-3"><dt className="text-suave">Quantidade</dt><dd className="font-medium">{item.quantidade}{item.quantidadeMinima !== null ? ` (mínimo ${item.quantidadeMinima})` : ""}</dd></div>}
            {ficha.totalInvestidoCentavos !== null && <div className="flex justify-between gap-3"><dt className="text-suave">Total investido</dt><dd className="font-medium">{formatarMoeda(ficha.totalInvestidoCentavos)}</dd></div>}
          </dl>
        </section>

        {comigo && (
          <section className="cartao border-marca">
            <h2 className="font-semibold">Está com você</h2>
            <p className="mb-3 text-sm text-suave">Devolva até {formatarData(comigo.dataDevolucao!)}.</p>
            <Formulario acao={devolver.bind(null, comigo.id)}>
              <BotaoEnviar className="w-full">Devolvi na salinha</BotaoEnviar>
              <details className="sanfona">
                <summary className="text-sm font-medium text-suave">Avisar algum problema na devolução</summary>
                <input name="problema" aria-label="Problema no item" placeholder="O que aconteceu?…" autoComplete="off" className="campo mb-1" />
              </details>
            </Formulario>
            <Link href="/emprestimos" className="link-acao">Mais tempo ou passar para alguém</Link>
          </section>
        )}

        {pedir && individual && disponivel && !comigo && (
          <section className="cartao">
            <h2 className="mb-3 text-lg font-semibold">Pegar emprestado</h2>
            <Formulario acao={pedirEmprestimo.bind(null, null)} className="space-y-4">
              <input type="hidden" name="itens" value={id} />
              <CamposPedido hoje={hoje} />
              {semAprovacao && <CampoTermo name="agora" rotulo="Vou pegar agora e aceito o termo" obrigatorio={false} />}
              <BotaoEnviar className="w-full text-base">{semAprovacao ? "Confirmar" : "Pedir este item"}</BotaoEnviar>
            </Formulario>
            {reservas.length > 0 && (
              <p className="mt-3 text-xs text-suave">
                Já reservado: {reservas.map((r) => `${formatarData(r.inicio)} a ${formatarData(r.fim)}`).join("; ")}.
              </p>
            )}
          </section>
        )}

        {individual && !comigo && (fila.length > 0 || podeEntrarNaFila || jaNaFila) && (
          <section className="cartao">
            <h2 className="mb-1 text-lg font-semibold">Fila de espera</h2>
            {fila.length > 0 ? (
              <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
                {fila.map((f) => <li key={f.pessoaId}>{f.pessoaNome}{f.situacao === "vez" ? " (é a vez)" : ""}</li>)}
              </ol>
            ) : (
              <p className="mb-3 text-sm text-suave">Ninguém na fila ainda.</p>
            )}
            {podeEntrarNaFila && (
              <Formulario acao={entrarNaFila.bind(null, id)} className="space-y-4">
                <p className="text-sm text-suave">O pedido já vai junto. Quando chegar a sua vez, você tem 24 horas para retirar.</p>
                <CamposPedido comDatas={false} />
                <BotaoEnviar className="w-full">Entrar na fila</BotaoEnviar>
              </Formulario>
            )}
            {jaNaFila && <p className="text-sm font-medium">Você está nessa fila. Avisamos quando chegar a sua vez.</p>}
          </section>
        )}

        {ficha.videos.map((v) => (
          <section key={v.id} className="cartao">
            {v.embutido ? (
              <iframe src={v.embutido} title={`Vídeo de ${item.nome}`} allowFullScreen loading="lazy" className="aspect-video w-full rounded-lg" />
            ) : (
              <a href={v.url} rel="noreferrer" target="_blank" className="text-sm font-medium text-marca">Abrir vídeo</a>
            )}
            {editar && (
              <Formulario acao={removerMidia}>
                <input type="hidden" name="midiaId" value={v.id} />
                <BotaoEnviar variante="secundario" className="mt-2 w-full">Remover vídeo</BotaoEnviar>
              </Formulario>
            )}
          </section>
        ))}

        {ficha.escala.length > 0 && (
          <section className="cartao text-sm">
            <h2 className="mb-1 font-semibold">Escala de ensaio</h2>
            <p>{ficha.escala.map((e) => e.nome).join(", ")}</p>
          </section>
        )}

        <section className="cartao">
          <h2 className="mb-2 font-semibold">Histórico de manutenção</h2>
          {ficha.manutencoes.length === 0 && <p className="text-sm text-suave">Nenhum registro.</p>}
          <ul className="space-y-2">
            {ficha.manutencoes.map((m) => (
              <li key={m.id} className="border-b border-borda pb-2 text-sm last:border-0 last:pb-0">
                <p className="font-medium">{m.servico}</p>
                <p className="text-xs text-suave">
                  {[formatarData(m.data), m.quemFez, m.valorCentavos !== null ? formatarMoeda(m.valorCentavos) : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {!individual && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Entradas e saídas</h2>
            {ficha.estoque.length === 0 && <p className="text-sm text-suave">Nenhum registro.</p>}
            <ul className="space-y-2 text-sm">
              {ficha.estoque.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.tipo === "entrada" ? "+" : "−"}{e.quantidade}</span>
                  {e.motivo ? ` ${e.motivo}` : ""}
                  <span className="block text-xs text-suave">{[formatarDataHora(e.criadoEm), e.valorCentavos !== null ? formatarMoeda(e.valorCentavos) : null].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {individual && ficha.usos.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Quem já usou</h2>
            <ul className="space-y-1 text-sm">
              {ficha.usos.map((u) => (
                <li key={`${u.pessoaNome}${u.aceitoEm.toISOString()}`}>
                  {u.pessoaNome} <span className="text-xs text-suave">· {formatarDataHora(u.aceitoEm)}{u.origem === "repasse" ? " · repasse" : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ficha.problemas.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Problemas informados</h2>
            <ul className="space-y-2 text-sm">
              {ficha.problemas.map((p) => (
                <li key={p.id}>
                  <p>{p.descricao}</p>
                  <p className="text-xs text-suave">
                    {[p.autorNome, formatarDataHora(p.criadoEm), p.resolvidoEm ? "Resolvido" : null].filter(Boolean).join(" · ")}
                  </p>
                  {editar && !p.resolvidoEm && (
                    <Formulario acao={resolverProblema}>
                      <input type="hidden" name="problemaId" value={p.id} />
                      <BotaoEnviar variante="secundario" className="mt-1">Marcar como resolvido</BotaoEnviar>
                    </Formulario>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pode(ator, "avisar_problema") && (
          <details className="cartao sanfona">
            <summary>Avisar sobre um problema</summary>
            <Formulario acao={avisarProblema.bind(null, id)} limparAoSalvar className="space-y-2 pt-1">
              <textarea name="descricao" rows={3} required aria-label="Descreva o problema" placeholder="O que aconteceu?" className="campo py-2" />
              <BotaoEnviar className="w-full">Enviar aviso</BotaoEnviar>
            </Formulario>
          </details>
        )}

        {(manutencao || editar) && <h2 className="pt-3 text-lg font-semibold">Gerenciar</h2>}

        {manutencao && (
          <details className="cartao sanfona">
            <summary>Registrar reforma ou troca</summary>
            <Formulario acao={registrarManutencao.bind(null, id)} limparAoSalvar className="space-y-3 pt-1">
              <div>
                <label htmlFor="servico" className="rotulo">O que foi feito</label>
                <input id="servico" name="servico" required className="campo" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="data" className="rotulo">Data</label>
                  <input id="data" name="data" type="date" max={hoje} defaultValue={hoje} required className="campo" />
                </div>
                <div>
                  <label htmlFor="quemFez" className="rotulo">Quem fez</label>
                  <input id="quemFez" name="quemFez" className="campo" />
                </div>
              </div>
              {editar && estoques.length > 0 && (
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div>
                    <label htmlFor="pecaId" className="rotulo">Peça do estoque (opcional)</label>
                    <select id="pecaId" name="pecaId" className="campo">
                      <option value="">Nenhuma</option>
                      {estoques.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.variacao ? ` ${e.variacao}` : ""} ({e.quantidade})</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pecaQuantidade" className="rotulo">Qtd.</label>
                    <input id="pecaQuantidade" name="pecaQuantidade" type="number" min={1} defaultValue={1} className="campo" />
                  </div>
                </div>
              )}
              {custos && <CamposGasto />}
              {outros.length > 0 && (
                <details className="sanfona">
                  <summary>Incluir outros itens</summary>
                  <p className="mb-1 text-xs text-suave">O valor é dividido igualmente entre os itens.</p>
                  <div className="max-h-56 overflow-y-auto">
                    {outros.map((o) => (
                      <label key={o.id} className="opcao"><input type="checkbox" name="outrosItens" value={o.id} /> {o.codigo} {o.nome}</label>
                    ))}
                  </div>
                </details>
              )}
              <BotaoEnviar className="w-full">Registrar</BotaoEnviar>
            </Formulario>
          </details>
        )}

        {editar && !individual && (
          <details className="cartao sanfona">
            <summary>Dar entrada ou saída</summary>
            <Formulario acao={movimentarEstoque.bind(null, id)} limparAoSalvar className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="tipoMov" className="rotulo">Tipo</label>
                  <select id="tipoMov" name="tipo" className="campo">
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="quantidadeMov" className="rotulo">Quantidade</label>
                  <input id="quantidadeMov" name="quantidade" type="number" min={1} required inputMode="numeric" className="campo" />
                </div>
              </div>
              <div>
                <label htmlFor="motivoMov" className="rotulo">Motivo</label>
                <input id="motivoMov" name="motivo" className="campo" />
              </div>
              {custos && <CamposGasto ajuda="Preencha o valor se for uma compra." />}
              <BotaoEnviar className="w-full">Salvar</BotaoEnviar>
            </Formulario>
          </details>
        )}

        {editar && individual && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">{item.disponibilidade === "manutencao" ? "Em manutenção" : "Manutenção"}</h2>
            <Formulario acao={definirManutencao.bind(null, id)}>
              {item.disponibilidade === "manutencao"
                ? <BotaoEnviar name="manutencao" value="nao" className="w-full">Encerrar manutenção</BotaoEnviar>
                : <BotaoEnviar name="manutencao" value="sim" variante="secundario" className="w-full">Colocar em manutenção</BotaoEnviar>}
            </Formulario>
          </section>
        )}

        {editar && individual && membros.length > 0 && (
          <details className="cartao sanfona">
            <summary>Escala de ensaio</summary>
            <Formulario acao={definirEscalaEnsaio.bind(null, id)} className="pt-1">
              <p className="mb-1 text-xs text-suave">Apenas informativa: não bloqueia empréstimos.</p>
              <div className="max-h-56 overflow-y-auto">
                {membros.map((m) => (
                  <label key={m.id} className="opcao"><input type="checkbox" name="pessoas" value={m.id} defaultChecked={naEscala.has(m.id)} /> {m.nome}</label>
                ))}
              </div>
              <BotaoEnviar variante="secundario" className="mt-2 w-full">Salvar escala</BotaoEnviar>
            </Formulario>
          </details>
        )}

        {editar && (
          <details className="cartao sanfona">
            <summary>Adicionar foto ou vídeo</summary>
            <div className="space-y-4 pt-1">
              <Formulario acao={adicionarFoto.bind(null, id)} limparAoSalvar className="space-y-2">
                <CampoFoto rotulo="Nova foto" />
                <BotaoEnviar variante="secundario" className="w-full">Adicionar foto</BotaoEnviar>
              </Formulario>
              <Formulario acao={adicionarVideo.bind(null, id)} limparAoSalvar className="space-y-2">
                <div>
                  <label htmlFor="url" className="rotulo">Link do YouTube ou do Google Drive</label>
                  <input id="url" name="url" type="url" required inputMode="url" className="campo" />
                </div>
                <BotaoEnviar variante="secundario" className="w-full">Adicionar vídeo</BotaoEnviar>
              </Formulario>
            </div>
          </details>
        )}

        {editar && (
          <details className="cartao sanfona">
            <summary>Editar dados</summary>
            <Formulario acao={editarItem.bind(null, id)} className="space-y-3 pt-1">
              <div>
                <label htmlFor="nomeEd" className="rotulo">Nome</label>
                <input id="nomeEd" name="nome" required defaultValue={item.nome} className="campo" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="categoriaEd" className="rotulo">Categoria</label>
                  <select id="categoriaEd" name="categoriaId" defaultValue={item.categoriaId} className="campo">
                    {categorias.map((c) => (
                      <optgroup key={c.id} label={c.nome}>
                        <option value={c.id}>{c.tipos.length ? `Outro em ${c.nome}` : c.nome}</option>
                        {c.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="estadoEd" className="rotulo">Estado</label>
                  <select id="estadoEd" name="estado" defaultValue={item.estado} className="campo">
                    {ESTADOS_OPCOES.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="codigoEd" className="rotulo">Código</label>
                  <input id="codigoEd" name="codigo" defaultValue={item.codigo ?? ""} required={individual} className="campo" />
                </div>
                <div>
                  <label htmlFor="variacaoEd" className="rotulo">Variação</label>
                  <input id="variacaoEd" name="variacao" defaultValue={item.variacao ?? ""} className="campo" />
                </div>
              </div>
              <div>
                <label htmlFor="localEd" className="rotulo">Localização</label>
                <input id="localEd" name="localizacao" defaultValue={item.localizacao} className="campo" />
              </div>
              {!individual && (
                <div>
                  <label htmlFor="minimoEd" className="rotulo">Quantidade mínima</label>
                  <input id="minimoEd" name="quantidadeMinima" type="number" min={0} defaultValue={item.quantidadeMinima ?? ""} className="campo" />
                </div>
              )}
              <div>
                <label htmlFor="descricaoEd" className="rotulo">Descrição</label>
                <textarea id="descricaoEd" name="descricao" rows={3} defaultValue={item.descricao ?? ""} className="campo py-2" />
              </div>
              <BotaoEnviar className="w-full">Salvar dados</BotaoEnviar>
            </Formulario>
            <Formulario acao={removerItem.bind(null, id)} className="mt-3">
              <p className="mb-1 text-xs text-suave">Remover serve para cadastros feitos por engano. Item com histórico deve ficar como “Fora de uso”.</p>
              <label className="opcao"><input type="checkbox" name="confirmo" value="sim" required /> Confirmo que quero remover</label>
              <BotaoEnviar variante="secundario" className="w-full">Remover item</BotaoEnviar>
            </Formulario>
          </details>
        )}
      </div>
    </>
  );
}
