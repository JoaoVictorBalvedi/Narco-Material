export type CodigoErro = "sem_permissao" | "nao_encontrado" | "regra_violada";

/** Erro esperado de uma regra do app. A mensagem pode ser mostrada ao usuário. */
export class ErroSistema extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroSistema";
  }
}

export const semPermissao = () =>
  new ErroSistema("sem_permissao", "Você não tem permissão para fazer isso.");

export const naoEncontrado = (oQue: string) =>
  new ErroSistema("nao_encontrado", `${oQue} não encontrado(a).`);

export const regraViolada = (mensagem: string) =>
  new ErroSistema("regra_violada", mensagem);
