import { randomUUID } from "node:crypto";
import { dataValida, ratear } from "./datas";
import { naoEncontrado, regraViolada } from "./erros";
import type { Contexto } from "./index";
import { extensao, TIPOS_COMPROVANTE, validarArquivo } from "./inventario";
import type { ArquivoEnviado } from "./portas";

export type Movimentacao = {
  id: string;
  tipo: "entrada" | "saida";
  data: string;
  descricao: string;
  quemFez: string | null;
  valorCentavos: number;
  pagoPor: string | null;
  temComprovante: boolean;
  reembolso: "nao_se_aplica" | "pendente" | "pago";
  itens: string[];
  ligadaManutencao: boolean;
};

const CONSULTA = `
  select m.id, m.tipo, m.data::text as data, m.descricao, m.quem_fez as "quemFez",
    m.valor_centavos as "valorCentavos", m.pago_por as "pagoPor", (m.comprovante is not null) as "temComprovante",
    m.reembolso,
    coalesce((select array_agg(coalesce(i.codigo, i.nome) order by i.codigo)
      from movimentacao_itens x join itens i on i.id = x.item_id where x.movimentacao_id = m.id), '{}') as itens,
    exists (select 1 from manutencoes ma where ma.movimentacao_id = m.id) as "ligadaManutencao"
  from movimentacoes m`;

