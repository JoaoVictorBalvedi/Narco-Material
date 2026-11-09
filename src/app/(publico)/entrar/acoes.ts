"use server";

import { AuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { EstadoAcao } from "@/lib/estado-acao";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

function traduzir(erro: AuthError): string {
  // Sem resposta do serviço: tentar de novo com outros dados não adiantaria.
  if (erro instanceof AuthRetryableFetchError) {
    return "O serviço de login está fora do ar. Tente novamente em alguns minutos.";
  }
  switch (erro.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com esse e-mail.";
    case "weak_password":
      return "Use uma senha com pelo menos 6 caracteres.";
    case "email_address_invalid":
    case "validation_failed":
      return "Confira o e-mail informado.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    default:
      console.error("Erro de autenticação sem tradução", erro.code, erro.status);
      return "Não foi possível continuar. Tente novamente.";
  }
}

const texto = (dados: FormData, campo: string) => String(dados.get(campo) ?? "").trim();

export async function entrar(_: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const supabase = await criarClienteSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: texto(dados, "email"),
    password: String(dados.get("senha") ?? ""),
  });
  if (error) return { erro: traduzir(error) };
  redirect("/inicio");
}

export async function cadastrar(_: EstadoAcao, dados: FormData): Promise<EstadoAcao> {
  const nome = texto(dados, "nome");
  if (!nome) return { erro: "Informe seu nome." };

  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: texto(dados, "email"),
    password: String(dados.get("senha") ?? ""),
    options: { data: { nome } },
  });
  if (error) return { erro: traduzir(error) };
  if (!data.session) return { sucesso: "Conta criada. Confirme pelo link enviado ao seu e-mail." };
  redirect("/inicio");
}

export async function entrarComGoogle() {
  const origem = (await headers()).get("origin");
  const supabase = await criarClienteSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origem}/auth/callback` },
  });
  if (error || !data.url) redirect("/entrar?erro=login");
  redirect(data.url);
}

export async function sair() {
  const supabase = await criarClienteSupabase();
  await supabase.auth.signOut();
  redirect("/entrar");
}
