import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { dataLocal, dataValida, diferencaDias, somarDias } from "./datas";
import { naoEncontrado, regraViolada, semPermissao } from "./erros";
import type { Contexto } from "./index";
import { rotuloDoItem } from "./inventario";
import { pode, type Ator } from "./permissoes";
import type { Aviso } from "./portas";

export const PRAZO_PADRAO_DIAS = 5;
export const HORAS_PARA_RETIRAR = 24;
export const VERSAO_TERMO = "2026-11";
export const TEXTO_TERMO =
  "Declaro que recebi este item em bom estado de uso, que vou zelar pela sua conservação e que vou devolvê-lo no prazo combinado. Sei que respondo por danos que eu causar, conforme o Art. 9º, III do Estatuto da Narcóticos.";

type Avisar = (a: Aviso) => void;

/** A diretoria só avisa, exceto acima do prazo padrão. O Diretor de Material decide os próprios pedidos. */
export const precisaAprovacao = (ator: Pick<Ator, "cargo">, dias: number) =>
  ator.cargo === "diretor_material" ? false : !ator.cargo || dias > PRAZO_PADRAO_DIAS;

type LinhaEmprestimo = {
  id: string;
  itemId: string;
  solicitanteId: string;
  responsavelId: string;
  situacao: "pendente" | "aprovado" | "recusado" | "cancelado" | "retirado" | "devolvido" | "conferido";
  dias: number;
  dataRetirada: string | null;
  dataDevolucao: string | null;
  emFila: boolean;
};

const COLUNAS = `e.id, e.item_id as "itemId", e.solicitante_id as "solicitanteId",
  e.responsavel_id as "responsavelId", e.situacao, e.dias,
  e.data_retirada::text as "dataRetirada", e.data_devolucao::text as "dataDevolucao", e.em_fila as "emFila"`;

export type EmprestimoVisto = LinhaEmprestimo & {
  itemRotulo: string;
  solicitanteNome: string;
  responsavelNome: string;
  motivo: string | null;
  justificativaPrazo: string | null;
  justificativaDecisao: string | null;
  problemaDevolucao: string | null;
  atrasado: boolean;
  filaTotal: number;
  posicaoFila: number | null;
  filaSituacao: "aguardando" | "vez" | null;
  vezExpiraEm: Date | null;
  itemFotoUrl: string | null;
};

export type RenovacaoVista = {
  id: string;
  emprestimoId: string;
  novaData: string;
  motivo: string | null;
  itemRotulo: string;
  responsavelNome: string;
  dataDevolucao: string;
  filaNomes: string[];
};

export type RepasseVisto = {
  id: string;
  emprestimoId: string;
  situacao: "aguardando_aceite" | "aguardando_aprovacao" | "aprovado";
  deId: string;
  deNome: string;
  paraId: string;
  paraNome: string;
  itemRotulo: string;
  dataDevolucao: string;
  filaNomes: string[];
};

const CONSULTA_VISTA = `
  select ${COLUNAS}, coalesce(i.codigo || ' ', '') || i.nome || coalesce(' ' || i.variacao, '') as "itemRotulo",
    s.nome as "solicitanteNome", r.nome as "responsavelNome", e.motivo,
    e.justificativa_prazo as "justificativaPrazo", e.justificativa_decisao as "justificativaDecisao",
    e.problema_devolucao as "problemaDevolucao",
    (e.situacao = 'retirado' and e.data_devolucao < $1::date) as atrasado,
    (select count(*)::int from fila_entradas f where f.item_id = e.item_id and f.situacao in ('aguardando', 'vez')) as "filaTotal",
    case when fe.id is null then null else (select count(*)::int + 1 from fila_entradas o where o.item_id = e.item_id
      and o.situacao in ('aguardando', 'vez') and o.ordem < fe.ordem) end as "posicaoFila",
    fe.situacao as "filaSituacao", fe.vez_expira_em as "vezExpiraEm",
    (select m.referencia from item_midias m where m.item_id = e.item_id and m.tipo = 'foto'
      order by m.criado_em limit 1) as "itemFoto"
  from emprestimos e
  join itens i on i.id = e.item_id
  join perfis s on s.id = e.solicitante_id
  join perfis r on r.id = e.responsavel_id
  left join fila_entradas fe on fe.emprestimo_id = e.id and fe.situacao in ('aguardando', 'vez')`;

