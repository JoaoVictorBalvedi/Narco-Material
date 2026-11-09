import { Pool } from "pg";
import { criarSistema } from "../src/sistema";
import type { Cargo, Categoria } from "../src/sistema/permissoes";
import type { Aviso } from "../src/sistema/portas";

const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/narco_teste",
});

export const relogio = { atual: new Date("2026-11-10T15:00:00Z"), agora() { return relogio.atual; } };
export const enviados: Aviso[] = [];
export const arquivosGuardados = new Map<string, string>();
export const sistema = criarSistema({
  pool,
  relogio,
  notificador: { enviar: async (avisos) => void enviados.push(...avisos) },
  arquivos: {
    guardar: async (bucket, caminho) => void arquivosGuardados.set(caminho, bucket),
    remover: async (_bucket, caminhos) => caminhos.forEach((c) => arquivosGuardados.delete(c)),
    urlPublica: (caminho) => `https://arquivos.teste/${caminho}`,
    urlAssinada: async (caminho) => `https://arquivos.teste/assinado/${caminho}`,
  },
});

export async function limpar() {
  enviados.length = 0;
  arquivosGuardados.clear();
  relogio.atual = new Date("2026-11-10T15:00:00Z");
  await pool.query("truncate auth.users cascade");
}

let contador = 0;

/** Cria a conta como o Supabase Auth faria, disparando o gatilho do perfil. */
export async function criarPessoa(papel: { categoria?: Categoria; cargo?: Cargo } = {}) {
  contador += 1;
  const { rows } = await pool.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`pessoa${contador}@teste.local`, JSON.stringify({ nome: `Pessoa ${contador}` })],
  );
  const id = rows[0].id;
  await pool.query(`update perfis set categoria = $1, cargo = $2 where id = $3`, [
    papel.categoria ?? null,
    papel.cargo ?? null,
    id,
  ]);
  return id;
}

export const encerrar = () => pool.end();

export const foto = { bytes: new Uint8Array([1, 2, 3]), tipo: "image/webp" };

export async function categoria(prefixo: string) {
  const { rows } = await pool.query<{ id: string }>(`select id from categorias where prefixo = $1`, [prefixo]);
  return rows[0].id;
}

export async function criarItem(diretor: string, nome = "Caixa") {
  const { id } = await sistema.inventario.cadastrar(diretor, {
    tipo: "individual", categoriaId: await categoria("CX"), nome, estado: "bom", foto,
  });
  return id;
}

export async function criarEstoque(diretor: string, quantidade = 10, quantidadeMinima?: number) {
  const { id } = await sistema.inventario.cadastrar(diretor, {
    tipo: "estoque", categoriaId: await categoria("PL"), nome: "Pele", variacao: "12\"", estado: "novo", foto, quantidade, quantidadeMinima,
  });
  return id;
}

/** Avança o relógio simulado. */
export const avancarHoras = (horas: number) => {
  relogio.atual = new Date(relogio.atual.getTime() + horas * 3_600_000);
};

export const consultar = <T extends object>(sql: string, params: unknown[] = []) =>
  pool.query<T>(sql, params).then((r) => r.rows);
