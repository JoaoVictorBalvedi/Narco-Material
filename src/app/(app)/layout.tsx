import { Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BarraInferior, type ItemNavegacao } from "@/componentes/barra-inferior";
import { contarPendencias } from "@/lib/pendencias";
import { atorAtual } from "@/lib/sessao";
import { rodarRotinasSeNecessario, sistema } from "@/lib/sistema";
import { papelDe, pode } from "@/sistema/permissoes";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const ator = await atorAtual();
  await rodarRotinasSeNecessario();
  const [naoLidos, pendencias] = await Promise.all([sistema.avisos.contarNaoLidos(ator.id), contarPendencias(ator)]);

  const itens: ItemNavegacao[] = ["inicio", "inventario"];
  if (pode(ator, "pedir_emprestimo")) itens.push("emprestimos");
  if (pode(ator, "ver_eventos")) itens.push("eventos");
  itens.push("mais");

  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 bg-marca pt-[env(safe-area-inset-top)] text-marca-texto">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/inicio" translate="no" className="flex items-center gap-2 text-lg font-bold">
            <Image src="/logo.png" alt="" width={38} height={38} className="rounded-full bg-white" />
            Narco Material
          </Link>
          <Link
            href="/avisos"
            aria-label={naoLidos ? `Avisos: ${naoLidos} não lidos` : "Avisos"}
            className="relative flex size-11 items-center justify-center rounded-lg"
          >
            <Bell aria-hidden size={22} />
            {naoLidos > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-superficie px-1 text-xs font-bold text-marca">
                {naoLidos > 9 ? "9+" : naoLidos}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        {ator.situacao === "suspensa" && (
          <p role="status" className="mb-4 rounded-lg bg-alerta-suave p-3 text-sm font-medium text-alerta">
            Sua conta está suspensa. Durante a suspensão, você só pode consultar o catálogo.
          </p>
        )}
        {ator.situacao === "ativa" && papelDe(ator) === "novo" && (
          <p role="status" className="mb-4 rounded-lg bg-alerta-suave p-3 text-sm font-medium text-alerta">
            Fale com um diretor para definir sua categoria na bateria e liberar os pedidos de empréstimo.
          </p>
        )}
        {children}
      </main>
      <BarraInferior itens={itens} marcadores={{ emprestimos: pendencias.total }} />
    </div>
  );
}
