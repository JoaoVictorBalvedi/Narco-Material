import "server-only";
import { Pool } from "pg";
import { criarSistema } from "@/sistema";
import { relogioReal } from "@/sistema/portas";
import { arquivosSupabase } from "./arquivos";
import { criarNotificadorPush } from "./push";

const global_ = globalThis as unknown as { poolNarco?: Pool };

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento.
const pool = (global_.poolNarco ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
}));

export const sistema = criarSistema({
  pool,
  relogio: relogioReal,
  notificador: criarNotificadorPush(pool),
  arquivos: arquivosSupabase,
});

const INTERVALO_ROTINAS = 5 * 60_000;
const estadoRotinas = globalThis as unknown as { ultimaRotina?: number };

/**
 * A rotina diária cobre os lembretes. Rodar também durante o uso faz a fila andar
 * logo depois das 24 horas, sem depender de um agendador pago.
 */
export async function rodarRotinasSeNecessario() {
  const agora = Date.now();
  if (agora - (estadoRotinas.ultimaRotina ?? 0) < INTERVALO_ROTINAS) return;
  estadoRotinas.ultimaRotina = agora;
  await sistema.emprestimos.executarRotinas().catch((erro) => console.error("Falha nas rotinas", erro));
}