export function criarEmprestimos(ctx: Contexto) {
  const { pool, relogio, arquivos, emTransacao, linhas, exigir, auditarAlvo, destinatarios } = ctx;

  const hoje = () => dataLocal(relogio.agora());

  /** Empréstimos com a foto do item, para os cartões ficarem fáceis de reconhecer. */
  async function vistos(sql: string, params: unknown[]): Promise<EmprestimoVisto[]> {
    const dados = await linhas<Omit<EmprestimoVisto, "itemFotoUrl"> & { itemFoto: string | null }>(sql, params);
    return dados.map(({ itemFoto, ...e }) => ({ ...e, itemFotoUrl: itemFoto ? arquivos.urlPublica(itemFoto) : null }));
  }

  async function travarItem(tx: PoolClient, id: string) {
    const { rows } = await tx.query<{
      id: string; nome: string; codigo: string | null; variacao: string | null; tipo: string;
      estado: string; emManutencao: boolean;
    }>(
      `select id, nome, codigo, variacao, tipo, estado, em_manutencao as "emManutencao"
       from itens where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw naoEncontrado("Item");
    return rows[0];
  }

  /** Trava primeiro o item, a mesma ordem das demais operações, para evitar deadlock. */
  async function travarEmprestimo(tx: PoolClient, id: string) {
    const achado = await tx.query<{ itemId: string }>(`select item_id as "itemId" from emprestimos where id = $1`, [id]);
    if (!achado.rows[0]) throw naoEncontrado("Empréstimo");
    const item = await travarItem(tx, achado.rows[0].itemId);
    const { rows } = await tx.query<LinhaEmprestimo>(`select ${COLUNAS} from emprestimos e where e.id = $1 for update`, [id]);
    return { emprestimo: rows[0], item };
  }

  /** O que impede usar o item no período, ou null. */
  async function conflito(
    tx: PoolClient,
    itemId: string,
    inicio: string,
    fim: string,
    ignorar?: string,
  ): Promise<string | null> {
    const agora = relogio.agora();
    const dia = dataLocal(agora);
    const emprestado = await tx.query(
      `select 1 from emprestimos e
       where e.item_id = $1 and e.id is distinct from $5 and (
         (e.situacao = 'aprovado' and not e.em_fila and e.data_devolucao >= $4::date
           and daterange(e.data_retirada, e.data_devolucao, '[]') && daterange($2::date, $3::date, '[]'))
         or (e.situacao = 'retirado'
           and daterange(e.data_retirada, greatest(e.data_devolucao, $4::date), '[]') && daterange($2::date, $3::date, '[]'))
         or (e.situacao = 'devolvido' and $2::date <= $4::date)
       ) limit 1`,
      [itemId, inicio, fim, dia, ignorar ?? null],
    );
    if (emprestado.rowCount) return "O item já está reservado ou emprestado nessas datas.";

    const guardado = await tx.query(
      `select 1 from fila_entradas f join emprestimos e on e.id = f.emprestimo_id
       where f.item_id = $1 and f.situacao = 'vez' and f.emprestimo_id is distinct from $5
         and (f.vez_expira_em is null or f.vez_expira_em > $2)
         and $3::date <= $4::date + e.dias`,
      [itemId, agora, inicio, dia, ignorar ?? null],
    );
    if (guardado.rowCount) return "O item está guardado para o primeiro da fila.";

    const evento = await tx.query<{ nome: string }>(
      `select e.nome from evento_itens ei join eventos e on e.id = ei.evento_id
       where ei.item_id = $1 and ei.reserva_liberada_em is null
         and daterange((e.data_inicio - e.antecedencia_dias)::date, e.data_fim, '[]') && daterange($2::date, $3::date, '[]')
       limit 1`,
      [itemId, inicio, fim],
    );
    return evento.rows[0] ? `O item está reservado para o evento ${evento.rows[0].nome}.` : null;
  }

  /**
   * Passa a vez na fila, se o item estiver livre. É chamada sempre que algo pode
   * ter liberado o item: conferência, fim de manutenção, reserva liberada ou 24 horas vencidas.
   */
  async function avancarFila(tx: PoolClient, avisar: Avisar, itemId: string) {
    const agora = relogio.agora();
    const item = await travarItem(tx, itemId);
    const rotulo = rotuloDoItem(item);

    const vencidas = await tx.query<{ pessoaId: string; emprestimoId: string }>(
      `update fila_entradas set situacao = 'expirada'
       where item_id = $1 and situacao = 'vez' and vez_expira_em <= $2
       returning pessoa_id as "pessoaId", emprestimo_id as "emprestimoId"`,
      [itemId, agora],
    );
    for (const vencida of vencidas.rows) {
      await tx.query(`update emprestimos set situacao = 'cancelado' where id = $1`, [vencida.emprestimoId]);
      avisar({
        destinatarioId: vencida.pessoaId,
        tipo: "fila_expirada",
        titulo: "Prazo para retirar encerrado",
        corpo: `As ${HORAS_PARA_RETIRAR} horas para retirar ${rotulo} passaram, e a vez seguiu para o próximo.`,
        link: `/inventario/${itemId}`,
      });
    }

    const ocupada = await tx.query(`select 1 from fila_entradas where item_id = $1 and situacao = 'vez'`, [itemId]);
    if (ocupada.rowCount || item.emManutencao || item.estado === "fora_de_uso") return;
    const fora = await tx.query(`select 1 from emprestimos where item_id = $1 and situacao in ('retirado', 'devolvido')`, [itemId]);
    if (fora.rowCount) return;

    const { rows } = await tx.query<{ id: string; pessoaId: string; emprestimoId: string; situacao: string; dias: number; pessoaNome: string }>(
      `select f.id, f.pessoa_id as "pessoaId", f.emprestimo_id as "emprestimoId", e.situacao, e.dias, p.nome as "pessoaNome"
       from fila_entradas f join emprestimos e on e.id = f.emprestimo_id join perfis p on p.id = f.pessoa_id
       where f.item_id = $1 and f.situacao = 'aguardando' order by f.ordem limit 1`,
      [itemId],
    );
    const primeiro = rows[0];
    if (!primeiro) return;

    const dia = dataLocal(agora);
    if (await conflito(tx, itemId, dia, somarDias(dia, primeiro.dias), primeiro.emprestimoId)) return;

    if (primeiro.situacao === "aprovado") {
      await darVez(tx, avisar, primeiro.id, primeiro.pessoaId, itemId, rotulo);
      return;
    }
    await tx.query(`update fila_entradas set situacao = 'vez', vez_desde = $1, vez_expira_em = null where id = $2`, [agora, primeiro.id]);
    avisar({
      destinatarioId: primeiro.pessoaId,
      tipo: "fila_vez",
      titulo: "O item foi liberado",
      corpo: `${rotulo} está guardado para você. Falta aprovarem o seu pedido.`,
      link: "/emprestimos",
    });
    for (const id of await destinatarios(tx, "aprovar_emprestimos", primeiro.pessoaId)) {
      avisar({
        destinatarioId: id,
        tipo: "pedido_pendente",
        titulo: "Pedido aguardando decisão",
        corpo: `${rotulo} foi liberado, e ${primeiro.pessoaNome} é o primeiro da fila. Decida o pedido para a fila andar.`,
        link: "/emprestimos",
      });
    }
  }

  async function darVez(tx: PoolClient, avisar: Avisar, entradaId: string, pessoaId: string, itemId: string, rotulo: string) {
    const agora = relogio.agora();
    await tx.query(
      `update fila_entradas set situacao = 'vez', vez_desde = coalesce(vez_desde, $1), vez_expira_em = $2 where id = $3`,
      [agora, new Date(agora.getTime() + HORAS_PARA_RETIRAR * 3_600_000), entradaId],
    );
    avisar({
      destinatarioId: pessoaId,
      tipo: "fila_vez",
      titulo: "É a sua vez",
      corpo: `${rotulo} foi liberado. Você tem ${HORAS_PARA_RETIRAR} horas para retirar.`,
      link: "/emprestimos",
    });
  }

  function validarDias(dias: number, justificativa?: string) {
    if (!Number.isInteger(dias) || dias <= 0) throw regraViolada("Informe por quantos dias você precisa do item.");
    if (dias > PRAZO_PADRAO_DIAS && !justificativa?.trim()) {
      throw regraViolada(`Para mais de ${PRAZO_PADRAO_DIAS} dias, informe uma justificativa.`);
    }
  }


  async function avisarPedido(tx: PoolClient, avisar: Avisar, ator: Ator, rotulo: string, aprovacao: boolean) {
    for (const id of await destinatarios(tx, "aprovar_emprestimos", ator.id)) {
      avisar({
        destinatarioId: id,
        tipo: aprovacao ? "pedido_criado" : "aviso_emprestimo",
        titulo: aprovacao ? "Novo pedido de empréstimo" : "Aviso de empréstimo",
        corpo: aprovacao ? `${ator.nome} pediu ${rotulo}.` : `${ator.nome} vai pegar ${rotulo}.`,
        link: "/emprestimos",
      });
    }
  }

  const ehResponsavel = (ator: Ator, e: LinhaEmprestimo) => ator.id === e.responsavelId;

  function nomesFila(campo: string) {
    return `coalesce((select array_agg(p.nome order by f.ordem) from fila_entradas f join perfis p on p.id = f.pessoa_id
      where f.item_id = ${campo} and f.situacao in ('aguardando', 'vez')), '{}') as "filaNomes"`;
  }

  async function encerrarAbertos(tx: PoolClient, emprestimoId: string) {
    await tx.query(`update renovacoes set situacao = 'cancelada' where emprestimo_id = $1 and situacao = 'pendente'`, [emprestimoId]);
    await tx.query(
      `update repasses set situacao = 'cancelado'
       where emprestimo_id = $1 and situacao in ('aguardando_aceite', 'aguardando_aprovacao', 'aprovado')`,
      [emprestimoId],
    );
  }

  return {
    avancarFila,

    /** Um ou mais itens. Cada item tem decisão e situação próprias. */
    async pedir(
      atorId: string,
      dados: { itemIds: string[]; dataRetirada: string; dataDevolucao: string; motivo: string; justificativaPrazo?: string },
    ): Promise<string[]> {
      if (!dados.itemIds.length) throw regraViolada("Escolha pelo menos um item.");
      if (!dataValida(dados.dataRetirada) || !dataValida(dados.dataDevolucao)) throw regraViolada("Informe as datas.");
      if (!dados.motivo.trim()) throw regraViolada("Informe o motivo.");
      if (dados.dataRetirada < hoje()) throw regraViolada("A retirada não pode ser no passado.");
      if (dados.dataDevolucao < dados.dataRetirada) throw regraViolada("A devolução precisa ser depois da retirada.");
      const dias = Math.max(diferencaDias(dados.dataRetirada, dados.dataDevolucao), 1);
      validarDias(dias, dados.justificativaPrazo);

      return emTransacao(async (tx, avisar) => {
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        const aprovacao = precisaAprovacao(ator, dias);
        const pedidoId = randomUUID();
        const ids: string[] = [];
        const rotulos: string[] = [];
        for (const itemId of [...new Set(dados.itemIds)].sort()) {
          const item = await travarItem(tx, itemId);
          const rotulo = rotuloDoItem(item);
          if (item.tipo !== "individual") throw regraViolada(`${rotulo} é de estoque e não é emprestado.`);
          if (item.estado === "fora_de_uso" || item.emManutencao) throw regraViolada(`${rotulo} não está disponível.`);
          const fila = await tx.query(`select 1 from fila_entradas where item_id = $1 and situacao in ('aguardando', 'vez')`, [itemId]);
          if (fila.rowCount) throw regraViolada(`${rotulo} tem fila de espera. Entre na fila para pegá-lo.`);
          const motivoConflito = await conflito(tx, itemId, dados.dataRetirada, dados.dataDevolucao);
          if (motivoConflito) throw regraViolada(`${rotulo}: ${motivoConflito}`);
          const { rows } = await tx.query<{ id: string }>(
            `insert into emprestimos (pedido_id, item_id, solicitante_id, responsavel_id, situacao, dias,
               data_retirada, data_devolucao, motivo, justificativa_prazo, criado_em)
             values ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
            [
              pedidoId, itemId, atorId, aprovacao ? "pendente" : "aprovado", dias, dados.dataRetirada,
              dados.dataDevolucao, dados.motivo.trim(), dados.justificativaPrazo?.trim() || null, relogio.agora(),
            ],
          );
          ids.push(rows[0].id);
          rotulos.push(rotulo);
        }
        await avisarPedido(tx, avisar, ator, rotulos.join(", "), aprovacao);
        return ids;
      });
    },

    async decidir(atorId: string, emprestimoId: string, decisao: { aprovar: boolean; justificativa?: string }) {
      await emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        await exigir(tx, atorId, "aprovar_emprestimos");
        if (e.situacao !== "pendente") throw regraViolada("Esse pedido já foi decidido.");
        const rotulo = rotuloDoItem(item);
        const justificativa = decisao.justificativa?.trim() || null;
        if (!decisao.aprovar && !justificativa) throw regraViolada("Informe o motivo da recusa.");
        if (decisao.aprovar && !e.emFila) {
          const motivo = await conflito(tx, e.itemId, e.dataRetirada!, e.dataDevolucao!, e.id);
          if (motivo) throw regraViolada(motivo);
        }
        await tx.query(
          `update emprestimos set situacao = $1, decidido_por = $2, decidido_em = $3, justificativa_decisao = $4 where id = $5`,
          [decisao.aprovar ? "aprovado" : "recusado", atorId, relogio.agora(), justificativa, e.id],
        );
        await auditarAlvo(tx, atorId, decisao.aprovar ? "emprestimo_aprovado" : "emprestimo_recusado", "item", e.itemId, rotulo);
        avisar({
          destinatarioId: e.solicitanteId,
          tipo: "pedido_decidido",
          titulo: decisao.aprovar ? "Pedido aprovado" : "Pedido recusado",
          corpo: decisao.aprovar
            ? e.emFila
              ? `Seu pedido de ${rotulo} foi aprovado. Você será avisado quando chegar a sua vez.`
              : `Seu pedido de ${rotulo} foi aprovado.`
            : `Seu pedido de ${rotulo} foi recusado: ${justificativa}`,
          link: "/emprestimos",
        });

        const entrada = await tx.query<{ id: string; situacao: string }>(
          `select id, situacao from fila_entradas where emprestimo_id = $1 and situacao in ('aguardando', 'vez')`,
          [e.id],
        );
        if (!entrada.rows[0]) return;
        if (!decisao.aprovar) {
          await tx.query(`update fila_entradas set situacao = 'recusada' where id = $1`, [entrada.rows[0].id]);
          await avancarFila(tx, avisar, e.itemId);
        } else if (entrada.rows[0].situacao === "vez") {
          await darVez(tx, avisar, entrada.rows[0].id, e.solicitanteId, e.itemId, rotulo);
        }
      });
    },

    /** Cancela pedido ou reserva: o próprio solicitante ou quem aprova empréstimos. Também tira da fila. */
    async cancelar(atorId: string, emprestimoId: string) {
      await emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        const ator = await exigir(tx, atorId, "ver_catalogo");
        const proprio = e.solicitanteId === atorId;
        if (!proprio && !pode(ator, "aprovar_emprestimos")) throw semPermissao();
        if (e.situacao !== "pendente" && e.situacao !== "aprovado") throw regraViolada("Esse empréstimo não pode mais ser cancelado.");
        await tx.query(`update emprestimos set situacao = 'cancelado' where id = $1`, [e.id]);
        await tx.query(`update fila_entradas set situacao = 'saiu' where emprestimo_id = $1 and situacao in ('aguardando', 'vez')`, [e.id]);
        await auditarAlvo(tx, atorId, "emprestimo_cancelado", "item", e.itemId, rotuloDoItem(item));
        if (!proprio) {
          avisar({
            destinatarioId: e.solicitanteId,
            tipo: "pedido_decidido",
            titulo: "Empréstimo cancelado",
            corpo: `A diretoria cancelou seu empréstimo de ${rotuloDoItem(item)}.`,
            link: "/emprestimos",
          });
        }
        await avancarFila(tx, avisar, e.itemId);
      });
    },

    /** Aceita o termo e pega o item. Os dias contam a partir daqui. */
    async retirar(atorId: string, emprestimoId: string, aceitouTermo: boolean) {
      if (!aceitouTermo) throw regraViolada("Aceite o termo de responsabilidade para retirar o item.");
      await emTransacao(async (tx) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        if (!ehResponsavel(ator, e)) throw semPermissao();
        if (e.situacao !== "aprovado") throw regraViolada("Esse empréstimo ainda não pode ser retirado.");
        if (item.emManutencao || item.estado === "fora_de_uso") throw regraViolada("O item não está disponível.");
        const fora = await tx.query(`select 1 from emprestimos where item_id = $1 and situacao in ('retirado', 'devolvido')`, [e.itemId]);
        if (fora.rowCount) throw regraViolada("O item ainda não voltou para a salinha.");

        const agora = relogio.agora();
        const dia = dataLocal(agora);
        if (e.emFila) {
          const entrada = await tx.query<{ id: string; expira: Date | null }>(
            `select id, vez_expira_em as expira from fila_entradas where emprestimo_id = $1 and situacao = 'vez'`,
            [e.id],
          );
          if (!entrada.rows[0]?.expira) throw regraViolada("Ainda não é a sua vez na fila.");
          if (entrada.rows[0].expira <= agora) throw regraViolada(`As ${HORAS_PARA_RETIRAR} horas para retirar já passaram.`);
          await tx.query(`update fila_entradas set situacao = 'retirado' where id = $1`, [entrada.rows[0].id]);
        } else {
          if (dia < e.dataRetirada!) throw regraViolada(`A retirada está marcada para ${e.dataRetirada}.`);
          if (dia > e.dataDevolucao!) throw regraViolada("O prazo dessa reserva já passou.");
        }

        let devolucao = somarDias(dia, e.dias);
        // Se o novo prazo invadir outra reserva, vale a data combinada no pedido.
        if (!e.emFila && (await conflito(tx, e.itemId, dia, devolucao, e.id))) devolucao = e.dataDevolucao!;
        await tx.query(
          `update emprestimos set situacao = 'retirado', retirado_em = $1, data_retirada = $2, data_devolucao = $3 where id = $4`,
          [agora, dia, devolucao, e.id],
        );
        await tx.query(
          `insert into termos_aceite (item_id, pessoa_id, emprestimo_id, origem, versao, aceito_em)
           values ($1, $2, $3, 'retirada', $4, $5)`,
          [e.itemId, atorId, e.id, VERSAO_TERMO, agora],
        );
        await auditarAlvo(tx, atorId, "item_retirado", "item", e.itemId, rotuloDoItem(item));
      });
    },

    async devolver(atorId: string, emprestimoId: string, problema?: string) {
      await emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        const ator = await exigir(tx, atorId, "ver_catalogo");
        if (!ehResponsavel(ator, e) && !pode(ator, "conferir_devolucoes")) throw semPermissao();
        if (e.situacao !== "retirado") throw regraViolada("Esse item não está emprestado.");
        const texto = problema?.trim() || null;
        const agora = relogio.agora();
        await tx.query(
          `update emprestimos set situacao = 'devolvido', devolvido_em = $1, problema_devolucao = $2 where id = $3`,
          [agora, texto, e.id],
        );
        await encerrarAbertos(tx, e.id);
        if (texto) {
          await tx.query(`insert into problemas (item_id, autor_id, descricao, criado_em) values ($1, $2, $3, $4)`, [e.itemId, atorId, texto, agora]);
        }
        await auditarAlvo(tx, atorId, "item_devolvido", "item", e.itemId, rotuloDoItem(item));
        for (const id of await destinatarios(tx, "conferir_devolucoes", atorId)) {
          avisar({
            destinatarioId: id,
            tipo: "devolucao_para_conferir",
            titulo: "Devolução para conferir",
            corpo: `${rotuloDoItem(item)} foi devolvido${texto ? `, com problema: ${texto}` : "."}`,
            link: "/emprestimos",
          });
        }
      });
    },

    /** Libera o item ou o manda para a manutenção. Liberar faz a fila andar. */
    async conferir(
      atorId: string,
      emprestimoId: string,
      dados: { resultado: "liberado" | "manutencao"; estado?: string },
    ) {
      await emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        await exigir(tx, atorId, "conferir_devolucoes");
        if (e.situacao !== "devolvido") throw regraViolada("Esse item não está aguardando conferência.");
        await tx.query(
          `update emprestimos set situacao = 'conferido', conferido_por = $1, conferido_em = $2, resultado_conferencia = $3 where id = $4`,
          [atorId, relogio.agora(), dados.resultado, e.id],
        );
        if (dados.estado) await tx.query(`update itens set estado = $1 where id = $2`, [dados.estado, e.itemId]);
        await tx.query(`update itens set em_manutencao = $1 where id = $2`, [dados.resultado === "manutencao", e.itemId]);
        await auditarAlvo(tx, atorId, "devolucao_conferida", "item", e.itemId, rotuloDoItem(item), { resultado: dados.resultado });
        await avancarFila(tx, avisar, e.itemId);
      });
    },

    /** Coloca ou tira da manutenção. Ao sair, a fila anda. */
    async definirManutencao(atorId: string, itemId: string, emManutencao: boolean) {
      await emTransacao(async (tx, avisar) => {
        await exigir(tx, atorId, "editar_inventario");
        const item = await travarItem(tx, itemId);
        if (item.tipo !== "individual") throw regraViolada("Só itens individuais entram em manutenção.");
        await tx.query(`update itens set em_manutencao = $1 where id = $2`, [emManutencao, itemId]);
        await auditarAlvo(tx, atorId, emManutencao ? "manutencao_iniciada" : "manutencao_encerrada", "item", itemId, rotuloDoItem(item));
        if (!emManutencao) await avancarFila(tx, avisar, itemId);
      });
    },

    async pedirRenovacao(atorId: string, emprestimoId: string, dados: { novaData: string; motivo: string }) {
      if (!dataValida(dados.novaData)) throw regraViolada("Informe a nova data.");
      if (!dados.motivo.trim()) throw regraViolada("Informe o motivo.");
      await emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        if (!ehResponsavel(ator, e)) throw semPermissao();
        if (e.situacao !== "retirado") throw regraViolada("Esse item não está emprestado.");
        if (hoje() > e.dataDevolucao!) throw regraViolada("O prazo já acabou. A renovação precisa ser pedida antes do fim.");
        if (dados.novaData <= e.dataDevolucao!) throw regraViolada("Escolha uma data depois da devolução atual.");
        const pendente = await tx.query(`select 1 from renovacoes where emprestimo_id = $1 and situacao = 'pendente'`, [e.id]);
        if (pendente.rowCount) throw regraViolada("Já existe uma renovação aguardando decisão.");
        await tx.query(
          `insert into renovacoes (emprestimo_id, nova_data, motivo, criado_em) values ($1, $2, $3, $4)`,
          [e.id, dados.novaData, dados.motivo.trim(), relogio.agora()],
        );
        for (const id of await destinatarios(tx, "aprovar_emprestimos", atorId)) {
          avisar({
            destinatarioId: id,
            tipo: "renovacao_pedida",
            titulo: "Pedido de renovação",
            corpo: `${ator.nome} pediu mais tempo com ${rotuloDoItem(item)}.`,
            link: "/emprestimos",
          });
        }
      });
    },

    async decidirRenovacao(atorId: string, renovacaoId: string, decisao: { aprovar: boolean; justificativa?: string }) {
      await emTransacao(async (tx, avisar) => {
        const achada = await tx.query<{ emprestimoId: string }>(`select emprestimo_id as "emprestimoId" from renovacoes where id = $1`, [renovacaoId]);
        if (!achada.rows[0]) throw naoEncontrado("Renovação");
        const { emprestimo: e, item } = await travarEmprestimo(tx, achada.rows[0].emprestimoId);
        await exigir(tx, atorId, "aprovar_emprestimos");
        const { rows } = await tx.query<{ situacao: string; novaData: string }>(
          `select situacao, nova_data::text as "novaData" from renovacoes where id = $1 for update`,
          [renovacaoId],
        );
        if (rows[0].situacao !== "pendente") throw regraViolada("Essa renovação já foi decidida.");
        const justificativa = decisao.justificativa?.trim() || null;
        if (!decisao.aprovar && !justificativa) throw regraViolada("Informe o motivo da recusa.");
        if (decisao.aprovar) {
          const motivo = await conflito(tx, e.itemId, somarDias(e.dataDevolucao!, 1), rows[0].novaData, e.id);
          if (motivo) throw regraViolada(motivo);
          await tx.query(
            `update emprestimos set data_devolucao = $1, lembrete_vespera_em = null, lembrete_dia_em = null, atraso_avisado_em = null where id = $2`,
            [rows[0].novaData, e.id],
          );
        }
        await tx.query(
          `update renovacoes set situacao = $1, decidido_por = $2, decidido_em = $3, justificativa_decisao = $4 where id = $5`,
          [decisao.aprovar ? "aprovada" : "recusada", atorId, relogio.agora(), justificativa, renovacaoId],
        );
        await auditarAlvo(tx, atorId, decisao.aprovar ? "renovacao_aprovada" : "renovacao_recusada", "item", e.itemId, rotuloDoItem(item));
        avisar({
          destinatarioId: e.responsavelId,
          tipo: "renovacao_decidida",
          titulo: decisao.aprovar ? "Renovação aprovada" : "Renovação recusada",
          corpo: decisao.aprovar
            ? `Você pode ficar com ${rotuloDoItem(item)} até ${rows[0].novaData}.`
            : `A renovação de ${rotuloDoItem(item)} foi recusada: ${justificativa}`,
          link: "/emprestimos",
        });
      });
    },

    /** Entrar na fila já faz o pedido: a decisão vem agora, não depois. */
    async entrarNaFila(atorId: string, dados: { itemId: string; dias: number; motivo: string; justificativaPrazo?: string }) {
      validarDias(dados.dias, dados.justificativaPrazo);
      if (!dados.motivo.trim()) throw regraViolada("Informe o motivo.");
      return emTransacao(async (tx, avisar) => {
        const item = await travarItem(tx, dados.itemId);
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        const rotulo = rotuloDoItem(item);
        if (item.tipo !== "individual" || item.estado === "fora_de_uso") throw regraViolada("Esse item não tem fila.");

        const dia = hoje();
        const ocupado =
          item.emManutencao ||
          (await conflito(tx, item.id, dia, somarDias(dia, dados.dias))) !== null ||
          (await tx.query(`select 1 from fila_entradas where item_id = $1 and situacao in ('aguardando', 'vez')`, [item.id])).rowCount! > 0;
        if (!ocupado) throw regraViolada("O item está livre. Faça o pedido direto.");

        const jaEsta = await tx.query(`select 1 from fila_entradas where item_id = $1 and pessoa_id = $2 and situacao in ('aguardando', 'vez')`, [item.id, atorId]);
        if (jaEsta.rowCount) throw regraViolada("Você já está na fila desse item.");
        const comEle = await tx.query(`select 1 from emprestimos where item_id = $1 and responsavel_id = $2 and situacao = 'retirado'`, [item.id, atorId]);
        if (comEle.rowCount) throw regraViolada("Esse item já está com você.");

        const aprovacao = precisaAprovacao(ator, dados.dias);
        const agora = relogio.agora();
        const { rows } = await tx.query<{ id: string }>(
          `insert into emprestimos (pedido_id, item_id, solicitante_id, responsavel_id, situacao, dias, motivo, justificativa_prazo, em_fila, criado_em)
           values ($1, $2, $3, $3, $4, $5, $6, $7, true, $8) returning id`,
          [randomUUID(), item.id, atorId, aprovacao ? "pendente" : "aprovado", dados.dias, dados.motivo.trim(), dados.justificativaPrazo?.trim() || null, agora],
        );
        await tx.query(`insert into fila_entradas (item_id, pessoa_id, emprestimo_id, criada_em) values ($1, $2, $3, $4)`, [item.id, atorId, rows[0].id, agora]);
        await avisarPedido(tx, avisar, ator, `${rotulo} (fila de espera)`, aprovacao);
        await avancarFila(tx, avisar, item.id);
        return rows[0].id;
      });
    },

    /** Passo 1 do repasse: quem está com o item indica para quem vai passar. */
    async proporRepasse(atorId: string, emprestimoId: string, paraId: string) {
      return emTransacao(async (tx, avisar) => {
        const { emprestimo: e, item } = await travarEmprestimo(tx, emprestimoId);
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        if (!ehResponsavel(ator, e)) throw semPermissao();
        if (e.situacao !== "retirado") throw regraViolada("Só um item retirado pode ser repassado.");
        if (paraId === atorId) throw regraViolada("Escolha outra pessoa.");
        if (hoje() > e.dataDevolucao!) throw regraViolada("O prazo acabou. Devolva o item na salinha.");
        const destino = await exigir(tx, paraId, "pedir_emprestimo").catch(() => {
          throw regraViolada("Essa pessoa não pode receber empréstimos.");
        });
        const aberto = await tx.query(
          `select 1 from repasses where emprestimo_id = $1 and situacao in ('aguardando_aceite', 'aguardando_aprovacao', 'aprovado')`,
          [e.id],
        );
        if (aberto.rowCount) throw regraViolada("Já existe um repasse em andamento para esse item.");
        const { rows } = await tx.query<{ id: string }>(
          `insert into repasses (emprestimo_id, de_id, para_id, situacao, criado_em) values ($1, $2, $3, 'aguardando_aceite', $4) returning id`,
          [e.id, atorId, paraId, relogio.agora()],
        );
        avisar({
          destinatarioId: destino.id,
          tipo: "repasse_proposto",
          titulo: "Proposta de repasse",
          corpo: `${ator.nome} quer passar ${rotuloDoItem(item)} para você. O prazo continua até ${e.dataDevolucao}.`,
          link: "/emprestimos",
        });
        return rows[0].id;
      });
    },

    /** Passo 2: a pessoa indicada aceita o prazo herdado. Depois vem a aprovação ou o aviso. */
    async responderRepasse(atorId: string, repasseId: string, aceitar: boolean) {
      await emTransacao(async (tx, avisar) => {
        const { repasse, emprestimo: e, item, temFila } = await travarRepasse(tx, repasseId);
        const ator = await exigir(tx, atorId, "pedir_emprestimo");
        if (repasse.paraId !== atorId) throw semPermissao();
        if (repasse.situacao !== "aguardando_aceite") throw regraViolada("Esse repasse já foi respondido.");
        const rotulo = rotuloDoItem(item);
        if (!aceitar) {
          await tx.query(`update repasses set situacao = 'recusado' where id = $1`, [repasseId]);
          avisar({
            destinatarioId: repasse.deId, tipo: "repasse_recusado", titulo: "Repasse recusado",
            corpo: `${ator.nome} não aceitou receber ${rotulo}.`, link: "/emprestimos",
          });
          return;
        }
        if (hoje() > e.dataDevolucao!) throw regraViolada("O prazo acabou. O item precisa voltar para a salinha.");
        // Com fila, o repasse sempre passa pelo diretor, para ninguém furar a fila sem ele saber.
        const aprovacao = temFila || !ator.cargo;
        await tx.query(
          `update repasses set situacao = $1, aceito_em = $2 where id = $3`,
          [aprovacao ? "aguardando_aprovacao" : "aprovado", relogio.agora(), repasseId],
        );
        for (const id of await destinatarios(tx, "aprovar_emprestimos", atorId)) {
          avisar({
            destinatarioId: id,
            tipo: aprovacao ? "repasse_para_aprovar" : "aviso_repasse",
            titulo: aprovacao ? "Repasse para aprovar" : "Aviso de repasse",
            corpo: `${rotulo} vai passar para ${ator.nome}.${temFila ? " Esse item tem fila de espera." : ""}`,
            link: "/emprestimos",
          });
        }
      });
    },

    async decidirRepasse(atorId: string, repasseId: string, decisao: { aprovar: boolean; justificativa?: string }) {
      await emTransacao(async (tx, avisar) => {
        const { repasse, emprestimo: e, item } = await travarRepasse(tx, repasseId);
        await exigir(tx, atorId, "aprovar_emprestimos");
        if (repasse.situacao !== "aguardando_aprovacao") throw regraViolada("Esse repasse não está aguardando aprovação.");
        const justificativa = decisao.justificativa?.trim() || null;
        if (!decisao.aprovar && !justificativa) throw regraViolada("Informe o motivo da recusa.");
        if (decisao.aprovar && hoje() > e.dataDevolucao!) throw regraViolada("O prazo acabou. O item precisa voltar para a salinha.");
        await tx.query(
          `update repasses set situacao = $1, decidido_por = $2, decidido_em = $3, justificativa_decisao = $4 where id = $5`,
          [decisao.aprovar ? "aprovado" : "recusado", atorId, relogio.agora(), justificativa, repasseId],
        );
        for (const destinatarioId of [repasse.deId, repasse.paraId]) {
          avisar({
            destinatarioId,
            tipo: "repasse_decidido",
            titulo: decisao.aprovar ? "Repasse aprovado" : "Repasse recusado",
            corpo: decisao.aprovar
              ? `O repasse de ${rotuloDoItem(item)} foi aprovado. Combinem a entrega.`
              : `O repasse de ${rotuloDoItem(item)} foi recusado: ${justificativa}`,
            link: "/emprestimos",
          });
        }
      });
    },

    /** Passo final, na entrega: a responsabilidade só muda aqui. O prazo original continua valendo. */
    async concluirRepasse(atorId: string, repasseId: string, dados: { aceitouTermo: boolean; observacaoEstado?: string }) {
      if (!dados.aceitouTermo) throw regraViolada("Aceite o termo de responsabilidade para receber o item.");
      await emTransacao(async (tx, avisar) => {
        const { repasse, emprestimo: e, item, temFila } = await travarRepasse(tx, repasseId);
        await exigir(tx, atorId, "pedir_emprestimo");
        if (repasse.paraId !== atorId) throw semPermissao();
        if (repasse.situacao !== "aprovado") throw regraViolada("Esse repasse ainda não pode ser concluído.");
        if (e.situacao !== "retirado") throw regraViolada("Esse item não está mais emprestado.");
        if (temFila && hoje() > e.dataDevolucao!) throw regraViolada("O prazo acabou. O item precisa voltar para a salinha.");
        const agora = relogio.agora();
        await tx.query(`update repasses set situacao = 'concluido', concluido_em = $1 where id = $2`, [agora, repasseId]);
        await tx.query(`update emprestimos set responsavel_id = $1 where id = $2`, [atorId, e.id]);
        await tx.query(`update renovacoes set situacao = 'cancelada' where emprestimo_id = $1 and situacao = 'pendente'`, [e.id]);
        await tx.query(
          `insert into termos_aceite (item_id, pessoa_id, emprestimo_id, origem, versao, observacao_estado, aceito_em)
           values ($1, $2, $3, 'repasse', $4, $5, $6)`,
          [e.itemId, atorId, e.id, VERSAO_TERMO, dados.observacaoEstado?.trim() || null, agora],
        );
        await auditarAlvo(tx, atorId, "repasse_concluido", "item", e.itemId, rotuloDoItem(item));
        avisar({
          destinatarioId: repasse.deId,
          tipo: "repasse_concluido",
          titulo: "Repasse concluído",
          corpo: `${rotuloDoItem(item)} saiu da sua responsabilidade.`,
          link: "/emprestimos",
        });
      });
    },

    /** O que a pessoa tem: pedidos, itens com ela, filas e repasses que a envolvem. */
    async meus(atorId: string) {
      await exigir(pool, atorId, "ver_catalogo");
      const dia = hoje();
      const [ativos, repasses, renovacoes] = await Promise.all([
        vistos(
          `${CONSULTA_VISTA}
           where (e.responsavel_id = $2 or e.solicitante_id = $2) and e.situacao in ('pendente', 'aprovado', 'retirado', 'devolvido')
             and (e.situacao <> 'devolvido' or e.responsavel_id = $2)
           order by e.criado_em desc`,
          [dia, atorId],
        ),
        lerRepasses(`(x.de_id = $1 or x.para_id = $1)`, [atorId]),
        linhas<{ emprestimoId: string; novaData: string }>(
          `select r.emprestimo_id as "emprestimoId", r.nova_data::text as "novaData"
           from renovacoes r join emprestimos e on e.id = r.emprestimo_id
           where r.situacao = 'pendente' and e.responsavel_id = $1`,
          [atorId],
        ),
      ]);
      const historico = await vistos(
        `${CONSULTA_VISTA}
         where e.situacao in ('recusado', 'cancelado', 'conferido')
           and (e.responsavel_id = $2 or e.solicitante_id = $2)
         order by e.criado_em desc limit 20`,
        [dia, atorId],
      );
      return { ativos, repasses, renovacoes, historico };
    },

    /** O que precisa de ação da diretoria, conforme as permissões de cada um. */
    async painel(atorId: string) {
      const ator = await exigir(pool, atorId, "ver_catalogo");
      const dia = hoje();
      const aprova = pode(ator, "aprovar_emprestimos");
      const confere = pode(ator, "conferir_devolucoes");
      if (!aprova && !confere) return null;
      const [pendentes, renovacoes, repasses, conferir, emAndamento] = await Promise.all([
        aprova
          ? vistos(`${CONSULTA_VISTA} where e.situacao = 'pendente' order by e.criado_em`, [dia])
          : [],
        aprova
          ? linhas<RenovacaoVista>(
              `select r.id, r.emprestimo_id as "emprestimoId", r.nova_data::text as "novaData", r.motivo,
                 coalesce(i.codigo || ' ', '') || i.nome as "itemRotulo", p.nome as "responsavelNome",
                 e.data_devolucao::text as "dataDevolucao", ${nomesFila("e.item_id")}
               from renovacoes r join emprestimos e on e.id = r.emprestimo_id
               join itens i on i.id = e.item_id join perfis p on p.id = e.responsavel_id
               where r.situacao = 'pendente' order by r.criado_em`,
            )
          : [],
        aprova ? lerRepasses(`x.situacao = 'aguardando_aprovacao'`, []) : [],
        confere
          ? vistos(`${CONSULTA_VISTA} where e.situacao = 'devolvido' order by e.devolvido_em`, [dia])
          : [],
        aprova
          ? vistos(`${CONSULTA_VISTA} where e.situacao = 'retirado' order by e.data_devolucao`, [dia])
          : [],
      ]);
      return { pendentes, renovacoes, repasses, conferir, emAndamento };
    },

    /** Quem está na fila de um item, na ordem. Só para quem pode ver com quem os itens estão. */
    async filaDoItem(atorId: string, itemId: string) {
      await exigir(pool, atorId, "ver_responsavel");
      return linhas<{ pessoaId: string; pessoaNome: string; situacao: "aguardando" | "vez" }>(
        `select f.pessoa_id as "pessoaId", p.nome as "pessoaNome", f.situacao
         from fila_entradas f join perfis p on p.id = f.pessoa_id
         where f.item_id = $1 and f.situacao in ('aguardando', 'vez') order by f.ordem`,
        [itemId],
      );
    },

    /** Reservas futuras do item, para ajudar a escolher datas livres. */
    async reservasDoItem(atorId: string, itemId: string) {
      await exigir(pool, atorId, "ver_catalogo");
      return linhas<{ inicio: string; fim: string }>(
        `select e.data_retirada::text as inicio, e.data_devolucao::text as fim
         from emprestimos e
         where e.item_id = $1 and e.situacao = 'aprovado' and not e.em_fila and e.data_devolucao >= $2::date
         order by e.data_retirada`,
        [itemId, hoje()],
      );
    },

    /**
     * Lembretes, atrasos e filas. Pode rodar a qualquer momento e quantas vezes for:
     * cada lembrete só sai uma vez, e os vencimentos vêm das datas salvas.
     */
    async executarRotinas() {
      const dia = hoje();
      const agora = relogio.agora();
      const candidatos = await linhas<{ id: string }>(
        `select id from emprestimos where situacao = 'retirado' and (
           (data_devolucao = $1::date + 1 and lembrete_vespera_em is null)
           or (data_devolucao = $1::date and lembrete_dia_em is null)
           or (data_devolucao < $1::date and atraso_avisado_em is null))`,
        [dia],
      );
      for (const { id } of candidatos) {
        await emTransacao(async (tx, avisar) => {
          const { emprestimo: e, item } = await travarEmprestimo(tx, id);
          if (e.situacao !== "retirado") return;
          const rotulo = rotuloDoItem(item);
          if (e.dataDevolucao! < dia) {
            const marcado = await tx.query(
              `update emprestimos set atraso_avisado_em = $1 where id = $2 and atraso_avisado_em is null`,
              [agora, id],
            );
            if (!marcado.rowCount) return;
            avisar({
              destinatarioId: e.responsavelId, tipo: "emprestimo_atrasado", titulo: "Devolução atrasada",
              corpo: `O prazo de ${rotulo} acabou em ${e.dataDevolucao}. Devolva o item na salinha.`, link: "/emprestimos",
            });
            for (const pessoa of await destinatarios(tx, "aprovar_emprestimos", e.responsavelId)) {
              avisar({
                destinatarioId: pessoa, tipo: "emprestimo_atrasado", titulo: "Empréstimo atrasado",
                corpo: `${rotulo} deveria ter voltado em ${e.dataDevolucao}.`, link: "/emprestimos",
              });
            }
            return;
          }
          const ehHoje = e.dataDevolucao === dia;
          const coluna = ehHoje ? "lembrete_dia_em" : "lembrete_vespera_em";
          const marcado = await tx.query(`update emprestimos set ${coluna} = $1 where id = $2 and ${coluna} is null`, [agora, id]);
          if (!marcado.rowCount) return;
          avisar({
            destinatarioId: e.responsavelId,
            tipo: "lembrete_devolucao",
            titulo: ehHoje ? "A devolução é hoje" : "A devolução é amanhã",
            corpo: `Lembre-se de devolver ${rotulo} na salinha.`,
            link: "/emprestimos",
          });
        });
      }

      await pool.query(
        `update emprestimos set situacao = 'cancelado'
         where situacao = 'aprovado' and not em_fila and data_devolucao < $1::date`,
        [dia],
      );

      const comFila = await linhas<{ itemId: string }>(
        `select distinct item_id as "itemId" from fila_entradas where situacao in ('aguardando', 'vez')`,
      );
      for (const { itemId } of comFila) {
        await emTransacao((tx, avisar) => avancarFila(tx, avisar, itemId));
      }
    },
  };

  async function lerRepasses(condicao: string, params: unknown[]): Promise<RepasseVisto[]> {
    return linhas<RepasseVisto>(
      `select x.id, x.emprestimo_id as "emprestimoId", x.situacao, x.de_id as "deId", d.nome as "deNome",
         x.para_id as "paraId", p.nome as "paraNome",
         coalesce(i.codigo || ' ', '') || i.nome as "itemRotulo", e.data_devolucao::text as "dataDevolucao",
         ${nomesFila("e.item_id")}
       from repasses x
       join emprestimos e on e.id = x.emprestimo_id join itens i on i.id = e.item_id
       join perfis d on d.id = x.de_id join perfis p on p.id = x.para_id
       where x.situacao in ('aguardando_aceite', 'aguardando_aprovacao', 'aprovado') and ${condicao}
       order by x.criado_em`,
      params,
    );
  }

  async function travarRepasse(tx: PoolClient, repasseId: string) {
    const achado = await tx.query<{ emprestimoId: string }>(`select emprestimo_id as "emprestimoId" from repasses where id = $1`, [repasseId]);
    if (!achado.rows[0]) throw naoEncontrado("Repasse");
    const { emprestimo, item } = await travarEmprestimo(tx, achado.rows[0].emprestimoId);
    const { rows } = await tx.query<{ deId: string; paraId: string; situacao: string }>(
      `select de_id as "deId", para_id as "paraId", situacao from repasses where id = $1 for update`,
      [repasseId],
    );
    const fila = await tx.query(`select 1 from fila_entradas where item_id = $1 and situacao in ('aguardando', 'vez')`, [emprestimo.itemId]);
    return { repasse: rows[0], emprestimo, item, temFila: Boolean(fila.rowCount) };
  }
}
