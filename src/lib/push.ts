import "server-only";
import type { Pool } from "pg";
import webpush, { type WebPushError } from "web-push";
import type { Notificador } from "@/sistema/portas";

export const chavePublicaPush = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Sem as chaves configuradas, os avisos continuam aparecendo dentro do app. */
export function criarNotificadorPush(pool: Pool): Notificador {
  return {
    async enviar(avisos) {
      const publica = chavePublicaPush();
      const privada = process.env.VAPID_PRIVATE_KEY;
      if (!publica || !privada) return;
      webpush.setVapidDetails(process.env.VAPID_CONTATO ?? "https://narcoticos.invalid", publica, privada);

      await Promise.all(
        avisos.map(async (aviso) => {
          const { rows } = await pool.query<{ endpoint: string; chaves: { p256dh: string; auth: string } }>(
            `select endpoint, chaves from push_assinaturas where pessoa_id = $1`,
            [aviso.destinatarioId],
          );
          const conteudo = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, link: aviso.link ?? "/avisos" });
          await Promise.all(
            rows.map(async ({ endpoint, chaves }) => {
              try {
                await webpush.sendNotification({ endpoint, keys: chaves }, conteudo);
              } catch (erro) {
                const status = (erro as WebPushError).statusCode;
                // O aparelho desinstalou o app ou cancelou as notificações.
                if (status === 404 || status === 410) {
                  await pool.query(`delete from push_assinaturas where endpoint = $1`, [endpoint]);
                } else {
                  console.error("Falha ao enviar push", status);
                }
              }
            }),
          );
        }),
      );
    },
  };
}
