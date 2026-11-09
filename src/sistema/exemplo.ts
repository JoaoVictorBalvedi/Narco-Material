import { dataLocal, somarDias } from "./datas";
import { regraViolada } from "./erros";
import type { Contexto } from "./index";

const INDIVIDUAIS: [string, string, string, string, string][] = [
  ["CX", "Caixa de guerra 12\"", "Exemplo: caixa de alumínio, usada nos desafios.", "bom", "EX-CX-01"],
  ["CX", "Caixa de guerra 12\"", "Exemplo: precisa de revisão nas ferragens.", "regular", "EX-CX-02"],
  ["SD", "Surdo de primeira 20\"", "Exemplo: marcação da bateria.", "bom", "EX-SD-01"],
  ["SD", "Surdo de segunda 18\"", "Exemplo: resposta da marcação.", "ruim", "EX-SD-02"],
  ["RP", "Repique 10\"", "Exemplo: usado pelo mestre.", "novo", "EX-RP-01"],
  ["TB", "Tamborim", "Exemplo: com baqueta de carreteiro.", "bom", "EX-TB-01"],
  ["AG", "Agogô 4 bocas", "Exemplo: peça de madeira e metal.", "regular", "EX-AG-01"],
  ["BD", "Bandeirão principal", "Exemplo: usado em desafio e apresentação.", "regular", "EX-BD-01"],
  ["TF", "Troféu de desafio", "Exemplo: peça do acervo histórico.", "bom", "EX-TF-01"],
  ["AD", "Cabeça do Homer", "Exemplo: adereço do mascote.", "bom", "EX-AD-01"],
  ["FR", "Chave de afinação", "Exemplo: ferramenta do kit de emergência.", "bom", "EX-FR-01"],
];

const ESTOQUE: [string, string, string, number, number][] = [
  ["PL", "Pele de caixa", "12\"", 8, 4],
  ["PL", "Pele de surdo", "20\"", 1, 2],
  ["BQ", "Baqueta de caixa", "Par", 30, 10],
  ["TL", "Talabarte", "Padrão", 6, 3],
  ["PC", "Mandioca", "Unidade", 12, 5],
  ["FG", "Camiseta da bateria", "M", 15, 5],
];

/** Dados fictícios para testar o app. Todos ficam marcados e saem de uma vez. */
export function criarExemplo(ctx: Contexto) {
  const { relogio, emTransacao, linhas, exigir, auditarAlvo, pool } = ctx;

  return {
    async existe(atorId: string): Promise<boolean> {
      await exigir(pool, atorId, "delegar_permissoes");
      const [linha] = await linhas<{ existe: boolean }>(
        `select exists (select 1 from itens where exemplo) or exists (select 1 from eventos where exemplo)
           or exists (select 1 from movimentacoes where exemplo) as existe`,
      );
      return linha.existe;
    },

    async criar(atorId: string) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "delegar_permissoes");
        const ja = await tx.query(`select 1 from itens where exemplo limit 1`);
        if (ja.rowCount) throw regraViolada("Os dados de exemplo já existem.");
        const agora = relogio.agora();
        const hoje = dataLocal(agora);
        const criarItem = async (prefixo: string, valores: unknown[], colunas: string) => {
          const { rows } = await tx.query<{ id: string }>(
            `insert into itens (categoria_id, exemplo, criado_por, criado_em, ${colunas})
             select id, true, $1, $2, ${valores.map((_, i) => `$${i + 4}`).join(", ")} from categorias where prefixo = $3
             returning id`,
            [atorId, agora, prefixo, ...valores],
          );
          if (!rows[0]) throw regraViolada(`A categoria ${prefixo} não existe mais. Recrie-a para gerar os exemplos.`);
          return rows[0].id;
        };

        const individuais: string[] = [];
        for (const [prefixo, nome, descricao, estado, codigo] of INDIVIDUAIS) {
          individuais.push(
            await criarItem(prefixo, ["individual", nome, descricao, estado, codigo], "tipo, nome, descricao, estado, codigo"),
          );
        }
        for (const [prefixo, nome, variacao, quantidade, minima] of ESTOQUE) {
          await criarItem(
            prefixo,
            ["estoque", nome, variacao, "bom", quantidade, minima],
            "tipo, nome, variacao, estado, quantidade, quantidade_minima",
          );
        }

        const mov = await tx.query<{ id: string }>(
          `insert into movimentacoes (tipo, data, descricao, quem_fez, valor_centavos, exemplo, criado_por, criado_em)
           values ('saida', $1, 'Exemplo: reforma da caixa EX-CX-02', 'Oficina de exemplo', 15000, true, $2, $3) returning id`,
          [somarDias(hoje, -20), atorId, agora],
        );
        await tx.query(`insert into movimentacao_itens (movimentacao_id, item_id, valor_centavos) values ($1, $2, 15000)`, [mov.rows[0].id, individuais[1]]);
        const man = await tx.query<{ id: string }>(
          `insert into manutencoes (data, servico, quem_fez, movimentacao_id, criado_por, criado_em)
           values ($1, 'Exemplo: troca de aro e parafusos', 'Oficina de exemplo', $2, $3, $4) returning id`,
          [somarDias(hoje, -20), mov.rows[0].id, atorId, agora],
        );
        await tx.query(`insert into manutencao_itens (manutencao_id, item_id) values ($1, $2)`, [man.rows[0].id, individuais[1]]);
        await tx.query(
          `insert into movimentacoes (tipo, data, descricao, valor_centavos, exemplo, criado_por, criado_em)
           values ('entrada', $1, 'Exemplo: venda de adesivos', 32000, true, $2, $3)`,
          [somarDias(hoje, -10), atorId, agora],
        );

        const evento = await tx.query<{ id: string }>(
          `insert into eventos (nome, tipo, data_inicio, data_fim, local, exemplo, criado_por, criado_em)
           values ('Exemplo: Desafio de Baterias', 'Desafio', $1, $1, 'Ginásio de exemplo', true, $2, $3) returning id`,
          [somarDias(hoje, 30), atorId, agora],
        );
        for (const itemId of [individuais[0], individuais[2], individuais[7]]) {
          await tx.query(`insert into evento_itens (evento_id, item_id) values ($1, $2)`, [evento.rows[0].id, itemId]);
        }
        await auditarAlvo(tx, atorId, "exemplos_criados", "sistema", atorId, "dados de exemplo");
      });
    },

    /** Empréstimos, históricos e eventos ligados aos exemplos saem junto. */
    async apagar(atorId: string) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "delegar_permissoes");
        await tx.query(`delete from itens where exemplo`);
        await tx.query(`delete from eventos where exemplo`);
        await tx.query(`delete from movimentacoes where exemplo`);
        await tx.query(`delete from manutencoes where not exists (select 1 from manutencao_itens x where x.manutencao_id = manutencoes.id)`);
        await auditarAlvo(tx, atorId, "exemplos_apagados", "sistema", atorId, "dados de exemplo");
      });
    },
  };
}
