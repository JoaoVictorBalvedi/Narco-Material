// Cópia de segurança: grava todas as tabelas em um JSON, na pasta exportacoes/.
// Uso: npm run exportar. Contém dados pessoais e financeiros: guarde em local privado.
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
  );
  const copia = { exportadoEm: new Date().toISOString(), tabelas: {} };
  for (const { table_name: tabela } of rows) {
    copia.tabelas[tabela] = (await db.query(`select * from "${tabela}"`)).rows;
  }
  mkdirSync("exportacoes", { recursive: true });
  const arquivo = `exportacoes/narco-${copia.exportadoEm.slice(0, 10)}.json`;
  writeFileSync(arquivo, JSON.stringify(copia, null, 1), { mode: 0o600 });
  console.log(`Cópia salva em ${arquivo}. Fotos e comprovantes ficam no armazenamento do Supabase.`);
} finally {
  await db.end();
}
