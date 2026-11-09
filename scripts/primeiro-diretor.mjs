// Define quem é o primeiro Diretor de Material. Só funciona enquanto ninguém ocupa o cargo.
// Uso: npm run primeiro-diretor -- pessoa@exemplo.com (a conta precisa já existir no app)
import pg from "pg";

const email = process.argv[2];
if (!email) {
  console.error("Informe o e-mail da conta: npm run primeiro-diretor -- pessoa@exemplo.com");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const atual = await db.query("select 1 from perfis where cargo = 'diretor_material'");
  if (atual.rowCount) {
    console.error("O cargo já está ocupado. Use a transferência dentro do app.");
    process.exitCode = 1;
  } else {
    const { rowCount } = await db.query(
      "update perfis set cargo = 'diretor_material', situacao = 'ativa' where lower(email) = lower($1)",
      [email],
    );
    if (rowCount) {
      console.log("Pronto: essa conta agora é o Diretor de Material.");
    } else {
      console.error("Conta não encontrada. Crie a conta no app primeiro.");
      process.exitCode = 1;
    }
  }
} finally {
  await db.end();
}
