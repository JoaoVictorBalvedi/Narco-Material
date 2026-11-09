import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CampoTermo, CamposPedido } from "@/componentes/campos-pedido";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { precisaAprovacao } from "@/sistema/emprestimos";
import { pedir } from "../acoes";
import { EscolherItens } from "./escolher-itens";

export const metadata = { title: "Pegar um instrumento | Narcóticos Material" };

export default async function Page({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const ator = await exigirAcao("pedir_emprestimo");
  const { item } = await searchParams;
  const itens = (await sistema.inventario.listar(ator.id))
    .filter((i) => i.tipo === "individual" && (i.disponibilidade === "disponivel" || i.id === item))
    .map(({ id, nome, codigo, grupo, fotoUrl }) => ({ id, nome, codigo, grupo, fotoUrl }));
  const hoje = dataLocal(new Date());
  const semAprovacao = !precisaAprovacao(ator, 3);

  return (
    <>
      <Link href="/inicio" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Voltar
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Pegar um instrumento</h1>
      <Formulario acao={pedir.bind(null, "/emprestimos")} className="space-y-5">
        <EscolherItens itens={itens} inicial={item} />
        <div className="cartao space-y-4">
          <CamposPedido hoje={hoje} />
          {semAprovacao && <CampoTermo name="agora" rotulo="Vou pegar agora e aceito o termo" obrigatorio={false} />}
        </div>
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10">
          <BotaoEnviar className="w-full text-base shadow-lg">{semAprovacao ? "Confirmar" : "Enviar pedido"}</BotaoEnviar>
        </div>
      </Formulario>
    </>
  );
}
