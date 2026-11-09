import { Box, Drum, Flag, Package, Shirt, Sparkles, Trophy, Wrench, type LucideIcon, type LucideProps } from "lucide-react";
import { createElement } from "react";

const ICONES: Record<string, LucideIcon> = {
  IN: Drum, BE: Flag, AD: Sparkles, TF: Trophy, FG: Shirt, FR: Wrench, PC: Package, OU: Box,
};

/** Categorias criadas depois ficam com o ícone genérico. */
export const iconeCategoria = (prefixo: string) => ICONES[prefixo] ?? Box;

export function IconeCategoria({ prefixo, ...props }: LucideProps & { prefixo: string }) {
  return createElement(iconeCategoria(prefixo), props);
}

const NO_SINGULAR: Record<string, string> = {
  IN: "instrumento", BE: "bandeira ou estandarte", AD: "adereço", TF: "troféu ou medalha",
  FG: "roupa", FR: "ferramenta", PC: "peça", OU: "item",
};

export const nomeNoSingular = (prefixo: string) => NO_SINGULAR[prefixo] ?? "item";

export const DICA_CATEGORIA: Record<string, string> = {
  IN: "Caixa, surdo, repique...",
  BE: "Bandeirão, faixa, flâmula...",
  AD: "Cabeça do Homer, placas...",
  TF: "Do acervo da bateria",
  FG: "Fantasia, camiseta...",
  FR: "Chave de afinação...",
  PC: "Pele, baqueta, talabarte...",
  OU: "O que não couber nas outras",
};
