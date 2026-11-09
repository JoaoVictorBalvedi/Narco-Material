import type { Pool, PoolClient, QueryResultRow } from "pg";
import { naoEncontrado, regraViolada, semPermissao } from "./erros";
import {
  pode,
  type Acao,
  type Ator,
  type Cargo,
  type Categoria,
  type PermissaoDelegavel,
  type Situacao,
} from "./permissoes";
import type { Aviso, Arquivos, Notificador, Relogio } from "./portas";
import { criarEmprestimos } from "./emprestimos";
import { criarEventos } from "./eventos";
import { criarExemplo } from "./exemplo";
import { criarFinancas } from "./financas";
import { criarInventario } from "./inventario";

export type Pessoa = {
  id: string;
  nome: string;
  email: string;
  categoria: Categoria | null;
  cargo: Cargo | null;
  situacao: Situacao;
  criadoEm: Date;
};

export type Delegacao = {
  permissao: PermissaoDelegavel;
  concedidaPorNome: string | null;
  concedidaEm: Date;
};

export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  link: string | null;
  criadaEm: Date;
  lidaEm: Date | null;
};

export type RegistroAuditoria = {
  id: string;
  autorNome: string | null;
  acao: string;
  alvoNome: string | null;
  detalhes: Record<string, unknown>;
  criadoEm: Date;
};

type Dependencias = { pool: Pool; relogio: Relogio; notificador: Notificador; arquivos: Arquivos };
type Sistema = ReturnType<typeof criarSistema>;
export type { Sistema };

export type Contexto = {
  pool: Pool;
  relogio: Relogio;
  arquivos: Arquivos;
  emTransacao<T>(fn: (tx: PoolClient, avisar: (a: Aviso) => void) => Promise<T>): Promise<T>;
  linhas<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  exigir(db: Pick<PoolClient, "query">, atorId: string, acao: Acao): Promise<Ator>;
  auditarAlvo(
    tx: PoolClient,
    autorId: string,
    acao: string,
    alvoTipo: string,
    alvoId: string,
    rotulo: string,
    detalhes?: Record<string, unknown>,
  ): Promise<void>;
  destinatarios(
    db: Pick<PoolClient, "query">,
    permissao: PermissaoDelegavel,
    excetoId?: string,
  ): Promise<string[]>;
};

const SERVICOS_PUSH = /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

function servicoDePushConhecido(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && SERVICOS_PUSH.test(url.hostname);
  } catch {
    return false;
  }
}

const COLUNAS_PESSOA = `id, nome, email, categoria, cargo, situacao, criado_em as "criadoEm"`;

