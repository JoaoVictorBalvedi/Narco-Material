export const CATEGORIAS = ["calouro", "aspirante", "ritmista"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CARGOS = [
  "presidente",
  "vice_presidente",
  "diretor_material",
  "suplente_material",
  "diretor_financeiro",
  "diretor_eventos",
  "diretor_comunicacao",
  "diretor_administrativo",
  "diretor_juridico",
  "diretora_forca_feminina",
] as const;
export type Cargo = (typeof CARGOS)[number];

export type Situacao = "ativa" | "suspensa" | "desativada";

export const PERMISSOES_DELEGAVEIS = [
  "aprovar_emprestimos",
  "conferir_devolucoes",
  "editar_inventario",
  "lancar_custos",
] as const;
export type PermissaoDelegavel = (typeof PERMISSOES_DELEGAVEIS)[number];

export type Acao =
  | "ver_catalogo"
  | "pedir_emprestimo"
  | "ver_responsavel"
  | "ver_eventos"
  | "avisar_problema"
  | "ver_financas"
  | "gerenciar_eventos"
  | "definir_papeis"
  | "delegar_permissoes"
  | "transferir_cargo_material"
  | "ver_auditoria"
  | PermissaoDelegavel;

export type Ator = {
  id: string;
  nome: string;
  categoria: Categoria | null;
  cargo: Cargo | null;
  situacao: Situacao;
  delegadas: PermissaoDelegavel[];
};

export type Papel = "novo" | "membro" | "diretoria" | "diretor_material";

export function papelDe(ator: Ator): Papel {
  if (ator.cargo === "diretor_material") return "diretor_material";
  if (ator.cargo) return "diretoria";
  return ator.categoria ? "membro" : "novo";
}

const ACOES_DE_MEMBRO: Acao[] = [
  "ver_catalogo",
  "pedir_emprestimo",
  "ver_responsavel",
  "ver_eventos",
  "avisar_problema",
];

const ACOES_DE_DIRETORIA: Acao[] = [
  ...ACOES_DE_MEMBRO,
  "ver_financas",
  "gerenciar_eventos",
  "definir_papeis",
];

/** A tabela de papéis do spec em um só lugar. */
export function pode(ator: Ator, acao: Acao): boolean {
  if (ator.situacao === "desativada") return false;
  if (ator.situacao === "suspensa") return acao === "ver_catalogo";

  const papel = papelDe(ator);
  if (papel === "diretor_material") return true;
  if (papel === "novo") return acao === "ver_catalogo";
  if (papel === "membro") return ACOES_DE_MEMBRO.includes(acao);

  if (ACOES_DE_DIRETORIA.includes(acao)) return true;
  if (acao === "transferir_cargo_material") return ator.cargo === "presidente";
  if (acao === "lancar_custos" && ator.cargo === "diretor_financeiro") return true;
  return ator.delegadas.includes(acao as PermissaoDelegavel);
}

export const NOME_CATEGORIA: Record<Categoria, string> = {
  calouro: "Calouro",
  aspirante: "Aspirante",
  ritmista: "Ritmista",
};

export const NOME_CARGO: Record<Cargo, string> = {
  presidente: "Presidente",
  vice_presidente: "Vice-Presidente",
  diretor_material: "Diretor de Material",
  suplente_material: "Suplente de Material",
  diretor_financeiro: "Diretor Financeiro",
  diretor_eventos: "Diretor de Eventos e Social",
  diretor_comunicacao: "Diretor de Comunicação e Produtos",
  diretor_administrativo: "Diretor Administrativo",
  diretor_juridico: "Diretor Jurídico",
  diretora_forca_feminina: "Diretoria da Força Feminina",
};

export const NOME_PERMISSAO: Record<PermissaoDelegavel, string> = {
  aprovar_emprestimos: "Aprovar empréstimos",
  conferir_devolucoes: "Conferir devoluções",
  editar_inventario: "Editar inventário",
  lancar_custos: "Lançar custos",
};

export const NOME_SITUACAO: Record<Situacao, string> = {
  ativa: "Ativa",
  suspensa: "Suspensa",
  desativada: "Desativada",
};
