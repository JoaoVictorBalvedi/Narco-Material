import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { dataLocal, dataValida, ratear } from "./datas";
import { naoEncontrado, regraViolada, semPermissao } from "./erros";
import type { Contexto } from "./index";
import { pode } from "./permissoes";
import type { ArquivoEnviado, Aviso } from "./portas";

export type TipoItem = "individual" | "estoque";
export const ESTADOS = ["novo", "bom", "regular", "ruim", "fora_de_uso"] as const;
export type Estado = (typeof ESTADOS)[number];

export const NOME_ESTADO: Record<Estado, string> = {
  novo: "Novo",
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
  fora_de_uso: "Fora de uso",
};

export type Disponibilidade =
  | "disponivel"
  | "emprestado"
  | "aguardando_conferencia"
  | "guardado_fila"
  | "reservado_evento"
  | "manutencao"
  | "fora_de_uso"
  | "em_estoque"
  | "estoque_baixo"
  | "sem_estoque";

export const NOME_DISPONIBILIDADE: Record<Disponibilidade, string> = {
  disponivel: "Disponível",
  emprestado: "Emprestado",
  aguardando_conferencia: "Aguardando conferência",
  guardado_fila: "Guardado para a fila",
  reservado_evento: "Reservado para evento",
  manutencao: "Em manutenção",
  fora_de_uso: "Fora de uso",
  em_estoque: "Em estoque",
  estoque_baixo: "Estoque baixo",
  sem_estoque: "Sem estoque",
};

export type ItemResumo = {
  id: string;
  tipo: TipoItem;
  nome: string;
  variacao: string | null;
  codigo: string | null;
  descricao: string | null;
  estado: Estado;
  localizacao: string;
  quantidade: number | null;
  quantidadeMinima: number | null;
  categoriaId: string;
  /** O tipo, como Caixa, ou a própria categoria quando ela não tem tipos. */
  categoria: string;
  /** A categoria principal, como Instrumentos. */
  grupoId: string;
  grupo: string;
  exemplo: boolean;
  fotoUrl: string | null;
  disponibilidade: Disponibilidade;
  /** Só vem preenchido para quem pode ver com quem o item está. */
  comQuem: string | null;
  devolucaoPrevista: string | null;
  eventoReservado: string | null;
  filaTotal: number;
};

export type Categoria = { id: string; nome: string; prefixo: string; tipoPadrao: TipoItem; total: number };
export type CategoriaPrincipal = Categoria & { tipos: Categoria[] };

export type EntradaHistorico = {
  id: string;
  data: string;
  servico: string;
  quemFez: string | null;
  /** Só vem preenchido para quem pode ver as finanças. */
  valorCentavos: number | null;
};

export type NovoItem = {
  tipo: TipoItem;
  categoriaId: string;
  nome: string;
  estado: Estado;
  foto: ArquivoEnviado;
  codigo?: string;
  variacao?: string;
  descricao?: string;
  localizacao?: string;
  quantidade?: number;
  quantidadeMinima?: number;
};

