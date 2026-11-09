import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { cadastrar, entrar, entrarComGoogle } from "./acoes";

export const metadata = { title: "Entrar | Narcóticos Material" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; erro?: string }>;
}) {
  const supabase = await criarClienteSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/inicio");

  const { modo, erro } = await searchParams;
  const criandoConta = modo === "cadastro";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
      <Image src="/logo.png" alt="Logo da Bateria Narcóticos" width={112} height={112} priority className="mx-auto mb-3" />
      <h1 className="text-center text-2xl font-bold">Narcóticos Material</h1>
      <p className="mb-6 text-center text-sm text-suave">
        {criandoConta ? "Crie sua conta para começar." : "Entre para ver o material da bateria."}
      </p>

      {erro && (
        <p role="alert" className="mb-3 rounded-lg bg-marca-suave p-3 text-sm font-medium text-marca">
          Não foi possível entrar. Tente novamente.
        </p>
      )}

      <Formulario key={criandoConta ? "cadastro" : "login"} acao={criandoConta ? cadastrar : entrar} className="space-y-3">
        {criandoConta && (
          <div>
            <label htmlFor="nome" className="rotulo">Nome</label>
            <input id="nome" name="nome" required autoComplete="name" className="campo" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="rotulo">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="campo" />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete={criandoConta ? "new-password" : "current-password"}
            className="campo"
          />
        </div>
        <BotaoEnviar className="w-full">{criandoConta ? "Criar conta" : "Entrar"}</BotaoEnviar>
      </Formulario>

      {process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "true" && (
        <form action={entrarComGoogle} className="mt-3">
          <BotaoEnviar variante="secundario" className="w-full">Continuar com Google</BotaoEnviar>
        </form>
      )}

      <Link
        href={criandoConta ? "/entrar" : "/entrar?modo=cadastro"}
        className="mt-4 flex min-h-11 items-center justify-center text-sm font-semibold text-marca"
      >
        {criandoConta ? "Já tenho conta" : "Criar uma conta"}
      </Link>
      <Link href="/instalar" className="flex min-h-11 items-center justify-center text-sm text-suave">
        Como instalar no celular
      </Link>
    </main>
  );
}
