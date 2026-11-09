import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { CampoTermo } from "@/componentes/campos-pedido";
import { FotoItem } from "@/componentes/foto-item";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { formatarData, formatarDataHora } from "@/lib/formato";
import { somarDias } from "@/sistema/datas";
import type { EmprestimoVisto, RenovacaoVista, RepasseVisto } from "@/sistema/emprestimos";
import { ESTADOS, NOME_ESTADO } from "@/sistema/inventario";
import {
  cancelarEmprestimo,
  concluirRepasse,
  conferir,
  decidirPedido,
  decidirRenovacao,
  decidirRepasse,
  devolver,
  pedirRenovacao,
  proporRepasse,
  responderRepasse,
  retirar,
} from "./acoes";

type Acao = (anterior: { erro?: string; sucesso?: string }, dados: FormData) => Promise<{ erro?: string; sucesso?: string }>;

function Cabecalho({ e, selo }: { e: Pick<EmprestimoVisto, "itemId" | "itemRotulo" | "itemFotoUrl">; selo?: React.ReactNode }) {
  return (
    <Link href={`/inventario/${e.itemId}`} className="flex items-center gap-3">
      <FotoItem url={e.itemFotoUrl} tamanho={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{e.itemRotulo}</span>
        {selo}
      </span>
    </Link>
  );
}

const Periodo = ({ e }: { e: EmprestimoVisto }) =>
  e.dataRetirada && e.dataDevolucao ? (
    <>{formatarData(e.dataRetirada)} a {formatarData(e.dataDevolucao)}</>
  ) : (
    <>{e.dias} {e.dias === 1 ? "dia" : "dias"}, a partir da retirada</>
  );

/** Aprovar em um toque. Recusar pede o motivo, então fica um passo atrás. */
function Decisao({ acao, rotulo = "Aprovar" }: { acao: Acao; rotulo?: string }) {
  return (
    <div className="mt-3">
      <Formulario acao={acao}>
        <BotaoEnviar name="decisao" value="aprovar" className="w-full">{rotulo}</BotaoEnviar>
      </Formulario>
      <details className="sanfona">
        <summary className="text-sm font-medium text-suave">Recusar</summary>
        <Formulario acao={acao} className="space-y-2 pb-1">
          <input name="justificativa" required aria-label="Motivo da recusa" placeholder="Motivo da recusa…" autoComplete="off" className="campo" />
          <BotaoEnviar name="decisao" value="recusar" variante="secundario" className="w-full">Confirmar recusa</BotaoEnviar>
        </Formulario>
      </details>
    </div>
  );
}

function Fila({ nomes }: { nomes: string[] }) {
  if (!nomes.length) return null;
  return <p className="mt-2 rounded-lg bg-alerta-suave p-2 text-xs font-medium text-alerta">Na fila: {nomes.join(", ")}</p>;
}

export function CartaoPedido({ e }: { e: EmprestimoVisto }) {
  return (
    <li className="cartao">
      <Cabecalho e={e} selo={<span className="block truncate text-sm text-suave">{e.solicitanteNome}</span>} />
      <p className="mt-2 text-sm"><Periodo e={e} />{e.motivo ? ` · ${e.motivo}` : ""}</p>
      {e.justificativaPrazo && <p className="mt-1 text-sm"><strong>Prazo maior:</strong> {e.justificativaPrazo}</p>}
      {e.posicaoFila && (
        <p className="mt-1 text-xs font-medium text-alerta">
          Pela fila, na posição {e.posicaoFila}{e.filaSituacao === "vez" ? ". O item já está livre." : ""}
        </p>
      )}
      <Decisao acao={decidirPedido.bind(null, e.id)} />
    </li>
  );
}

export function CartaoRenovacao({ r }: { r: RenovacaoVista }) {
  return (
    <li className="cartao">
      <p className="font-semibold">{r.itemRotulo}</p>
      <p className="text-sm text-suave">{r.responsavelNome} quer ficar até {formatarData(r.novaData)} (hoje vai até {formatarData(r.dataDevolucao)})</p>
      {r.motivo && <p className="mt-1 text-sm">{r.motivo}</p>}
      <Fila nomes={r.filaNomes} />
      <Decisao acao={decidirRenovacao.bind(null, r.id)} rotulo="Aprovar mais tempo" />
    </li>
  );
}

export function CartaoRepasseDecidir({ r }: { r: RepasseVisto }) {
  return (
    <li className="cartao">
      <p className="font-semibold">{r.itemRotulo}</p>
      <p className="text-sm text-suave">De {r.deNome} para {r.paraNome}, até {formatarData(r.dataDevolucao)}</p>
      <Fila nomes={r.filaNomes} />
      <Decisao acao={decidirRepasse.bind(null, r.id)} rotulo="Aprovar repasse" />
    </li>
  );
}

export function CartaoConferir({ e }: { e: EmprestimoVisto }) {
  return (
    <li className="cartao">
      <Cabecalho e={e} selo={<span className="block truncate text-sm text-suave">Devolvido por {e.responsavelNome}</span>} />
      {e.problemaDevolucao && (
        <p className="mt-2 flex gap-1 rounded-lg bg-alerta-suave p-2 text-sm font-medium text-alerta">
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0" /> {e.problemaDevolucao}
        </p>
      )}
      {e.filaTotal > 0 && <p className="mt-1 text-xs text-suave">{e.filaTotal} na fila: liberar avisa o primeiro.</p>}
      <Formulario acao={conferir.bind(null, e.id)} className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          <BotaoEnviar name="resultado" value="manutencao" variante="secundario">Manutenção</BotaoEnviar>
          <BotaoEnviar name="resultado" value="liberado">Está tudo bem</BotaoEnviar>
        </div>
        <details className="sanfona">
          <summary className="text-sm font-medium text-suave">Atualizar o estado do item</summary>
          <select name="estado" defaultValue="" aria-label="Estado do item" className="campo mb-1">
            <option value="">Manter como está</option>
            {ESTADOS.map((v) => <option key={v} value={v}>{NOME_ESTADO[v]}</option>)}
          </select>
        </details>
      </Formulario>
    </li>
  );
}

export function CartaoRepasseRecebido({ r }: { r: RepasseVisto }) {
  return (
    <li className="cartao">
      <p className="font-semibold">{r.itemRotulo}</p>
      <p className="text-sm text-suave">{r.deNome} quer passar para você. O prazo continua até {formatarData(r.dataDevolucao)}.</p>
      {r.situacao === "aguardando_aceite" && (
        <Formulario acao={responderRepasse.bind(null, r.id)} className="mt-3 grid grid-cols-2 gap-2">
          <BotaoEnviar name="resposta" value="recusar" variante="secundario">Não quero</BotaoEnviar>
          <BotaoEnviar name="resposta" value="aceitar">Aceitar</BotaoEnviar>
        </Formulario>
      )}
      {r.situacao === "aguardando_aprovacao" && <p className="mt-2 text-sm text-suave">Aguardando a aprovação do Diretor de Material.</p>}
      {r.situacao === "aprovado" && (
        <Formulario acao={concluirRepasse.bind(null, r.id)} className="mt-3 space-y-2">
          <input name="observacao" aria-label="Como o item está" placeholder="Como o item está? (opcional)…" autoComplete="off" className="campo" />
          <CampoTermo />
          <BotaoEnviar className="w-full">Recebi o item</BotaoEnviar>
        </Formulario>
      )}
    </li>
  );
}

const SITUACAO_MINHA: Record<EmprestimoVisto["situacao"], string> = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
  retirado: "Com você",
  devolvido: "Aguardando conferência",
  conferido: "Devolvido",
};

