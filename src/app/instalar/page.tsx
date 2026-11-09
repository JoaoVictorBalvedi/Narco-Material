import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { InstalarApp } from "@/componentes/instalar-app";

export const metadata = { title: "Instalar | Narcóticos Material" };

export default function Page() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Voltar
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Instalar o app</h1>
      <p className="mb-4 text-sm text-suave">
        Depois de instalado, ele abre pelo ícone do celular, em tela cheia e sem barra de navegador.
      </p>
      <InstalarApp />
    </main>
  );
}