export function criarSistema({ pool, relogio, notificador, arquivos }: Dependencias) {
  type Consulta = Pick<PoolClient, "query">;

  /** Roda em transação e só envia os avisos externos depois do commit. */
  async function emTransacao<T>(
    fn: (tx: PoolClient, avisar: (a: Aviso) => void) => Promise<T>,
  ): Promise<T> {
    const tx = await pool.connect();
    const avisos: Aviso[] = [];
    let resultado: T;
    try {
      await tx.query("begin");
      resultado = await fn(tx, (a) => avisos.push(a));
      for (const a of avisos) {
        await tx.query(
          `insert into notificacoes (destinatario_id, tipo, titulo, corpo, link, criada_em)
           values ($1, $2, $3, $4, $5, $6)`,
          [a.destinatarioId, a.tipo, a.titulo, a.corpo, a.link ?? null, relogio.agora()],
        );
      }
      await tx.query("commit");
    } catch (erro) {
      await tx.query("rollback");
      throw erro;
    } finally {
      tx.release();
    }
    // A operação já foi salva, e o aviso fica no app: uma falha de push não pode desfazê-la.
    if (avisos.length) await notificador.enviar(avisos).catch((erro) => console.error("Falha no push", erro));
    return resultado;
  }

  async function linhas<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
    return (await pool.query<T>(sql, params)).rows;
  }

  async function buscarAtor(db: Consulta, id: string): Promise<Ator | null> {
    const { rows } = await db.query<Omit<Ator, "delegadas">>(
      `select id, nome, categoria, cargo, situacao from perfis where id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const delegadas = await db.query<{ permissao: PermissaoDelegavel }>(
      `select permissao from permissoes_delegadas where perfil_id = $1 and retirada_em is null`,
      [id],
    );
    return { ...rows[0], delegadas: delegadas.rows.map((d) => d.permissao) };
  }

  async function exigir(db: Consulta, atorId: string, acao: Acao): Promise<Ator> {
    const ator = await buscarAtor(db, atorId);
    if (!ator || !pode(ator, acao)) throw semPermissao();
    return ator;
  }

  /** Trava a pessoa até o fim da transação, para mudanças simultâneas não se cruzarem. */
  async function travarPessoa(tx: PoolClient, id: string): Promise<Pessoa> {
    const { rows } = await tx.query<Pessoa>(
      `select ${COLUNAS_PESSOA} from perfis where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw naoEncontrado("Pessoa");
    return rows[0];
  }

  async function auditar(
    tx: PoolClient,
    autorId: string,
    acao: string,
    alvoId: string,
    detalhes: Record<string, unknown> = {},
  ) {
    await tx.query(
      `insert into auditoria (autor_id, acao, alvo_tipo, alvo_id, detalhes, criado_em)
       values ($1, $2, 'pessoa', $3, $4, $5)`,
      [autorId, acao, alvoId, JSON.stringify(detalhes), relogio.agora()],
    );
  }

  /** Registra uma ação sobre algo que não é uma pessoa; `rotulo` nomeia o alvo no histórico. */
  async function auditarAlvo(
    tx: PoolClient,
    autorId: string,
    acao: string,
    alvoTipo: string,
    alvoId: string,
    rotulo: string,
    detalhes: Record<string, unknown> = {},
  ) {
    await tx.query(
      `insert into auditoria (autor_id, acao, alvo_tipo, alvo_id, detalhes, criado_em)
       values ($1, $2, $3, $4, $5, $6)`,
      [autorId, acao, alvoTipo, alvoId, JSON.stringify({ ...detalhes, rotulo }), relogio.agora()],
    );
  }

  /** Quem tem o poder: o Diretor de Material e os diretores com a permissão delegada. */
  async function destinatarios(
    db: Consulta,
    permissao: PermissaoDelegavel,
    excetoId?: string,
  ): Promise<string[]> {
    const { rows } = await db.query<{ id: string }>(
      `select p.id from perfis p
       where p.situacao = 'ativa' and p.id is distinct from $2
         and (p.cargo = 'diretor_material' or (p.cargo is not null and exists (
           select 1 from permissoes_delegadas d
           where d.perfil_id = p.id and d.permissao = $1 and d.retirada_em is null)))`,
      [permissao, excetoId ?? null],
    );
    return rows.map((r) => r.id);
  }

  const contexto = { pool, relogio, arquivos, emTransacao, linhas, exigir, auditarAlvo, destinatarios };
  const inventario = criarInventario(contexto);
  const emprestimos = criarEmprestimos(contexto);
  const eventos = criarEventos(contexto, emprestimos.avancarFila);

  async function retirarDelegacoes(tx: PoolClient, autorId: string, pessoaId: string) {
    await tx.query(
      `update permissoes_delegadas set retirada_por = $1, retirada_em = $2
       where perfil_id = $3 and retirada_em is null`,
      [autorId, relogio.agora(), pessoaId],
    );
  }

  const ehCargoProtegido = (cargo: Cargo | null) =>
    cargo === "presidente" || cargo === "diretor_material";

  return {
    /** Carrega quem está usando o app, com as permissões em vigor. */
    ator: (id: string) => buscarAtor(pool, id),

    inventario,
    emprestimos,
    eventos,

    notificacoes: {
      /** Um aparelho por assinatura. Se a conta mudar no aparelho, a assinatura passa para ela. */
      async assinar(atorId: string, assinatura: { endpoint: string; keys: { p256dh: string; auth: string } }) {
        await exigir(pool, atorId, "ver_catalogo");
        // O servidor faz requisições para esse endereço: só aceita os serviços de push conhecidos.
        if (!servicoDePushConhecido(assinatura.endpoint) || !assinatura.keys?.p256dh || !assinatura.keys?.auth) {
          throw regraViolada("Assinatura de notificação inválida.");
        }
        await pool.query(
          `insert into push_assinaturas (endpoint, pessoa_id, chaves, criada_em) values ($1, $2, $3, $4)
           on conflict (endpoint) do update set pessoa_id = excluded.pessoa_id, chaves = excluded.chaves`,
          [assinatura.endpoint, atorId, JSON.stringify(assinatura.keys), relogio.agora()],
        );
      },

      async cancelar(atorId: string, endpoint: string) {
        await pool.query(`delete from push_assinaturas where endpoint = $1 and pessoa_id = $2`, [endpoint, atorId]);
      },
    },

    financas: criarFinancas(contexto),
    exemplo: criarExemplo(contexto),

    pessoas: {
      /** Nomes de quem pode receber item ou tarefa. Sem e-mail, serve para os seletores. */
      async listarMembros(atorId: string): Promise<{ id: string; nome: string }[]> {
        await exigir(pool, atorId, "ver_eventos");
        return linhas(
          `select id, nome from perfis
           where situacao = 'ativa' and (categoria is not null or cargo is not null)
           order by nome`,
        );
      },

      async listar(atorId: string): Promise<Pessoa[]> {
        await exigir(pool, atorId, "definir_papeis");
        return linhas<Pessoa>(
          `select ${COLUNAS_PESSOA} from perfis
           order by (categoria is null and cargo is null) desc, nome`,
        );
      },

      async obter(atorId: string, pessoaId: string): Promise<Pessoa> {
        await exigir(pool, atorId, "definir_papeis");
        const [pessoa] = await linhas<Pessoa>(
          `select ${COLUNAS_PESSOA} from perfis where id = $1`,
          [pessoaId],
        );
        if (!pessoa) throw naoEncontrado("Pessoa");
        return pessoa;
      },

      /** Define categoria e cargo. O cargo de Diretor de Material só muda por transferência. */
      async definirPapel(
        atorId: string,
        pessoaId: string,
        novo: { categoria: Categoria | null; cargo: Cargo | null },
      ): Promise<void> {
        await emTransacao(async (tx, avisar) => {
          const ator = await exigir(tx, atorId, "definir_papeis");
          const pessoa = await travarPessoa(tx, pessoaId);
          const mudouCargo = pessoa.cargo !== novo.cargo;

          if (mudouCargo) {
            if (atorId === pessoaId) {
              throw regraViolada("Outro diretor precisa alterar o seu cargo.");
            }
            if (pessoa.cargo === "diretor_material" || novo.cargo === "diretor_material") {
              throw regraViolada("O cargo de Diretor de Material só muda por transferência.");
            }
            const mexeNaPresidencia =
              pessoa.cargo === "presidente" || novo.cargo === "presidente";
            if (
              mexeNaPresidencia &&
              ator.cargo !== "presidente" &&
              ator.cargo !== "diretor_material"
            ) {
              throw regraViolada(
                "Só o Presidente ou o Diretor de Material pode alterar a presidência.",
              );
            }
            if (novo.cargo) {
              const ocupante = await tx.query(
                `select 1 from perfis where cargo = $1 and id <> $2 for update`,
                [novo.cargo, pessoaId],
              );
              if (ocupante.rowCount) throw regraViolada("Esse cargo já está ocupado.");
            }
          }
          if (pessoa.cargo && !novo.cargo && !novo.categoria) {
            throw regraViolada("Defina uma categoria para quem sai da diretoria.");
          }
          if (pessoa.cargo && !novo.cargo) await retirarDelegacoes(tx, atorId, pessoaId);

          await tx.query(`update perfis set categoria = $1, cargo = $2 where id = $3`, [
            novo.categoria,
            novo.cargo,
            pessoaId,
          ]);
          await auditar(tx, atorId, "papel_definido", pessoaId, {
            antes: { categoria: pessoa.categoria, cargo: pessoa.cargo },
            depois: novo,
          });
          avisar({
            destinatarioId: pessoaId,
            tipo: "papel_alterado",
            titulo: "Seu acesso foi atualizado",
            corpo: "A diretoria atualizou seu papel na bateria.",
            link: "/mais",
          });
        });
      },

      async definirSituacao(
        atorId: string,
        pessoaId: string,
        situacao: Situacao,
      ): Promise<void> {
        await emTransacao(async (tx, avisar) => {
          await exigir(tx, atorId, "definir_papeis");
          if (atorId === pessoaId) {
            throw regraViolada("Você não pode alterar a sua própria situação.");
          }
          const pessoa = await travarPessoa(tx, pessoaId);
          if (situacao !== "ativa" && ehCargoProtegido(pessoa.cargo)) {
            throw regraViolada("Transfira o cargo antes de suspender ou desativar essa pessoa.");
          }
          if (pessoa.situacao === situacao) return;

          await tx.query(`update perfis set situacao = $1 where id = $2`, [situacao, pessoaId]);
          await auditar(tx, atorId, "situacao_definida", pessoaId, {
            antes: pessoa.situacao,
            depois: situacao,
          });
          if (situacao === "desativada") {
            const pendentes = await tx.query<{ rotulo: string }>(
              `select coalesce(i.codigo || ' ', '') || i.nome as rotulo
               from emprestimos e join itens i on i.id = e.item_id
               where e.responsavel_id = $1 and e.situacao = 'retirado'`,
              [pessoaId],
            );
            if (pendentes.rowCount) {
              const lista = pendentes.rows.map((r) => r.rotulo).join(", ");
              for (const id of await destinatarios(tx, "aprovar_emprestimos", atorId)) {
                avisar({
                  destinatarioId: id,
                  tipo: "conta_desativada_com_item",
                  titulo: "Conta desativada com item pendente",
                  corpo: `${pessoa.nome} ainda está com: ${lista}.`,
                  link: "/emprestimos",
                });
              }
            }
          }
          if (situacao === "suspensa") {
            avisar({
              destinatarioId: pessoaId,
              tipo: "situacao_alterada",
              titulo: "Sua conta foi suspensa",
              corpo: "Você não pode fazer pedidos durante a suspensão.",
            });
          }
        });
      },

      /** Passa o cargo ao próximo diretor. Quem sai perde os poderes ao confirmar. */
      async transferirCargoMaterial(atorId: string, novoDiretorId: string): Promise<void> {
        await emTransacao(async (tx, avisar) => {
          await exigir(tx, atorId, "transferir_cargo_material");
          // Trava primeiro o atual diretor, para duas transferências não ocorrerem juntas.
          const atuais = await tx.query<Pessoa>(
            `select ${COLUNAS_PESSOA} from perfis where cargo = 'diretor_material' for update`,
          );
          const atual = atuais.rows[0];
          const novo = await travarPessoa(tx, novoDiretorId);

          if (atual?.id === novoDiretorId) {
            throw regraViolada("Essa pessoa já ocupa o cargo de Diretor de Material.");
          }
          if (novo.situacao !== "ativa") {
            throw regraViolada("O cargo só pode ser transferido para uma conta ativa.");
          }
          if (novo.cargo && novo.cargo !== "suplente_material") {
            throw regraViolada("Essa pessoa ocupa outro cargo. Libere o cargo antes.");
          }

          if (atual) {
            await retirarDelegacoes(tx, atorId, atual.id);
            await tx.query(
              `update perfis set cargo = null, categoria = coalesce(categoria, 'ritmista')
               where id = $1`,
              [atual.id],
            );
          }
          await tx.query(`update perfis set cargo = 'diretor_material' where id = $1`, [
            novoDiretorId,
          ]);
          await auditar(tx, atorId, "cargo_material_transferido", novoDiretorId, {
            anterior: atual?.id ?? null,
          });
          avisar({
            destinatarioId: novoDiretorId,
            tipo: "cargo_transferido",
            titulo: "Você agora é responsável pelo Material",
            corpo: "O cargo de Diretor de Material foi transferido para a sua conta.",
            link: "/mais",
          });
          if (atual) {
            avisar({
              destinatarioId: atual.id,
              tipo: "cargo_transferido",
              titulo: "Cargo de Material transferido",
              corpo: `O cargo de Diretor de Material saiu da sua conta e foi para ${novo.nome}.`,
              link: "/mais",
            });
          }
        });
      },
    },

    permissoes: {
      async listar(atorId: string, pessoaId: string): Promise<Delegacao[]> {
        await exigir(pool, atorId, "delegar_permissoes");
        return linhas<Delegacao>(
          `select d.permissao, p.nome as "concedidaPorNome", d.concedida_em as "concedidaEm"
           from permissoes_delegadas d
           left join perfis p on p.id = d.concedida_por
           where d.perfil_id = $1 and d.retirada_em is null
           order by d.concedida_em`,
          [pessoaId],
        );
      },

      async conceder(
        atorId: string,
        pessoaId: string,
        permissao: PermissaoDelegavel,
      ): Promise<void> {
        await emTransacao(async (tx, avisar) => {
          await exigir(tx, atorId, "delegar_permissoes");
          const pessoa = await travarPessoa(tx, pessoaId);
          if (!pessoa.cargo || pessoa.cargo === "diretor_material") {
            throw regraViolada("Permissões só podem ser concedidas a outros diretores.");
          }
          const { rowCount } = await tx.query(
            `insert into permissoes_delegadas (perfil_id, permissao, concedida_por, concedida_em)
             values ($1, $2, $3, $4)
             on conflict (perfil_id, permissao) where retirada_em is null do nothing`,
            [pessoaId, permissao, atorId, relogio.agora()],
          );
          if (!rowCount) return;
          await auditar(tx, atorId, "permissao_concedida", pessoaId, { permissao });
          avisar({
            destinatarioId: pessoaId,
            tipo: "permissao_alterada",
            titulo: "Nova permissão",
            corpo: "O Diretor de Material concedeu uma permissão a você.",
            link: "/mais",
          });
        });
      },

      async retirar(
        atorId: string,
        pessoaId: string,
        permissao: PermissaoDelegavel,
      ): Promise<void> {
        await emTransacao(async (tx, avisar) => {
          await exigir(tx, atorId, "delegar_permissoes");
          const { rowCount } = await tx.query(
            `update permissoes_delegadas set retirada_por = $1, retirada_em = $2
             where perfil_id = $3 and permissao = $4 and retirada_em is null`,
            [atorId, relogio.agora(), pessoaId, permissao],
          );
          if (!rowCount) return;
          await auditar(tx, atorId, "permissao_retirada", pessoaId, { permissao });
          avisar({
            destinatarioId: pessoaId,
            tipo: "permissao_alterada",
            titulo: "Permissão retirada",
            corpo: "O Diretor de Material retirou uma permissão sua.",
            link: "/mais",
          });
        });
      },
    },

    avisos: {
      listar: (atorId: string) =>
        linhas<Notificacao>(
          `select id, tipo, titulo, corpo, link, criada_em as "criadaEm", lida_em as "lidaEm"
           from notificacoes where destinatario_id = $1
           order by criada_em desc limit 100`,
          [atorId],
        ),

      async contarNaoLidos(atorId: string): Promise<number> {
        const [linha] = await linhas<{ total: number }>(
          `select count(*)::int as total from notificacoes
           where destinatario_id = $1 and lida_em is null`,
          [atorId],
        );
        return linha.total;
      },

      async marcarTodosLidos(atorId: string): Promise<void> {
        await pool.query(
          `update notificacoes set lida_em = $1 where destinatario_id = $2 and lida_em is null`,
          [relogio.agora(), atorId],
        );
      },
    },

    auditoria: {
      async listar(atorId: string): Promise<RegistroAuditoria[]> {
        await exigir(pool, atorId, "ver_auditoria");
        return linhas<RegistroAuditoria>(
          `select a.id, autor.nome as "autorNome", a.acao,
                  coalesce(alvo.nome, a.detalhes ->> 'rotulo') as "alvoNome",
                  a.detalhes, a.criado_em as "criadoEm"
           from auditoria a
           left join perfis autor on autor.id = a.autor_id
           left join perfis alvo on alvo.id = a.alvo_id
           order by a.criado_em desc limit 200`,
        );
      },
    },
  };
}
