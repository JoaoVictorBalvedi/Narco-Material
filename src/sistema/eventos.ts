import type { PoolClient } from "pg";
import { dataValida } from "./datas";
import { naoEncontrado, regraViolada, semPermissao } from "./erros";
import type { Contexto } from "./index";
import { rotuloDoItem } from "./inventario";
import { pode } from "./permissoes";
import type { Aviso } from "./portas";

export const TIPOS_EVENTO = ["Desafio", "Apresentação", "Rua de Fogo", "Ensaio geral", "Outro"];
export const FUNCOES = ["montar", "guardar", "transportar", "responder"] as const;
export type Funcao = (typeof FUNCOES)[number];
export const ETAPAS = ["conferencia", "carga", "descarga"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const NOME_FUNCAO: Record<Funcao, string> = {
  montar: "Monta", guardar: "Guarda", transportar: "Transporta", responder: "Responde pelo material",
};
export const NOME_ETAPA: Record<Etapa, string> = {
  conferencia: "Conferência", carga: "Carga", descarga: "Descarga",
};

export type DadosEvento = {
  nome: string; tipo: string; dataInicio: string; dataFim: string; local?: string;
  observacoes?: string; antecedenciaDias?: number; kitEmergencia?: boolean;
};

type Avancar = (tx: PoolClient, avisar: (a: Aviso) => void, itemId: string) => Promise<void>;

export function criarEventos(ctx: Contexto, avancarFila: Avancar) {
  const { pool, relogio, emTransacao, linhas, exigir, auditarAlvo, destinatarios } = ctx;

  function validar(dados: DadosEvento) {
    if (!dados.nome.trim()) throw regraViolada("Informe o nome do evento.");
    if (!dataValida(dados.dataInicio) || !dataValida(dados.dataFim)) throw regraViolada("Informe as datas.");
    if (dados.dataFim < dados.dataInicio) throw regraViolada("O fim precisa ser depois do início.");
    const antecedencia = dados.antecedenciaDias ?? 2;
    if (!Number.isInteger(antecedencia) || antecedencia < 0) throw regraViolada("Informe a antecedência em dias.");
  }

  async function travarEvento(tx: PoolClient, id: string) {
    const { rows } = await tx.query<{ id: string; nome: string }>(`select id, nome from eventos where id = $1 for update`, [id]);
    if (!rows[0]) throw naoEncontrado("Evento");
    return rows[0];
  }

  /** Avisa quem aprova se a reserva cruza um empréstimo já existente. A decisão é da pessoa. */
  async function alertarConflitos(tx: PoolClient, avisar: (a: Aviso) => void, eventoId: string, itemId: string) {
    const { rows } = await tx.query<{ evento: string; item: string; codigo: string | null; pessoa: string }>(
      `select ev.nome as evento, i.nome as item, i.codigo, p.nome as pessoa
       from eventos ev
       join evento_itens ei on ei.evento_id = ev.id
       join itens i on i.id = ei.item_id
       join emprestimos e on e.item_id = i.id
       join perfis p on p.id = e.responsavel_id
       where ev.id = $1 and i.id = $2 and i.tipo = 'individual' and ei.reserva_liberada_em is null
         and e.situacao in ('aprovado', 'retirado', 'devolvido') and not (e.situacao = 'aprovado' and e.em_fila)
         and daterange((ev.data_inicio - ev.antecedencia_dias)::date, ev.data_fim, '[]')
           && daterange(e.data_retirada, greatest(e.data_devolucao, e.data_retirada), '[]')`,
      [eventoId, itemId],
    );
    for (const c of rows) {
      for (const id of await destinatarios(tx, "aprovar_emprestimos")) {
        avisar({
          destinatarioId: id,
          tipo: "conflito_evento",
          titulo: "Conflito entre evento e empréstimo",
          corpo: `${rotuloDoItem({ codigo: c.codigo, nome: c.item })} está com ${c.pessoa} no período de reserva de ${c.evento}.`,
          link: `/eventos/${eventoId}`,
        });
      }
    }
    return rows.length;
  }

  async function podeMarcar(db: Pick<PoolClient, "query">, atorId: string, eventoId: string) {
    const ator = await exigir(db, atorId, "ver_eventos");
    if (pode(ator, "gerenciar_eventos")) return;
    const { rowCount } = await db.query(
      `select 1 from evento_responsaveis where evento_id = $1 and pessoa_id = $2
       union select 1 from evento_itens where evento_id = $1 and responsavel_id = $2`,
      [eventoId, atorId],
    );
    if (!rowCount) throw semPermissao();
  }

  return {
    async listar(atorId: string) {
      await exigir(pool, atorId, "ver_eventos");
      return linhas<{ id: string; nome: string; tipo: string; dataInicio: string; dataFim: string; local: string | null; totalItens: number; exemplo: boolean }>(
        `select e.id, e.nome, e.tipo, e.data_inicio::text as "dataInicio", e.data_fim::text as "dataFim", e.local, e.exemplo,
           (select count(*)::int from evento_itens ei where ei.evento_id = e.id) as "totalItens"
         from eventos e order by e.data_inicio desc limit 100`,
      );
    },

    async obter(atorId: string, eventoId: string) {
      await exigir(pool, atorId, "ver_eventos");
      const [evento] = await linhas<{
        id: string; nome: string; tipo: string; dataInicio: string; dataFim: string; local: string | null;
        observacoes: string | null; antecedenciaDias: number; kitEmergencia: boolean; inicioReserva: string;
      }>(
        `select id, nome, tipo, data_inicio::text as "dataInicio", data_fim::text as "dataFim", local, observacoes,
           antecedencia_dias as "antecedenciaDias", kit_emergencia as "kitEmergencia",
           (data_inicio - antecedencia_dias)::text as "inicioReserva"
         from eventos where id = $1`,
        [eventoId],
      );
      if (!evento) throw naoEncontrado("Evento");
      const [itens, responsaveis, escala, checklist] = await Promise.all([
        linhas<{
          itemId: string; rotulo: string; tipo: "individual" | "estoque"; quantidade: number; responsavelId: string | null;
          responsavelNome: string | null; reservaLiberadaEm: Date | null; comQuem: string | null;
        }>(
          `select ei.item_id as "itemId", coalesce(i.codigo || ' ', '') || i.nome || coalesce(' ' || i.variacao, '') as rotulo,
             i.tipo, ei.quantidade, ei.responsavel_id as "responsavelId", r.nome as "responsavelNome",
             ei.reserva_liberada_em as "reservaLiberadaEm",
             (select p.nome from emprestimos em join perfis p on p.id = em.responsavel_id
               where em.item_id = i.id and em.situacao in ('retirado', 'devolvido') limit 1) as "comQuem"
           from evento_itens ei join itens i on i.id = ei.item_id left join perfis r on r.id = ei.responsavel_id
           where ei.evento_id = $1 order by i.codigo nulls last, i.nome`,
          [eventoId],
        ),
        linhas<{ pessoaId: string; pessoaNome: string; funcao: Funcao }>(
          `select r.pessoa_id as "pessoaId", p.nome as "pessoaNome", r.funcao
           from evento_responsaveis r join perfis p on p.id = r.pessoa_id
           where r.evento_id = $1 order by r.funcao, p.nome`,
          [eventoId],
        ),
        linhas<{ itemId: string; pessoaId: string; pessoaNome: string }>(
          `select e.item_id as "itemId", e.pessoa_id as "pessoaId", p.nome as "pessoaNome"
           from evento_escala e join perfis p on p.id = e.pessoa_id
           where e.evento_id = $1 order by p.nome`,
          [eventoId],
        ),
        linhas<{ alvo: string; etapa: Etapa; marcadoPorNome: string | null; marcadoEm: Date }>(
          `select c.alvo, c.etapa, p.nome as "marcadoPorNome", c.marcado_em as "marcadoEm"
           from evento_checklist c left join perfis p on p.id = c.marcado_por where c.evento_id = $1`,
          [eventoId],
        ),
      ]);
      return { evento, itens, responsaveis, escala, checklist };
    },

    async criar(atorId: string, dados: DadosEvento): Promise<string> {
      validar(dados);
      return emTransacao(async (tx) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        const { rows } = await tx.query<{ id: string }>(
          `insert into eventos (nome, tipo, data_inicio, data_fim, local, observacoes, antecedencia_dias, kit_emergencia, criado_por, criado_em)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [
            dados.nome.trim(), dados.tipo, dados.dataInicio, dados.dataFim, dados.local?.trim() || null,
            dados.observacoes?.trim() || null, dados.antecedenciaDias ?? 2, dados.kitEmergencia ?? true, atorId, relogio.agora(),
          ],
        );
        await auditarAlvo(tx, atorId, "evento_criado", "evento", rows[0].id, dados.nome.trim());
        return rows[0].id;
      });
    },

    async editar(atorId: string, eventoId: string, dados: DadosEvento) {
      validar(dados);
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        await travarEvento(tx, eventoId);
        await tx.query(
          `update eventos set nome = $1, tipo = $2, data_inicio = $3, data_fim = $4, local = $5, observacoes = $6,
             antecedencia_dias = $7, kit_emergencia = $8 where id = $9`,
          [
            dados.nome.trim(), dados.tipo, dados.dataInicio, dados.dataFim, dados.local?.trim() || null,
            dados.observacoes?.trim() || null, dados.antecedenciaDias ?? 2, dados.kitEmergencia ?? true, eventoId,
          ],
        );
        const itens = await tx.query<{ item_id: string }>(`select item_id from evento_itens where evento_id = $1`, [eventoId]);
        for (const { item_id } of itens.rows) {
          await alertarConflitos(tx, avisar, eventoId, item_id);
          await avancarFila(tx, avisar, item_id);
        }
        await auditarAlvo(tx, atorId, "evento_editado", "evento", eventoId, dados.nome.trim());
      });
    },

    async remover(atorId: string, eventoId: string) {
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        const evento = await travarEvento(tx, eventoId);
        const itens = await tx.query<{ item_id: string }>(`select item_id from evento_itens where evento_id = $1`, [eventoId]);
        await tx.query(`delete from eventos where id = $1`, [eventoId]);
        for (const { item_id } of itens.rows) await avancarFila(tx, avisar, item_id);
        await auditarAlvo(tx, atorId, "evento_removido", "evento", eventoId, evento.nome);
      });
    },

    /** Item individual fica reservado pelo período do evento. Devolve quantos conflitos foram alertados. */
    async adicionarItem(atorId: string, eventoId: string, dados: { itemId: string; quantidade?: number; responsavelId?: string | null }) {
      const quantidade = dados.quantidade ?? 1;
      if (!Number.isInteger(quantidade) || quantidade <= 0) throw regraViolada("Informe a quantidade.");
      return emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        await travarEvento(tx, eventoId);
        const item = await tx.query(`select 1 from itens where id = $1`, [dados.itemId]);
        if (!item.rowCount) throw naoEncontrado("Item");
        const { rowCount } = await tx.query(
          `insert into evento_itens (evento_id, item_id, quantidade, responsavel_id) values ($1, $2, $3, $4)
           on conflict do nothing`,
          [eventoId, dados.itemId, quantidade, dados.responsavelId ?? null],
        );
        if (!rowCount) throw regraViolada("Esse item já está no evento.");
        return alertarConflitos(tx, avisar, eventoId, dados.itemId);
      });
    },

    async atualizarItem(atorId: string, eventoId: string, itemId: string, dados: { quantidade?: number; responsavelId: string | null }) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        await tx.query(
          `update evento_itens set quantidade = coalesce($1, quantidade), responsavel_id = $2 where evento_id = $3 and item_id = $4`,
          [dados.quantidade ?? null, dados.responsavelId, eventoId, itemId],
        );
      });
    },

    async removerItem(atorId: string, eventoId: string, itemId: string) {
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        await tx.query(`delete from evento_itens where evento_id = $1 and item_id = $2`, [eventoId, itemId]);
        await tx.query(`delete from evento_escala where evento_id = $1 and item_id = $2`, [eventoId, itemId]);
        await tx.query(`delete from evento_checklist where evento_id = $1 and alvo = $2`, [eventoId, itemId]);
        await avancarFila(tx, avisar, itemId);
      });
    },

    /** Exceção do diretor: o item continua no evento, mas volta a poder ser emprestado. */
    async liberarReserva(atorId: string, eventoId: string, itemId: string) {
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "aprovar_emprestimos");
        const { rowCount } = await tx.query(
          `update evento_itens set reserva_liberada_em = $1, reserva_liberada_por = $2
           where evento_id = $3 and item_id = $4 and reserva_liberada_em is null`,
          [relogio.agora(), atorId, eventoId, itemId],
        );
        if (!rowCount) return;
        await auditarAlvo(tx, atorId, "reserva_liberada", "evento", eventoId, "reserva de item do evento", { itemId });
        await avancarFila(tx, avisar, itemId);
      });
    },

    async definirResponsaveis(atorId: string, eventoId: string, funcao: Funcao, pessoaIds: string[]) {
      if (!FUNCOES.includes(funcao)) throw regraViolada("Função inválida.");
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        const evento = await travarEvento(tx, eventoId);
        const antes = await tx.query<{ pessoa_id: string }>(
          `select pessoa_id from evento_responsaveis where evento_id = $1 and funcao = $2`,
          [eventoId, funcao],
        );
        const anteriores = new Set(antes.rows.map((r) => r.pessoa_id));
        await tx.query(`delete from evento_responsaveis where evento_id = $1 and funcao = $2`, [eventoId, funcao]);
        for (const pessoaId of new Set(pessoaIds)) {
          await tx.query(`insert into evento_responsaveis (evento_id, pessoa_id, funcao) values ($1, $2, $3)`, [eventoId, pessoaId, funcao]);
          if (!anteriores.has(pessoaId)) {
            avisar({
              destinatarioId: pessoaId,
              tipo: "evento_responsavel",
              titulo: "Você tem uma tarefa em um evento",
              corpo: `${NOME_FUNCAO[funcao]}: ${evento.nome}.`,
              link: `/eventos/${eventoId}`,
            });
          }
        }
      });
    },

    /** Escala da bateria oficial. Apenas informa: nunca bloqueia empréstimos. */
    async definirEscala(atorId: string, eventoId: string, itemId: string, pessoaIds: string[]) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "gerenciar_eventos");
        await travarEvento(tx, eventoId);
        await tx.query(`delete from evento_escala where evento_id = $1 and item_id = $2`, [eventoId, itemId]);
        for (const pessoaId of new Set(pessoaIds)) {
          await tx.query(`insert into evento_escala (evento_id, item_id, pessoa_id) values ($1, $2, $3)`, [eventoId, itemId, pessoaId]);
        }
      });
    },

    /** Marca ou desmarca uma linha da checklist. `alvo` é o id do item ou "kit". */
    async marcarChecklist(atorId: string, eventoId: string, alvo: string, etapa: Etapa, marcado: boolean) {
      if (!ETAPAS.includes(etapa)) throw regraViolada("Etapa inválida.");
      await emTransacao(async (tx) => {
        await podeMarcar(tx, atorId, eventoId);
        if (!marcado) {
          await tx.query(`delete from evento_checklist where evento_id = $1 and alvo = $2 and etapa = $3`, [eventoId, alvo, etapa]);
          return;
        }
        await tx.query(
          `insert into evento_checklist (evento_id, alvo, etapa, marcado_por, marcado_em) values ($1, $2, $3, $4, $5)
           on conflict (evento_id, alvo, etapa) do update set marcado_por = excluded.marcado_por, marcado_em = excluded.marcado_em`,
          [eventoId, alvo, etapa, atorId, relogio.agora()],
        );
      });
    },
  };
}
