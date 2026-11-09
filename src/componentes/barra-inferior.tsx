"use client";

import { Boxes, CalendarDays, Handshake, House, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS: Record<string, { rotulo: string; href: string; icone: LucideIcon }> = {
  inicio: { rotulo: "Início", href: "/inicio", icone: House },
  inventario: { rotulo: "Inventário", href: "/inventario", icone: Boxes },
  emprestimos: { rotulo: "Empréstimos", href: "/emprestimos", icone: Handshake },
  eventos: { rotulo: "Eventos", href: "/eventos", icone: CalendarDays },
  mais: { rotulo: "Mais", href: "/mais", icone: Menu },
};

export type ItemNavegacao = keyof typeof ITENS;

export function BarraInferior({ itens, marcadores = {} }: { itens: ItemNavegacao[]; marcadores?: Partial<Record<ItemNavegacao, number>> }) {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {itens.map((chave) => {
          const { rotulo, href, icone: Icone } = ITENS[chave];
          const marcador = marcadores[chave] ?? 0;
          const ativo =
            caminho.startsWith(href) ||
            (chave === "mais" && (caminho.startsWith("/pessoas") || caminho.startsWith("/auditoria") || caminho.startsWith("/financas")));
          return (
            <li key={chave} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  ativo ? "text-marca" : "text-suave"
                }`}
              >
                <span className="relative">
                  <Icone aria-hidden size={22} strokeWidth={ativo ? 2.4 : 1.8} />
                  {marcador > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-marca px-1 text-[10px] font-bold text-marca-texto">
                      {marcador > 9 ? "9+" : marcador}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5">
                  {rotulo}
                  {marcador > 0 && <span className="sr-only">, {marcador} para resolver</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