export function criarFinancas(ctx: Contexto) {
  const { pool, relogio, arquivos, emTransacao, linhas, exigir, auditarAlvo } = ctx;

  const periodo = (de: string, ate: string) => {
    if (!dataValida(de) || !dataValida(ate)) throw regraViolada("Informe o período.");
    if (ate < de) throw regraViolada("O fim do período precisa ser depois do início.");
  };

  return {
    async listar(atorId: string, filtros: { de: string; ate: string; tipo?: "entrada" | "saida" }): Promise<Movimentacao[]> {
      await exigir(pool, atorId, "ver_financas");
      periodo(filtros.de, filtros.ate);
      return linhas<Movimentacao>(
        `${CONSULTA} where m.data between $1 and $2 and ($3::tipo_movimento is null or m.tipo = $3)
         order by m.data desc, m.criado_em desc`,
        [filtros.de, filtros.ate, filtros.tipo ?? null],
      );
    },

    /** Sem saldo: mostra só as movimentações do período, como decidido para a primeira versão. */
    async resumo(atorId: string, de: string, ate: string) {
      await exigir(pool, atorId, "ver_financas");
      periodo(de, ate);
      const [totais, porCategoria, porItem, reembolsos] = await Promise.all([
        linhas<{ entradas: number; saidas: number }>(
          `select coalesce(sum(valor_centavos) filter (where tipo = 'entrada'), 0)::int as entradas,
                  coalesce(sum(valor_centavos) filter (where tipo = 'saida'), 0)::int as saidas
           from movimentacoes where data between $1 and $2`,
          [de, ate],
        ),
        linhas<{ categoria: string; totalCentavos: number }>(
          `select coalesce(g.nome, c.nome, 'Gastos gerais') as categoria, sum(coalesce(x.valor_centavos, m.valor_centavos))::int as "totalCentavos"
           from movimentacoes m
           left join movimentacao_itens x on x.movimentacao_id = m.id
           left join itens i on i.id = x.item_id
           left join categorias c on c.id = i.categoria_id
           left join categorias g on g.id = c.pai_id
           where m.tipo = 'saida' and m.data between $1 and $2
           group by 1 order by 2 desc`,
          [de, ate],
        ),
        linhas<{ itemId: string; rotulo: string; totalCentavos: number }>(
          `select i.id as "itemId", coalesce(i.codigo || ' ', '') || i.nome as rotulo, sum(x.valor_centavos)::int as "totalCentavos"
           from movimentacoes m join movimentacao_itens x on x.movimentacao_id = m.id join itens i on i.id = x.item_id
           where m.tipo = 'saida' and m.data between $1 and $2
           group by i.id order by 3 desc limit 10`,
          [de, ate],
        ),
        linhas<Movimentacao>(`${CONSULTA} where m.reembolso = 'pendente' order by m.data`),
      ]);
      return { ...totais[0], porCategoria, porItem, reembolsos };
    },

    /** Entrada, ou saída ligada a itens, ou saída geral. */
    async lancar(
      atorId: string,
      dados: {
        tipo: "entrada" | "saida"; data: string; descricao: string; valorCentavos: number; quemFez?: string;
        pagoPor?: string; reembolsoPendente?: boolean; itemIds?: string[]; comprovante?: ArquivoEnviado;
      },
    ): Promise<string> {
      await exigir(pool, atorId, "lancar_custos");
      if (!dados.descricao.trim()) throw regraViolada("Descreva a movimentação.");
      if (!dataValida(dados.data)) throw regraViolada("Informe a data.");
      if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) throw regraViolada("Informe um valor maior que zero.");
      const itemIds = dados.tipo === "saida" ? [...new Set(dados.itemIds ?? [])] : [];
      let comprovante: string | null = null;
      if (dados.comprovante) {
        validarArquivo(dados.comprovante, TIPOS_COMPROVANTE);
        comprovante = `${randomUUID()}.${extensao(dados.comprovante.tipo)}`;
        await arquivos.guardar("comprovantes", comprovante, dados.comprovante);
      }
      return emTransacao(async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          `insert into movimentacoes (tipo, data, descricao, quem_fez, valor_centavos, pago_por, comprovante, reembolso, criado_por, criado_em)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [
            dados.tipo, dados.data, dados.descricao.trim(), dados.quemFez?.trim() || null, dados.valorCentavos,
            dados.pagoPor?.trim() || null, comprovante,
            dados.tipo === "saida" && dados.reembolsoPendente ? "pendente" : "nao_se_aplica", atorId, relogio.agora(),
          ],
        );
        const partes = itemIds.length ? ratear(dados.valorCentavos, itemIds.length) : [];
        for (const [i, itemId] of itemIds.entries()) {
          await tx.query(`insert into movimentacao_itens (movimentacao_id, item_id, valor_centavos) values ($1, $2, $3)`, [rows[0].id, itemId, partes[i]]);
        }
        await auditarAlvo(tx, atorId, "movimentacao_lancada", "movimentacao", rows[0].id, dados.descricao.trim());
        return rows[0].id;
      });
    },

    async marcarReembolsado(atorId: string, movimentacaoId: string) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "lancar_custos");
        const { rows } = await tx.query<{ descricao: string }>(
          `update movimentacoes set reembolso = 'pago' where id = $1 and reembolso = 'pendente' returning descricao`,
          [movimentacaoId],
        );
        if (rows[0]) await auditarAlvo(tx, atorId, "reembolso_pago", "movimentacao", movimentacaoId, rows[0].descricao);
      });
    },

    /** Remove um lançamento feito por engano. O histórico do item fica, agora sem o valor. */
    async remover(atorId: string, movimentacaoId: string) {
      const comprovante = await emTransacao(async (tx) => {
        await exigir(tx, atorId, "lancar_custos");
        const { rows } = await tx.query<{ descricao: string; comprovante: string | null }>(
          `delete from movimentacoes where id = $1 returning descricao, comprovante`,
          [movimentacaoId],
        );
        if (!rows[0]) throw naoEncontrado("Movimentação");
        await auditarAlvo(tx, atorId, "movimentacao_removida", "movimentacao", movimentacaoId, rows[0].descricao);
        return rows[0].comprovante;
      });
      if (comprovante) await arquivos.remover("comprovantes", [comprovante]).catch(() => {});
    },

    /** Link temporário: comprovantes nunca ficam públicos. */
    async urlComprovante(atorId: string, movimentacaoId: string): Promise<string> {
      await exigir(pool, atorId, "ver_financas");
      const [linha] = await linhas<{ comprovante: string | null }>(`select comprovante from movimentacoes where id = $1`, [movimentacaoId]);
      if (!linha?.comprovante) throw naoEncontrado("Comprovante");
      return arquivos.urlAssinada(linha.comprovante);
    },

    /** O relatório do semestre: o que entrou, saiu, foi consertado e foi cadastrado. */
    async relatorio(atorId: string, de: string, ate: string) {
      await exigir(pool, atorId, "ver_financas");
      periodo(de, ate);
      const [movimentacoes, manutencoes, novosItens] = await Promise.all([
        linhas<Movimentacao>(`${CONSULTA} where m.data between $1 and $2 order by m.data`, [de, ate]),
        linhas<{ data: string; servico: string; quemFez: string | null; itens: string; valorCentavos: number | null }>(
          `select m.data::text as data, m.servico, m.quem_fez as "quemFez",
             (select string_agg(coalesce(i.codigo, i.nome), ', ') from manutencao_itens x join itens i on i.id = x.item_id where x.manutencao_id = m.id) as itens,
             mv.valor_centavos as "valorCentavos"
           from manutencoes m left join movimentacoes mv on mv.id = m.movimentacao_id
           where m.data between $1 and $2 order by m.data`,
          [de, ate],
        ),
        linhas<{ rotulo: string; categoria: string; criadoEm: Date }>(
          `select coalesce(i.codigo || ' ', '') || i.nome as rotulo, c.nome as categoria, i.criado_em as "criadoEm"
           from itens i join categorias c on c.id = i.categoria_id
           where i.criado_em::date between $1 and $2 order by i.criado_em`,
          [de, ate],
        ),
      ]);
      return { movimentacoes, manutencoes, novosItens };
    },
  };
}