/** Um cartão por empréstimo, com a próxima ação já visível. */
export function CartaoMeu({
  e,
  atorId,
  hoje,
  membros,
  renovacao,
  repasse,
}: {
  e: EmprestimoVisto;
  atorId: string;
  hoje: string;
  membros: { id: string; nome: string }[];
  renovacao?: { novaData: string };
  repasse?: RepasseVisto;
}) {
  const naVez = e.filaSituacao === "vez" && e.vezExpiraEm;
  const podeRetirar = e.situacao === "aprovado" && e.responsavelId === atorId && (!e.emFila || naVez);
  const comigo = e.situacao === "retirado" && e.responsavelId === atorId;
  const selo = e.atrasado ? (
    <span className="selo-marca mt-1">Atrasado desde {formatarData(e.dataDevolucao!)}</span>
  ) : comigo ? (
    <span className="mt-1 block text-sm text-suave">Devolver até {formatarData(e.dataDevolucao!)}</span>
  ) : e.emFila && e.filaSituacao === "aguardando" ? (
    <span className="selo mt-1">Você é o {e.posicaoFila}º da fila</span>
  ) : naVez ? (
    <span className="selo-alerta mt-1">É a sua vez</span>
  ) : (
    <span className="mt-1 block text-sm text-suave">{SITUACAO_MINHA[e.situacao]} · <Periodo e={e} /></span>
  );

  return (
    <li className="cartao">
      <Cabecalho e={e} selo={selo} />

      {naVez && <p className="mt-2 text-sm font-medium">Retire até {formatarDataHora(e.vezExpiraEm!)}, ou a vez passa para o próximo.</p>}
      {e.filaSituacao === "vez" && !e.vezExpiraEm && <p className="mt-2 text-sm">O item está guardado para você. Falta aprovarem o pedido.</p>}

      {podeRetirar && (
        <Formulario acao={retirar.bind(null, e.id)} className="mt-3 space-y-2">
          <CampoTermo />
          <BotaoEnviar className="w-full">Peguei o item</BotaoEnviar>
        </Formulario>
      )}

      {comigo && (
        <>
          <Formulario acao={devolver.bind(null, e.id)} className="mt-3">
            <BotaoEnviar className="w-full">Devolvi na salinha</BotaoEnviar>
            <details className="sanfona">
              <summary className="text-sm font-medium text-suave">Avisar algum problema na devolução</summary>
              <input name="problema" aria-label="Problema no item" placeholder="O que aconteceu?…" autoComplete="off" className="campo mb-1" />
            </details>
          </Formulario>
          {!e.atrasado && (
            <div className="divide-y divide-borda border-t border-borda">
              <details className="sanfona">
                <summary className="text-sm font-medium">Preciso de mais tempo</summary>
                {renovacao ? (
                  <p className="pb-3 text-sm text-suave">Pedido até {formatarData(renovacao.novaData)}, aguardando decisão.</p>
                ) : (
                  <Formulario acao={pedirRenovacao.bind(null, e.id)} className="space-y-2 pb-3">
                    {e.filaTotal > 0 && <p className="text-xs text-suave">Tem gente na fila: o diretor decide vendo quem espera.</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <input name="novaData" type="date" required aria-label="Nova data de devolução" min={somarDias(e.dataDevolucao!, 1)} defaultValue={somarDias(e.dataDevolucao!, 2)} className="campo" />
                      <input name="motivo" required aria-label="Motivo" placeholder="Motivo…" autoComplete="off" className="campo" />
                    </div>
                    <BotaoEnviar variante="secundario" className="w-full">Pedir mais tempo</BotaoEnviar>
                  </Formulario>
                )}
              </details>
              {e.dataDevolucao! >= hoje && (
                <details className="sanfona">
                  <summary className="text-sm font-medium">Passar para outra pessoa</summary>
                  {repasse ? (
                    <p className="pb-3 text-sm text-suave">
                      Para {repasse.paraNome}: {repasse.situacao === "aguardando_aceite" ? "esperando a pessoa aceitar." : repasse.situacao === "aguardando_aprovacao" ? "esperando aprovação." : "aprovado, falta entregar."}
                    </p>
                  ) : (
                    <Formulario acao={proporRepasse.bind(null, e.id)} className="space-y-2 pb-3">
                      <p className="text-xs text-suave">Quem recebe fica com o mesmo prazo. Você continua responsável até a entrega.</p>
                      <select name="para" required defaultValue="" aria-label="Para quem" className="campo">
                        <option value="" disabled>Escolha a pessoa</option>
                        {membros.filter((m) => m.id !== atorId).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                      <BotaoEnviar variante="secundario" className="w-full">Propor repasse</BotaoEnviar>
                    </Formulario>
                  )}
                </details>
              )}
            </div>
          )}
        </>
      )}

      {(e.situacao === "pendente" || e.situacao === "aprovado") && e.solicitanteId === atorId && (
        <details className="sanfona mt-1">
          <summary className="text-sm font-medium text-suave">{e.emFila ? "Sair da fila" : "Cancelar pedido"}</summary>
          <Formulario acao={cancelarEmprestimo.bind(null, e.id)} className="pb-1">
            <BotaoEnviar variante="secundario" className="w-full">{e.emFila ? "Confirmar: sair da fila" : "Confirmar cancelamento"}</BotaoEnviar>
          </Formulario>
        </details>
      )}
    </li>
  );
}

export function Secao({ titulo, total, acao, children }: { titulo: string; total?: number; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {titulo} {total !== undefined && <span className="selo">{total}</span>}
        </h2>
        {acao}
      </div>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}
