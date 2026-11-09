import { BotaoEnviar } from "@/componentes/formulario";
import { sair } from "../(publico)/entrar/acoes";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-bold">Conta desativada</h1>
      <p className="text-sm text-suave">Fale com a diretoria se você acha que isso é um engano.</p>
      <form action={sair}>
        <BotaoEnviar variante="secundario" className="w-full">Sair</BotaoEnviar>
      </form>
    </main>
  );
}
