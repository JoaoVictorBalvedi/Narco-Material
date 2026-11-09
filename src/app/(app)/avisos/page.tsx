import Link from "next/link";
import { BotaoEnviar } from "@/componentes/formulario";
import { formatarDataHora } from "@/lib/formato";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { marcarLidos } from "./acoes";

export const metadata = { title: "Avisos | Narcóticos Material" };

export default async function Page() {
  const ator = await atorAtual();
  const avisos = await sistema.avisos.listar(ator.id);
  const temNaoLidos = avisos.some((a) => !a.lidaEm);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Avisos</h1>
        {temNaoLidos && (
          <form action={marcarLidos}>
            <BotaoEnviar variante="secundario">Marcar como lidos</BotaoEnviar>
          </form>
        )}
      </div>
      {avisos.length === 0 && <p className="cartao text-center text-sm text-suave">Nenhum aviso por enquanto.</p>}
      <ul className="space-y-2">
        {avisos.map((aviso) => {
          const conteudo = (
            <>
              <p className="flex items-center gap-2 font-semibold">
                {!aviso.lidaEm && <span className="selo-marca">Novo</span>}
                {aviso.titulo}
              </p>
              <p className="text-sm">{aviso.corpo}</p>
              <p className="mt-1 text-xs text-suave">{formatarDataHora(aviso.criadaEm)}</p>
            </>
          );
          return (
            <li key={aviso.id}>
              {aviso.link ? (
                <Link href={aviso.link} className="cartao block">{conteudo}</Link>
              ) : (
                <div className="cartao">{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
