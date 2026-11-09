import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { formatarData, ID_VALIDO } from "@/lib/formato";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { ErroSistema } from "@/sistema/erros";
import { ETAPAS, FUNCOES, NOME_ETAPA, NOME_FUNCAO } from "@/sistema/eventos";
import { pode } from "@/sistema/permissoes";
import {
  adicionarItem,
  atualizarItem,
  definirEscala,
  definirResponsaveis,
  editarEvento,
  liberarReserva,
  marcarChecklist,
  removerEvento,
  removerItemDoEvento,
} from "../acoes";
import { CamposEvento } from "../campos-evento";

export const metadata = { title: "Evento | Narcóticos Material" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirAcao("ver_eventos");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();
  const dados = await sistema.eventos.obter(ator.id, id).catch((erro) => {
    if (erro instanceof ErroSistema && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  });
  const { evento, itens, responsaveis, escala, checklist } = dados;
  const gerenciar = pode(ator, "gerenciar_eventos");
  const liberar = pode(ator, "aprovar_emprestimos");
  const podeMarcar = gerenciar || responsaveis.some((r) => r.pessoaId === ator.id) || itens.some((i) => i.responsavelId === ator.id);
  const [todos, membros] = await Promise.all([
    gerenciar ? sistema.inventario.listar(ator.id) : [],
    sistema.pessoas.listarMembros(ator.id),
  ]);
  const noEvento = new Set(itens.map((i) => i.itemId));
  const disponiveis = todos.filter((i) => !noEvento.has(i.id));
  const linhasChecklist = [
    ...itens.map((i) => ({ alvo: i.itemId, rotulo: i.rotulo + (i.tipo === "estoque" ? ` (${i.quantidade})` : "") })),
    ...(evento.kitEmergencia ? [{ alvo: "kit", rotulo: "Kit de emergência" }] : []),
  ];
  const marcados = new Map(checklist.map((c) => [`${c.alvo}:${c.etapa}`, c.marcadoPorNome]));

  return (
    <>
      <Link href="/eventos" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Eventos
      </Link>
      <h1 className="text-2xl font-bold break-words">{evento.nome}</h1>
      <p className="text-sm text-suave">
        {[evento.tipo, formatarData(evento.dataInicio) + (evento.dataFim !== evento.dataInicio ? ` a ${formatarData(evento.dataFim)}` : ""), evento.local].filter(Boolean).join(" · ")}
      </p>
      <p className="mb-3 text-xs text-suave">Itens reservados a partir de {formatarData(evento.inicioReserva)}.</p>
      {evento.observacoes && <p className="mb-3 text-sm whitespace-pre-wrap">{evento.observacoes}</p>}

      <div className="space-y-3">
        <section className="cartao">
          <h2 className="mb-2 font-semibold">Material</h2>
          {itens.length === 0 && <p className="text-sm text-suave">Nenhum item separado ainda.</p>}
          <ul className="divide-y divide-borda">
            {itens.map((i) => {
              const pessoas = escala.filter((e) => e.itemId === i.itemId);
              const naEscala = new Set(pessoas.map((p) => p.pessoaId));
              return (
                <li key={i.itemId} className="py-2 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <Link href={`/inventario/${i.itemId}`} className="underline-offset-2 hover:underline">{i.rotulo}</Link>
                    {i.tipo === "estoque" && <span className="selo">{i.quantidade} un.</span>}
                    {i.reservaLiberadaEm && <span className="selo">Reserva liberada</span>}
                    {i.comQuem && <span className="selo-alerta">Com {i.comQuem}</span>}
                  </p>
                  <p className="text-xs text-suave">
                    {[i.responsavelNome ? `Responde: ${i.responsavelNome}` : null, pessoas.length ? `Toca: ${pessoas.map((p) => p.pessoaNome).join(", ")}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {(gerenciar || liberar) && (
                    <details className="sanfona mt-1">
                      <summary className="text-sm">Ajustar</summary>
                      <div className="space-y-3 pb-1">
                        {gerenciar && (
                          <Formulario acao={atualizarItem.bind(null, id, i.itemId)} className="space-y-2">
                            <div className={i.tipo === "estoque" ? "grid grid-cols-[1fr_5rem] gap-2" : ""}>
                              <div>
                                <label htmlFor={`resp-${i.itemId}`} className="rotulo">Quem responde pelo item</label>
                                <select id={`resp-${i.itemId}`} name="responsavelId" defaultValue={i.responsavelId ?? ""} className="campo">
                                  <option value="">Ninguém</option>
                                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                              </div>
                              {i.tipo === "estoque" && (
                                <div>
                                  <label htmlFor={`qtd-${i.itemId}`} className="rotulo">Qtd.</label>
                                  <input id={`qtd-${i.itemId}`} name="quantidade" type="number" min={1} defaultValue={i.quantidade} className="campo" />
                                </div>
                              )}
                            </div>
                            <BotaoEnviar variante="secundario" className="w-full">Salvar</BotaoEnviar>
                          </Formulario>
                        )}
                        {gerenciar && i.tipo === "individual" && (
                          <Formulario acao={definirEscala.bind(null, id, i.itemId)}>
                            <p className="rotulo">Escala da bateria oficial</p>
                            <div className="max-h-48 overflow-y-auto">
                              {membros.map((m) => (
                                <label key={m.id} className="opcao"><input type="checkbox" name="pessoas" value={m.id} defaultChecked={naEscala.has(m.id)} /> {m.nome}</label>
                              ))}
                            </div>
                            <BotaoEnviar variante="secundario" className="mt-1 w-full">Salvar escala</BotaoEnviar>
                          </Formulario>
                        )}
                        {liberar && i.tipo === "individual" && !i.reservaLiberadaEm && (
                          <Formulario acao={liberarReserva.bind(null, id, i.itemId)}>
                            <BotaoEnviar variante="secundario" className="w-full">Liberar a reserva deste item</BotaoEnviar>
                          </Formulario>
                        )}
                        {gerenciar && (
                          <Formulario acao={removerItemDoEvento.bind(null, id, i.itemId)}>
                            <BotaoEnviar variante="secundario" className="w-full">Tirar do evento</BotaoEnviar>
                          </Formulario>
                        )}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {gerenciar && (
            <Formulario acao={adicionarItem.bind(null, id)} className="mt-3 space-y-2 border-t border-borda pt-3" limparAoSalvar>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <div>
                  <label htmlFor="itemId" className="rotulo">Adicionar item</label>
                  <select id="itemId" name="itemId" required defaultValue="" className="campo">
                    <option value="" disabled>Escolha</option>
                    {disponiveis.map((i) => <option key={i.id} value={i.id}>{[i.codigo, i.nome, i.variacao].filter(Boolean).join(" ")}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="quantidade" className="rotulo">Qtd.</label>
                  <input id="quantidade" name="quantidade" type="number" min={1} defaultValue={1} className="campo" />
                </div>
              </div>
              <BotaoEnviar variante="secundario" className="w-full">Adicionar ao evento</BotaoEnviar>
            </Formulario>
          )}
        </section>

        {linhasChecklist.length > 0 && (
          <section className="cartao">
            <h2 className="mb-2 font-semibold">Checklist</h2>
            <ul className="divide-y divide-borda">
              {linhasChecklist.map((l) => (
                <li key={l.alvo} className="py-2 first:pt-0 last:pb-0">
                  <p className="mb-1 text-sm font-medium">{l.rotulo}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {ETAPAS.map((etapa) => {
                      const chave = `${l.alvo}:${etapa}`;
                      const feito = marcados.has(chave);
                      const quem = marcados.get(chave);
                      if (!podeMarcar) {
                        return <span key={etapa} className={`flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs ${feito ? "border-sucesso bg-sucesso-suave text-sucesso" : "border-borda text-suave"}`}>{NOME_ETAPA[etapa]}{quem && <span className="max-w-full truncate px-1 text-[10px]">{quem}</span>}</span>;
                      }
                      return (
                        <Formulario key={etapa} acao={marcarChecklist.bind(null, id, l.alvo, etapa, !feito)}>
                          <button type="submit" aria-pressed={feito} className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg border text-xs font-medium ${feito ? "border-sucesso bg-sucesso-suave text-sucesso" : "border-borda bg-superficie text-suave"}`}>
                            <span className="flex items-center gap-1">{feito && <Check aria-hidden size={14} />}{NOME_ETAPA[etapa]}</span>
                            {quem && <span className="max-w-full truncate px-1 text-[10px] font-normal">{quem}</span>}
                          </button>
                        </Formulario>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cartao">
          <h2 className="mb-2 font-semibold">Responsáveis</h2>
          <ul className="divide-y divide-borda">
            {FUNCOES.map((funcao) => {
              const atuais = responsaveis.filter((r) => r.funcao === funcao);
              const ids = new Set(atuais.map((r) => r.pessoaId));
              const resumo = atuais.length ? atuais.map((r) => r.pessoaNome).join(", ") : "Ninguém ainda";
              if (!gerenciar) {
                return (
                  <li key={funcao} className="py-2 text-sm first:pt-0 last:pb-0">
                    <span className="font-medium">{NOME_FUNCAO[funcao]}:</span> {resumo}
                  </li>
                );
              }
              return (
                <li key={funcao}>
                  <details className="sanfona">
                    <summary className="text-sm">
                      <span className="min-w-0 flex-1"><span className="block">{NOME_FUNCAO[funcao]}</span><span className="block truncate text-xs font-normal text-suave">{resumo}</span></span>
                    </summary>
                    <Formulario acao={definirResponsaveis.bind(null, id, funcao)} className="pb-2">
                      <div className="max-h-48 overflow-y-auto">
                        {membros.map((m) => (
                          <label key={m.id} className="opcao"><input type="checkbox" name="pessoas" value={m.id} defaultChecked={ids.has(m.id)} /> {m.nome}</label>
                        ))}
                      </div>
                      <BotaoEnviar variante="secundario" className="mt-1 w-full">Salvar</BotaoEnviar>
                    </Formulario>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        {gerenciar && (
          <details className="cartao sanfona">
            <summary>Editar evento</summary>
            <Formulario acao={editarEvento.bind(null, id)} className="space-y-3 pt-1">
              <CamposEvento valores={evento} />
              <BotaoEnviar className="w-full">Salvar evento</BotaoEnviar>
            </Formulario>
            <Formulario acao={removerEvento.bind(null, id)} className="mt-3">
              <BotaoEnviar variante="secundario" className="w-full">Remover evento</BotaoEnviar>
            </Formulario>
          </details>
        )}
      </div>
    </>
  );
}
