import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const SERVIDOR = "postgresql://postgres:postgres@127.0.0.1:54322";
export const URL_TESTE = `${SERVIDOR}/narco_teste`;

/**
 * Recria um banco só de testes com as migrações reais, sem tocar nos dados de
 * desenvolvimento. O schema auth, do Supabase, é reduzido ao que o app usa.
 */
export default async function prepararBanco() {
  const admin = new Client({ connectionString: `${SERVIDOR}/postgres` });
  await admin.connect();
  await admin.query("drop database if exists narco_teste with (force)");
  await admin.query("create database narco_teste");
  await admin.end();

  const banco = new Client({ connectionString: URL_TESTE });
  await banco.connect();
  await banco.query(`
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
  `);
  const pasta = join(process.cwd(), "supabase/migrations");
  for (const arquivo of readdirSync(pasta).sort()) {
    await banco.query(readFileSync(join(pasta, arquivo), "utf8"));
  }
  await banco.end();
}