export type DadosGasto = {
  valorCentavos?: number;
  pagoPor?: string;
  reembolsoPendente?: boolean;
  comprovante?: ArquivoEnviado;
};

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const TIPOS_COMPROVANTE = [...TIPOS_FOTO, "application/pdf"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

export function validarArquivo(arquivo: ArquivoEnviado, tipos: string[]) {
  if (!tipos.includes(arquivo.tipo)) throw regraViolada("Formato de arquivo não aceito.");
  if (arquivo.bytes.length === 0 || arquivo.bytes.length > TAMANHO_MAXIMO) {
    throw regraViolada("O arquivo precisa ter até 5 MB.");
  }
}

export function extensao(tipo: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[tipo] ?? "bin";
}

/** Só aceita vídeos do YouTube ou do Google Drive, que podem ser exibidos na ficha. */
export function videoEmbutido(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  if (host === "youtube.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]+$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  const drive = host === "drive.google.com" && u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1];
  return drive ? `https://drive.google.com/file/d/${drive}/preview` : null;
}

export const rotuloDoItem = (i: { codigo: string | null; nome: string; variacao?: string | null }) =>
  [i.codigo, i.nome, i.variacao].filter(Boolean).join(" ");

const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type LinhaItem = Omit<ItemResumo, "fotoUrl" | "disponibilidade" | "comQuem"> & {
  foto: string | null;
  emManutencao: boolean;
  emprestimoSituacao: string | null;
  responsavelNome: string | null;
  temGuarda: boolean;
};

function consultaItens(filtro: string) {
  return `
    select i.id, i.tipo, i.nome, i.variacao, i.codigo, i.descricao, i.estado, i.localizacao,
      i.quantidade, i.quantidade_minima as "quantidadeMinima", i.categoria_id as "categoriaId",
      c.nome as categoria, coalesce(g.id, c.id) as "grupoId", coalesce(g.nome, c.nome) as grupo, i.exemplo, i.em_manutencao as "emManutencao",
      (select referencia from item_midias m where m.item_id = i.id and m.tipo = 'foto'
        order by m.criado_em limit 1) as foto,
      ativo.situacao as "emprestimoSituacao", ativo.nome as "responsavelNome",
      ativo.devolucao as "devolucaoPrevista",
      (select e.nome from evento_itens ei join eventos e on e.id = ei.evento_id
        where ei.item_id = i.id and ei.reserva_liberada_em is null
          and $1::date between e.data_inicio - e.antecedencia_dias and e.data_fim
        order by e.data_inicio limit 1) as "eventoReservado",
      exists (select 1 from fila_entradas f where f.item_id = i.id and f.situacao = 'vez'
        and (f.vez_expira_em is null or f.vez_expira_em > $2)) as "temGuarda",
      (select count(*)::int from fila_entradas f where f.item_id = i.id
        and f.situacao in ('aguardando', 'vez')) as "filaTotal"
    from itens i
    join categorias c on c.id = i.categoria_id
    left join categorias g on g.id = c.pai_id
    left join lateral (
      select e.situacao, p.nome, e.data_devolucao::text as devolucao
      from emprestimos e join perfis p on p.id = e.responsavel_id
      where e.item_id = i.id and e.situacao in ('retirado', 'devolvido') limit 1
    ) ativo on true
    ${filtro}
    order by coalesce(g.ordem, c.ordem), coalesce(g.nome, c.nome), c.nome, i.codigo nulls last, i.nome`;
}

function calcularDisponibilidade(l: LinhaItem): Disponibilidade {
  if (l.tipo === "estoque") {
    if (l.quantidade === 0) return "sem_estoque";
    return l.quantidadeMinima !== null && (l.quantidade ?? 0) < l.quantidadeMinima
      ? "estoque_baixo"
      : "em_estoque";
  }
  if (l.emprestimoSituacao === "retirado") return "emprestado";
  if (l.emprestimoSituacao === "devolvido") return "aguardando_conferencia";
  if (l.estado === "fora_de_uso") return "fora_de_uso";
  if (l.emManutencao) return "manutencao";
  if (l.eventoReservado) return "reservado_evento";
  if (l.temGuarda) return "guardado_fila";
  return "disponivel";
}

export function criarInventario(ctx: Contexto) {
  const { pool, relogio, arquivos, emTransacao, linhas, exigir, auditarAlvo, destinatarios } = ctx;

  async function lerItens(atorId: string, filtro: string, params: unknown[] = []) {
    const ator = await exigir(pool, atorId, "ver_catalogo");
    const agora = relogio.agora();
    const dados = await linhas<LinhaItem>(consultaItens(filtro), [dataLocal(agora), agora, ...params]);
    const veResponsavel = pode(ator, "ver_responsavel");
    return dados.map<ItemResumo>(
      ({ foto, emManutencao: _m, emprestimoSituacao: _e, responsavelNome, temGuarda: _t, ...resto }) => ({
        ...resto,
        fotoUrl: foto ? arquivos.urlPublica(foto) : null,
        disponibilidade: calcularDisponibilidade({
          foto, emManutencao: _m, emprestimoSituacao: _e, responsavelNome, temGuarda: _t, ...resto,
        }),
        comQuem: veResponsavel ? responsavelNome : null,
        devolucaoPrevista: veResponsavel ? resto.devolucaoPrevista : null,
      }),
    );
  }

  async function proximoCodigo(tx: PoolClient, categoriaId: string): Promise<string> {
    const { rows } = await tx.query<{ prefixo: string }>(
      `select prefixo from categorias where id = $1 for update`,
      [categoriaId],
    );
    if (!rows[0]) throw naoEncontrado("Categoria");
    const { prefixo } = rows[0];
    const atual = await tx.query<{ maior: number | null }>(
      `select max(substring(codigo from '-([0-9]+)$')::int) as maior from itens
       where codigo like $1 || '-%'`,
      [prefixo],
    );
    return `${prefixo}-${String((atual.rows[0].maior ?? 0) + 1).padStart(2, "0")}`;
  }

  function checarCodigo(codigo: string) {
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u.test(codigo)) {
      throw regraViolada("Use um código curto, com letras, números e hífen.");
    }
  }

  /** Avisa uma única vez, ao cruzar o mínimo, para não repetir a cada baixa. */
  async function baixarEstoque(
    tx: PoolClient,
    avisar: (a: Aviso) => void,
    atorId: string,
    itemId: string,
    quantidade: number,
  ) {
    const { rows } = await tx.query<{
      nome: string; variacao: string | null; codigo: string | null; quantidade: number | null;
      minima: number | null; tipo: TipoItem;
    }>(
      `select nome, variacao, codigo, quantidade, quantidade_minima as minima, tipo
       from itens where id = $1 for update`,
      [itemId],
    );
    const item = rows[0];
    if (!item) throw naoEncontrado("Item");
    if (item.tipo !== "estoque") throw regraViolada("Esse item não é de estoque.");
    const saldo = (item.quantidade ?? 0) - quantidade;
    if (saldo < 0) {
      throw regraViolada(`Só há ${item.quantidade} em estoque de ${rotuloDoItem(item)}.`);
    }
    await tx.query(`update itens set quantidade = $1 where id = $2`, [saldo, itemId]);
    if (item.minima !== null && saldo < item.minima && (item.quantidade ?? 0) >= item.minima) {
      for (const id of await destinatarios(tx, "editar_inventario")) {
        avisar({
          destinatarioId: id,
          tipo: "estoque_baixo",
          titulo: "Estoque baixo",
          corpo: `${rotuloDoItem(item)}: restam ${saldo}, e o mínimo é ${item.minima}.`,
          link: `/inventario/${itemId}`,
        });
      }
    }
  }

  async function exigirItem(tx: PoolClient, itemId: string) {
    const { rows } = await tx.query<{
      id: string; nome: string; codigo: string | null; variacao: string | null; tipo: TipoItem;
    }>(`select id, nome, codigo, variacao, tipo from itens where id = $1 for update`, [itemId]);
    if (!rows[0]) throw naoEncontrado("Item");
    return rows[0];
  }

  async function guardarFoto(itemId: string, foto: ArquivoEnviado) {
    validarArquivo(foto, TIPOS_FOTO);
    const caminho = `${itemId}/${randomUUID()}.${extensao(foto.tipo)}`;
    await arquivos.guardar("fotos", caminho, foto);
    return caminho;
  }

  /** Cria a saída financeira do lançamento único, com o valor rateado entre os itens. */
  async function criarSaida(
    tx: PoolClient,
    atorId: string,
    gasto: DadosGasto & { valorCentavos: number },
    dados: { data: string; descricao: string; quemFez?: string | null; itemIds: string[]; comprovante: string | null },
  ) {
    const { rows } = await tx.query<{ id: string }>(
      `insert into movimentacoes
         (tipo, data, descricao, quem_fez, valor_centavos, pago_por, comprovante, reembolso, criado_por, criado_em)
       values ('saida', $1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        dados.data, dados.descricao, dados.quemFez ?? null, gasto.valorCentavos,
        gasto.pagoPor?.trim() || null, dados.comprovante,
        gasto.reembolsoPendente ? "pendente" : "nao_se_aplica", atorId, relogio.agora(),
      ],
    );
    const partes = ratear(gasto.valorCentavos, dados.itemIds.length);
    for (const [i, itemId] of dados.itemIds.entries()) {
      await tx.query(
        `insert into movimentacao_itens (movimentacao_id, item_id, valor_centavos) values ($1, $2, $3)`,
        [rows[0].id, itemId, partes[i]],
      );
    }
    return rows[0].id;
  }

  function checarGasto(ator: Parameters<typeof pode>[0], gasto: DadosGasto) {
    if (gasto.valorCentavos === undefined) return;
    if (!pode(ator, "lancar_custos")) throw semPermissao();
    if (!Number.isInteger(gasto.valorCentavos) || gasto.valorCentavos <= 0) {
      throw regraViolada("Informe um valor maior que zero.");
    }
  }

  async function guardarComprovante(gasto: DadosGasto) {
    if (!gasto.comprovante) return null;
    if (gasto.valorCentavos === undefined) throw regraViolada("Informe o valor do comprovante.");
    validarArquivo(gasto.comprovante, TIPOS_COMPROVANTE);
    const caminho = `${randomUUID()}.${extensao(gasto.comprovante.tipo)}`;
    await arquivos.guardar("comprovantes", caminho, gasto.comprovante);
    return caminho;
  }

  return {
    baixarEstoque,

    categorias: {
      /** Categorias principais, cada uma com os seus tipos. */
      async listar(atorId: string): Promise<CategoriaPrincipal[]> {
        await exigir(pool, atorId, "ver_catalogo");
        const todas = await linhas<Categoria & { paiId: string | null }>(
          `select c.id, c.nome, c.prefixo, c.pai_id as "paiId", c.tipo_padrao as "tipoPadrao",
             count(i.id)::int as total
           from categorias c left join itens i on i.categoria_id = c.id
           group by c.id order by c.ordem, c.nome`,
        );
        return todas
          .filter((c) => !c.paiId)
          .map((c) => ({ ...c, tipos: todas.filter((t) => t.paiId === c.id) }));
      },

      async salvar(
        atorId: string,
        dados: { id?: string; nome: string; prefixo: string; paiId?: string | null; tipoPadrao?: TipoItem },
      ) {
        const nome = dados.nome.trim();
        const prefixo = dados.prefixo.trim().toUpperCase();
        if (!nome) throw regraViolada("Informe o nome.");
        if (!/^[A-Z0-9]{1,5}$/.test(prefixo)) throw regraViolada("Use uma sigla de até 5 letras ou números.");
        await emTransacao(async (tx) => {
          await exigir(tx, atorId, "editar_inventario");
          const repetida = await tx.query(
            `select 1 from categorias where (lower(nome) = lower($1) or prefixo = $2) and id is distinct from $3`,
            [nome, prefixo, dados.id ?? null],
          );
          if (repetida.rowCount) throw regraViolada("Já existe uma categoria com esse nome ou sigla.");
          const paiId = dados.paiId || null;
          if (paiId) {
            const pai = await tx.query<{ pai_id: string | null }>(`select pai_id from categorias where id = $1`, [paiId]);
            if (!pai.rows[0] || pai.rows[0].pai_id) throw regraViolada("Um tipo só pode ficar dentro de uma categoria principal.");
          }
          if (dados.id) {
            await tx.query(`update categorias set nome = $1, prefixo = $2 where id = $3`, [nome, prefixo, dados.id]);
          } else {
            const herdado = paiId
              ? (await tx.query<{ tipo: TipoItem }>(`select tipo_padrao as tipo from categorias where id = $1`, [paiId])).rows[0].tipo
              : "individual";
            await tx.query(
              `insert into categorias (nome, prefixo, pai_id, tipo_padrao) values ($1, $2, $3, $4)`,
              [nome, prefixo, paiId, dados.tipoPadrao ?? herdado],
            );
          }
        });
      },

      async remover(atorId: string, id: string) {
        await emTransacao(async (tx) => {
          await exigir(tx, atorId, "editar_inventario");
          const usados = await tx.query(`select 1 from itens where categoria_id = $1 limit 1`, [id]);
          if (usados.rowCount) throw regraViolada("Mova ou remova os itens dessa categoria antes.");
          const filhos = await tx.query(`select 1 from categorias where pai_id = $1 limit 1`, [id]);
          if (filhos.rowCount) throw regraViolada("Remova os tipos dessa categoria antes.");
          await tx.query(`delete from categorias where id = $1`, [id]);
        });
      },
    },

    /** A lista única do inventário: individuais e estoque juntos. */
    async listar(
      atorId: string,
      filtros: { busca?: string; categoriaId?: string; disponibilidade?: Disponibilidade; localizacao?: string } = {},
    ): Promise<ItemResumo[]> {
      const itens = await lerItens(atorId, "");
      const busca = normalizar(filtros.busca?.trim() ?? "");
      return itens.filter(
        (i) =>
          (!busca || normalizar(`${i.nome} ${i.codigo ?? ""} ${i.variacao ?? ""} ${i.descricao ?? ""}`).includes(busca)) &&
          (!filtros.categoriaId || i.categoriaId === filtros.categoriaId || i.grupoId === filtros.categoriaId) &&
          (!filtros.disponibilidade || i.disponibilidade === filtros.disponibilidade) &&
          (!filtros.localizacao || i.localizacao === filtros.localizacao),
      );
    },

    async obter(atorId: string, itemId: string) {
      const ator = await exigir(pool, atorId, "ver_catalogo");
      const [item] = await lerItens(atorId, "where i.id = $3", [itemId]);
      if (!item) throw naoEncontrado("Item");
      const veFinancas = pode(ator, "ver_financas");
      const veMembros = pode(ator, "ver_responsavel");

      const [midias, manutencoes, problemas, estoque, usos, escala, totalInvestido] = await Promise.all([
        linhas<{ id: string; tipo: "foto" | "video"; referencia: string }>(
          `select id, tipo, referencia from item_midias where item_id = $1 order by criado_em`,
          [itemId],
        ),
        linhas<EntradaHistorico>(
          `select m.id, m.data::text as data, m.servico, m.quem_fez as "quemFez",
             mi.valor_centavos as "valorCentavos"
           from manutencoes m
           join manutencao_itens x on x.manutencao_id = m.id
           left join movimentacao_itens mi on mi.movimentacao_id = m.movimentacao_id and mi.item_id = x.item_id
           where x.item_id = $1 order by m.data desc, m.criado_em desc`,
          [itemId],
        ),
        veMembros
          ? linhas<{ id: string; descricao: string; autorNome: string | null; criadoEm: Date; resolvidoEm: Date | null }>(
              `select pr.id, pr.descricao, p.nome as "autorNome", pr.criado_em as "criadoEm", pr.resolvido_em as "resolvidoEm"
               from problemas pr left join perfis p on p.id = pr.autor_id
               where pr.item_id = $1 order by pr.criado_em desc`,
              [itemId],
            )
          : [],
        linhas<{ id: string; tipo: "entrada" | "saida"; quantidade: number; motivo: string | null; criadoEm: Date; valorCentavos: number | null }>(
          `select e.id, e.tipo, e.quantidade, e.motivo, e.criado_em as "criadoEm", mv.valor_centavos as "valorCentavos"
           from estoque_movimentos e left join movimentacoes mv on mv.id = e.movimentacao_id
           where e.item_id = $1 order by e.criado_em desc limit 50`,
          [itemId],
        ),
        veMembros
          ? linhas<{ pessoaNome: string; origem: string; aceitoEm: Date }>(
              `select p.nome as "pessoaNome", t.origem, t.aceito_em as "aceitoEm"
               from termos_aceite t join perfis p on p.id = t.pessoa_id
               where t.item_id = $1 order by t.aceito_em desc limit 50`,
              [itemId],
            )
          : [],
        veMembros
          ? linhas<{ id: string; nome: string }>(
              `select p.id, p.nome from escala_ensaio e join perfis p on p.id = e.pessoa_id
               where e.item_id = $1 order by p.nome`,
              [itemId],
            )
          : [],
        veFinancas
          ? linhas<{ total: number }>(
              `select coalesce(sum(valor_centavos), 0)::int as total from movimentacao_itens where item_id = $1`,
              [itemId],
            )
          : [],
      ]);

      return {
        item,
        fotos: midias.filter((m) => m.tipo === "foto").map((m) => ({ id: m.id, url: arquivos.urlPublica(m.referencia) })),
        videos: midias.filter((m) => m.tipo === "video").map((m) => ({ id: m.id, url: m.referencia, embutido: videoEmbutido(m.referencia) })),
        manutencoes: manutencoes.map((m) => ({ ...m, valorCentavos: veFinancas ? m.valorCentavos : null })),
        problemas,
        estoque: estoque.map((e) => ({ ...e, valorCentavos: veFinancas ? e.valorCentavos : null })),
        usos,
        escala,
        totalInvestidoCentavos: veFinancas ? totalInvestido[0]?.total ?? 0 : null,
      };
    },

    async cadastrar(atorId: string, dados: NovoItem): Promise<{ id: string; codigo: string | null }> {
      await exigir(pool, atorId, "editar_inventario");
      const nome = dados.nome.trim();
      if (!nome) throw regraViolada("Informe o nome.");
      if (!ESTADOS.includes(dados.estado)) throw regraViolada("Escolha o estado de conservação.");
      if (dados.tipo === "estoque" && (!Number.isInteger(dados.quantidade) || (dados.quantidade ?? -1) < 0)) {
        throw regraViolada("Informe a quantidade.");
      }
      if (dados.codigo) checarCodigo(dados.codigo.trim());
      const id = randomUUID();
      const foto = await guardarFoto(id, dados.foto);
      const agora = relogio.agora();
      try {
        return await emTransacao(async (tx) => {
          const codigoInformado = dados.codigo?.trim();
          const codigo =
            dados.tipo === "individual"
              ? codigoInformado || (await proximoCodigo(tx, dados.categoriaId))
              : codigoInformado || null;
          if (codigo) {
            const repetido = await tx.query(`select 1 from itens where lower(codigo) = lower($1)`, [codigo]);
            if (repetido.rowCount) throw regraViolada(`O código ${codigo} já está em uso.`);
          }
          await tx.query(
            `insert into itens (id, tipo, categoria_id, nome, variacao, codigo, descricao, estado, localizacao,
               quantidade, quantidade_minima, criado_por, criado_em)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              id, dados.tipo, dados.categoriaId, nome, dados.variacao?.trim() || null, codigo,
              dados.descricao?.trim() || null, dados.estado, dados.localizacao?.trim() || "Salinha",
              dados.tipo === "estoque" ? dados.quantidade : null,
              dados.tipo === "estoque" ? dados.quantidadeMinima ?? null : null, atorId, agora,
            ],
          );
          await tx.query(
            `insert into item_midias (item_id, tipo, referencia, criado_em) values ($1, 'foto', $2, $3)`,
            [id, foto, agora],
          );
          await auditarAlvo(tx, atorId, "item_cadastrado", "item", id, rotuloDoItem({ codigo, nome }));
          return { id, codigo };
        });
      } catch (erro) {
        await arquivos.remover("fotos", [foto]).catch(() => {});
        throw erro;
      }
    },

    async editar(
      atorId: string,
      itemId: string,
      dados: {
        nome: string; categoriaId: string; estado: Estado; codigo?: string; variacao?: string;
        descricao?: string; localizacao?: string; quantidadeMinima?: number | null;
      },
    ) {
      const nome = dados.nome.trim();
      if (!nome) throw regraViolada("Informe o nome.");
      if (!ESTADOS.includes(dados.estado)) throw regraViolada("Escolha o estado de conservação.");
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        const item = await exigirItem(tx, itemId);
        const codigo = dados.codigo?.trim() || null;
        if (item.tipo === "individual" && !codigo) throw regraViolada("Informe o código.");
        if (codigo) {
          checarCodigo(codigo);
          const repetido = await tx.query(`select 1 from itens where lower(codigo) = lower($1) and id <> $2`, [codigo, itemId]);
          if (repetido.rowCount) throw regraViolada(`O código ${codigo} já está em uso.`);
        }
        await tx.query(
          `update itens set nome = $1, categoria_id = $2, estado = $3, codigo = $4, variacao = $5,
             descricao = $6, localizacao = $7, quantidade_minima = $8 where id = $9`,
          [
            nome, dados.categoriaId, dados.estado, codigo, dados.variacao?.trim() || null,
            dados.descricao?.trim() || null, dados.localizacao?.trim() || "Salinha",
            item.tipo === "estoque" ? dados.quantidadeMinima ?? null : null, itemId,
          ],
        );
        await auditarAlvo(tx, atorId, "item_editado", "item", itemId, rotuloDoItem({ codigo, nome }));
      });
    },

    /** Remove cadastros feitos por engano. Item com histórico deve virar "Fora de uso". */
    async remover(atorId: string, itemId: string) {
      const fotos = await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        const item = await exigirItem(tx, itemId);
        const { rows } = await tx.query<{ usado: boolean }>(
          `select exists (select 1 from emprestimos where item_id = $1)
             or exists (select 1 from manutencao_itens where item_id = $1)
             or exists (select 1 from movimentacao_itens where item_id = $1)
             or exists (select 1 from estoque_movimentos where item_id = $1)
             or exists (select 1 from evento_itens where item_id = $1) as usado`,
          [itemId],
        );
        if (rows[0].usado) {
          throw regraViolada("Esse item tem histórico. Marque como “Fora de uso” para preservá-lo.");
        }
        const midias = await tx.query<{ referencia: string }>(
          `select referencia from item_midias where item_id = $1 and tipo = 'foto'`,
          [itemId],
        );
        await tx.query(`delete from itens where id = $1`, [itemId]);
        await auditarAlvo(tx, atorId, "item_removido", "item", itemId, rotuloDoItem(item));
        return midias.rows.map((m) => m.referencia);
      });
      if (fotos.length) await arquivos.remover("fotos", fotos).catch(() => {});
    },

    async adicionarFoto(atorId: string, itemId: string, foto: ArquivoEnviado) {
      await exigir(pool, atorId, "editar_inventario");
      const caminho = await guardarFoto(itemId, foto);
      await emTransacao(async (tx) => {
        await exigirItem(tx, itemId);
        await tx.query(
          `insert into item_midias (item_id, tipo, referencia, criado_em) values ($1, 'foto', $2, $3)`,
          [itemId, caminho, relogio.agora()],
        );
      });
    },

    async adicionarVideo(atorId: string, itemId: string, url: string) {
      if (!videoEmbutido(url.trim())) throw regraViolada("Use um link do YouTube ou do Google Drive.");
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        await exigirItem(tx, itemId);
        await tx.query(
          `insert into item_midias (item_id, tipo, referencia, criado_em) values ($1, 'video', $2, $3)`,
          [itemId, url.trim(), relogio.agora()],
        );
      });
    },

    async removerMidia(atorId: string, midiaId: string) {
      const foto = await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        const { rows } = await tx.query<{ tipo: string; referencia: string; item_id: string }>(
          `select tipo, referencia, item_id from item_midias where id = $1 for update`,
          [midiaId],
        );
        if (!rows[0]) throw naoEncontrado("Arquivo");
        if (rows[0].tipo === "foto") {
          const fotos = await tx.query(`select 1 from item_midias where item_id = $1 and tipo = 'foto'`, [rows[0].item_id]);
          if (fotos.rowCount === 1) throw regraViolada("O item precisa ter pelo menos uma foto.");
        }
        await tx.query(`delete from item_midias where id = $1`, [midiaId]);
        return rows[0].tipo === "foto" ? rows[0].referencia : null;
      });
      if (foto) await arquivos.remover("fotos", [foto]).catch(() => {});
    },

    /** Entrada ou saída de estoque. Uma compra com valor já entra nas finanças. */
    async movimentarEstoque(
      atorId: string,
      dados: { itemId: string; tipo: "entrada" | "saida"; quantidade: number; motivo?: string } & DadosGasto,
    ) {
      if (!Number.isInteger(dados.quantidade) || dados.quantidade <= 0) {
        throw regraViolada("Informe uma quantidade maior que zero.");
      }
      const ator = await exigir(pool, atorId, "editar_inventario");
      checarGasto(ator, dados);
      const comprovante = await guardarComprovante(dados);
      await emTransacao(async (tx, avisar) => {
        const item = await exigirItem(tx, dados.itemId);
        if (item.tipo !== "estoque") throw regraViolada("Esse item não é de estoque.");
        if (dados.tipo === "saida") {
          await baixarEstoque(tx, avisar, atorId, dados.itemId, dados.quantidade);
        } else {
          await tx.query(`update itens set quantidade = quantidade + $1 where id = $2`, [dados.quantidade, dados.itemId]);
        }
        const movimentacaoId =
          dados.valorCentavos !== undefined
            ? await criarSaida(tx, atorId, { ...dados, valorCentavos: dados.valorCentavos }, {
                data: dataLocal(relogio.agora()),
                descricao: `Compra: ${dados.quantidade} × ${rotuloDoItem(item)}`,
                itemIds: [dados.itemId],
                comprovante,
              })
            : null;
        await tx.query(
          `insert into estoque_movimentos (item_id, tipo, quantidade, motivo, movimentacao_id, autor_id, criado_em)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [dados.itemId, dados.tipo, dados.quantidade, dados.motivo?.trim() || null, movimentacaoId, atorId, relogio.agora()],
        );
        await auditarAlvo(tx, atorId, "estoque_movimentado", "item", dados.itemId, rotuloDoItem(item), {
          tipo: dados.tipo, quantidade: dados.quantidade,
        });
      });
    },

    /**
     * Registra reforma ou troca em um ou mais itens. O valor entra nas finanças,
     * e as peças usadas saem do estoque, sem digitar duas vezes.
     */
    async registrarManutencao(
      atorId: string,
      dados: {
        itemIds: string[];
        data: string;
        servico: string;
        quemFez?: string;
        pecas?: { itemId: string; quantidade: number }[];
      } & DadosGasto,
    ): Promise<string> {
      const servico = dados.servico.trim();
      if (!servico) throw regraViolada("Descreva o que foi feito.");
      if (!dados.itemIds.length) throw regraViolada("Escolha pelo menos um item.");
      if (!dataValida(dados.data)) throw regraViolada("Informe a data.");
      if (dados.data > dataLocal(relogio.agora())) throw regraViolada("A data não pode estar no futuro.");
      for (const peca of dados.pecas ?? []) {
        if (!Number.isInteger(peca.quantidade) || peca.quantidade <= 0) throw regraViolada("Informe a quantidade da peça.");
      }
      const ator = await exigir(pool, atorId, "editar_inventario").catch(async (erro) => {
        // O Diretor Financeiro lança o custo de uma reforma sem editar o inventário.
        if (dados.valorCentavos === undefined || dados.pecas?.length) throw erro;
        return exigir(pool, atorId, "lancar_custos");
      });
      checarGasto(ator, dados);
      const comprovante = await guardarComprovante(dados);

      return emTransacao(async (tx, avisar) => {
        const itemIds = [...new Set(dados.itemIds)].sort();
        const itens = [];
        for (const id of itemIds) itens.push(await exigirItem(tx, id));
        const quemFez = dados.quemFez?.trim() || null;
        const movimentacaoId =
          dados.valorCentavos !== undefined
            ? await criarSaida(tx, atorId, { ...dados, valorCentavos: dados.valorCentavos }, {
                data: dados.data,
                descricao: `${servico} (${itens.map(rotuloDoItem).join(", ")})`,
                quemFez,
                itemIds,
                comprovante,
              })
            : null;
        const { rows } = await tx.query<{ id: string }>(
          `insert into manutencoes (data, servico, quem_fez, movimentacao_id, criado_por, criado_em)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [dados.data, servico, quemFez, movimentacaoId, atorId, relogio.agora()],
        );
        const manutencaoId = rows[0].id;
        for (const id of itemIds) {
          await tx.query(`insert into manutencao_itens (manutencao_id, item_id) values ($1, $2)`, [manutencaoId, id]);
        }
        for (const peca of dados.pecas ?? []) {
          await baixarEstoque(tx, avisar, atorId, peca.itemId, peca.quantidade);
          await tx.query(
            `insert into estoque_movimentos (item_id, tipo, quantidade, motivo, manutencao_id, autor_id, criado_em)
             values ($1, 'saida', $2, $3, $4, $5, $6)`,
            [peca.itemId, peca.quantidade, `Usado em: ${itens.map(rotuloDoItem).join(", ")}`, manutencaoId, atorId, relogio.agora()],
          );
        }
        await auditarAlvo(tx, atorId, "manutencao_registrada", "item", itemIds[0], itens.map(rotuloDoItem).join(", "), { servico });
        return manutencaoId;
      });
    },

    async avisarProblema(atorId: string, itemId: string, descricao: string) {
      const texto = descricao.trim();
      if (!texto) throw regraViolada("Descreva o problema.");
      await emTransacao(async (tx, avisar) => {
        const ator = await exigir(tx, atorId, "avisar_problema");
        const item = await exigirItem(tx, itemId);
        await tx.query(
          `insert into problemas (item_id, autor_id, descricao, criado_em) values ($1, $2, $3, $4)`,
          [itemId, atorId, texto, relogio.agora()],
        );
        for (const id of await destinatarios(tx, "editar_inventario", atorId)) {
          avisar({
            destinatarioId: id,
            tipo: "problema_item",
            titulo: `Problema em ${rotuloDoItem(item)}`,
            corpo: `${ator.nome}: ${texto}`,
            link: `/inventario/${itemId}`,
          });
        }
      });
    },

    async resolverProblema(atorId: string, problemaId: string) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        await tx.query(
          `update problemas set resolvido_por = $1, resolvido_em = $2 where id = $3 and resolvido_em is null`,
          [atorId, relogio.agora(), problemaId],
        );
      });
    },

    async definirEscalaEnsaio(atorId: string, itemId: string, pessoaIds: string[]) {
      await emTransacao(async (tx) => {
        await exigir(tx, atorId, "editar_inventario");
        await exigirItem(tx, itemId);
        await tx.query(`delete from escala_ensaio where item_id = $1`, [itemId]);
        for (const pessoaId of new Set(pessoaIds)) {
          await tx.query(`insert into escala_ensaio (item_id, pessoa_id) values ($1, $2)`, [itemId, pessoaId]);
        }
      });
    },
  };
}
