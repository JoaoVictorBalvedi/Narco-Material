import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { pode, type Acao } from "@/sistema/permissoes";
import { sistema } from "./sistema";
import { criarClienteSupabase } from "./supabase/servidor";

/** Quem está usando o app. Leva ao login se não houver sessão válida. */
export const atorAtual = cache(async () => {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");

  const ator = await sistema.ator(data.user.id);
  if (!ator) redirect("/entrar");
  if (ator.situacao === "desativada") redirect("/conta-desativada");
  return ator;
});

/** Para páginas restritas: quem não pode acessar volta para o início. */
export async function exigirAcao(acao: Acao) {
  const ator = await atorAtual();
  if (!pode(ator, acao)) redirect("/inicio");
  return ator;
}
