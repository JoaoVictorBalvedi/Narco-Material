import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { exigirAcao } from "@/lib/sessao";
import { criarEvento } from "../acoes";
import { CamposEvento } from "../campos-evento";

export const metadata = { title: "Novo evento | Narcóticos Material" };

export default async function Page() {
  await exigirAcao("gerenciar_eventos");
  return (
    <>
      <Link href="/eventos" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Eventos
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Novo evento</h1>
      <div className="cartao">
        <Formulario acao={criarEvento} className="space-y-3">
          <CamposEvento />
          <BotaoEnviar className="w-full">Criar evento</BotaoEnviar>
        </Formulario>
      </div>
    </>
  );
}
