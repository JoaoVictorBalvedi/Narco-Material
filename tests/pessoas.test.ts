import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pode, type Acao } from "../src/sistema/permissoes";
import { criarPessoa, encerrar, enviados, limpar, sistema } from "./apoio";

beforeEach(limpar);
afterAll(encerrar);

async function podeFazer(id: string, acao: Acao) {
  const ator = await sistema.ator(id);
  return ator !== null && pode(ator, acao);
}

const semPermissao = { codigo: "sem_permissao" };
const regraViolada = { codigo: "regra_violada" };

describe("tabela de papéis", () => {
  const casos: [string, () => Promise<string>, Acao[], Acao[]][] = [
    ["novo cadastro", () => criarPessoa(), ["ver_catalogo"],
      ["pedir_emprestimo", "ver_responsavel", "ver_eventos", "ver_financas"]],
    ["membro", () => criarPessoa({ categoria: "calouro" }),
      ["ver_catalogo", "pedir_emprestimo", "ver_responsavel", "ver_eventos", "avisar_problema"],
      ["ver_financas", "gerenciar_eventos", "definir_papeis", "aprovar_emprestimos", "lancar_custos"]],
    ["diretoria", () => criarPessoa({ cargo: "diretor_eventos" }),
      ["pedir_emprestimo", "ver_financas", "gerenciar_eventos", "definir_papeis"],
      ["aprovar_emprestimos", "conferir_devolucoes", "editar_inventario", "lancar_custos",
        "delegar_permissoes", "transferir_cargo_material", "ver_auditoria"]],
    ["suplente", () => criarPessoa({ cargo: "suplente_material" }),
      ["ver_financas"], ["aprovar_emprestimos", "editar_inventario", "delegar_permissoes"]],
    ["Diretor Financeiro", () => criarPessoa({ cargo: "diretor_financeiro" }),
      ["lancar_custos", "ver_financas"], ["aprovar_emprestimos", "editar_inventario"]],
    ["Presidente", () => criarPessoa({ cargo: "presidente" }),
      ["transferir_cargo_material"], ["aprovar_emprestimos", "delegar_permissoes"]],
    ["Diretor de Material", () => criarPessoa({ cargo: "diretor_material" }),
      ["aprovar_emprestimos", "conferir_devolucoes", "editar_inventario", "lancar_custos",
        "delegar_permissoes", "transferir_cargo_material", "ver_auditoria", "ver_financas"], []],
  ];

  it.each(casos)("%s", async (_nome, criar, permitidas, negadas) => {
    const id = await criar();
    for (const acao of permitidas) expect(await podeFazer(id, acao), acao).toBe(true);
    for (const acao of negadas) expect(await podeFazer(id, acao), acao).toBe(false);
  });

  it("conta nova nasce como novo cadastro, com o nome informado", async () => {
    const id = await criarPessoa();
    expect(await sistema.ator(id)).toMatchObject({
      categoria: null, cargo: null, situacao: "ativa", nome: expect.stringMatching(/^Pessoa/),
    });
  });
});

describe("definir papel", () => {
  it("diretor transforma novo cadastro em membro e a pessoa é avisada", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const novo = await criarPessoa();

    await sistema.pessoas.definirPapel(diretor, novo, { categoria: "aspirante", cargo: null });

    expect(await podeFazer(novo, "pedir_emprestimo")).toBe(true);
    expect(enviados.map((a) => a.destinatarioId)).toEqual([novo]);
    expect(await sistema.avisos.contarNaoLidos(novo)).toBe(1);
  });

  it("membro não define papéis nem lista pessoas", async () => {
    const membro = await criarPessoa({ categoria: "ritmista" });
    const novo = await criarPessoa();
    await expect(sistema.pessoas.definirPapel(membro, novo, { categoria: "ritmista", cargo: null }))
      .rejects.toMatchObject(semPermissao);
    await expect(sistema.pessoas.listar(membro)).rejects.toMatchObject(semPermissao);
  });

  it("não coloca duas pessoas no mesmo cargo", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await criarPessoa({ cargo: "diretor_juridico" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await expect(sistema.pessoas.definirPapel(diretor, membro, { categoria: "ritmista", cargo: "diretor_juridico" }))
      .rejects.toMatchObject(regraViolada);
  });

  it("cargo de Diretor de Material não muda por definição de papel", async () => {
    const presidente = await criarPessoa({ cargo: "presidente" });
    const material = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await expect(sistema.pessoas.definirPapel(presidente, membro, { categoria: "ritmista", cargo: "diretor_material" }))
      .rejects.toMatchObject(regraViolada);
    await expect(sistema.pessoas.definirPapel(presidente, material, { categoria: "ritmista", cargo: null }))
      .rejects.toMatchObject(regraViolada);
  });

  it("diretor comum não se promove nem mexe na presidência", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const presidente = await criarPessoa({ cargo: "presidente" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await expect(sistema.pessoas.definirPapel(diretor, diretor, { categoria: null, cargo: "diretor_financeiro" }))
      .rejects.toMatchObject(regraViolada);
    await expect(sistema.pessoas.definirPapel(diretor, presidente, { categoria: "ritmista", cargo: null }))
      .rejects.toMatchObject(regraViolada);
    await sistema.pessoas.definirPapel(presidente, presidente, { categoria: "ritmista", cargo: "presidente" });
    await expect(sistema.pessoas.definirPapel(diretor, membro, { categoria: "ritmista", cargo: "presidente" }))
      .rejects.toMatchObject(regraViolada);
  });

  it("quem sai da diretoria precisa de categoria e perde as delegações", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(material, diretor, "aprovar_emprestimos");

    await expect(sistema.pessoas.definirPapel(material, diretor, { categoria: null, cargo: null }))
      .rejects.toMatchObject(regraViolada);

    await sistema.pessoas.definirPapel(material, diretor, { categoria: "ritmista", cargo: null });
    expect(await podeFazer(diretor, "aprovar_emprestimos")).toBe(false);
    expect(await podeFazer(diretor, "pedir_emprestimo")).toBe(true);

    await sistema.pessoas.definirPapel(material, diretor, { categoria: "ritmista", cargo: "diretor_eventos" });
    expect(await podeFazer(diretor, "aprovar_emprestimos")).toBe(false);
  });
});

describe("delegação", () => {
  it("Diretor de Material concede e retira, e tudo fica registrado", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });

    await sistema.permissoes.conceder(material, diretor, "conferir_devolucoes");
    expect(await podeFazer(diretor, "conferir_devolucoes")).toBe(true);
    expect(await podeFazer(diretor, "aprovar_emprestimos")).toBe(false);
    expect(await sistema.permissoes.listar(material, diretor)).toMatchObject([
      { permissao: "conferir_devolucoes", concedidaPorNome: expect.any(String) },
    ]);

    await sistema.permissoes.retirar(material, diretor, "conferir_devolucoes");
    expect(await podeFazer(diretor, "conferir_devolucoes")).toBe(false);

    const registros = await sistema.auditoria.listar(material);
    expect(registros.map((r) => r.acao)).toEqual(
      expect.arrayContaining(["permissao_concedida", "permissao_retirada"]),
    );
    expect(registros[0].autorNome).not.toBeNull();
  });

  it("conceder de novo não duplica nem gera outro aviso", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(material, diretor, "lancar_custos");
    await sistema.permissoes.conceder(material, diretor, "lancar_custos");
    expect(await sistema.permissoes.listar(material, diretor)).toHaveLength(1);
    expect(enviados).toHaveLength(1);
  });

  it("só o Diretor de Material delega, e só para diretores", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const presidente = await criarPessoa({ cargo: "presidente" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await expect(sistema.permissoes.conceder(presidente, presidente, "lancar_custos"))
      .rejects.toMatchObject(semPermissao);
    await expect(sistema.permissoes.conceder(material, membro, "lancar_custos"))
      .rejects.toMatchObject(regraViolada);
    await expect(sistema.auditoria.listar(presidente)).rejects.toMatchObject(semPermissao);
  });
});

describe("transferência do cargo de Material", () => {
  it("quem sai vira membro comum, e o histórico e as delegações continuam", async () => {
    const antigo = await criarPessoa({ cargo: "diretor_material" });
    const proximo = await criarPessoa({ categoria: "ritmista" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(antigo, diretor, "editar_inventario");

    await sistema.pessoas.transferirCargoMaterial(antigo, proximo);

    expect(await podeFazer(proximo, "delegar_permissoes")).toBe(true);
    expect(await podeFazer(antigo, "delegar_permissoes")).toBe(false);
    expect(await podeFazer(antigo, "pedir_emprestimo")).toBe(true);
    expect(await podeFazer(diretor, "editar_inventario")).toBe(true);
    const registros = await sistema.auditoria.listar(proximo);
    expect(registros.some((r) => r.autorNome !== null && r.acao === "permissao_concedida")).toBe(true);
  });

  it("Presidente transfere, mesmo sem diretor atual, e os dois são avisados", async () => {
    const presidente = await criarPessoa({ cargo: "presidente" });
    const primeiro = await criarPessoa({ categoria: "ritmista" });
    const segundo = await criarPessoa({ categoria: "ritmista" });

    await sistema.pessoas.transferirCargoMaterial(presidente, primeiro);
    expect(await podeFazer(primeiro, "delegar_permissoes")).toBe(true);

    enviados.length = 0;
    await sistema.pessoas.transferirCargoMaterial(presidente, segundo);
    expect(enviados.map((a) => a.destinatarioId).sort()).toEqual([primeiro, segundo].sort());
    expect(await podeFazer(primeiro, "delegar_permissoes")).toBe(false);
  });

  it("recusa quem não pode transferir e destinos inválidos", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const suspenso = await criarPessoa({ categoria: "ritmista" });
    await sistema.pessoas.definirSituacao(material, suspenso, "suspensa");

    await expect(sistema.pessoas.transferirCargoMaterial(diretor, suspenso)).rejects.toMatchObject(semPermissao);
    await expect(sistema.pessoas.transferirCargoMaterial(material, suspenso)).rejects.toMatchObject(regraViolada);
    await expect(sistema.pessoas.transferirCargoMaterial(material, diretor)).rejects.toMatchObject(regraViolada);
    await expect(sistema.pessoas.transferirCargoMaterial(material, material)).rejects.toMatchObject(regraViolada);
  });

  it("suplente pode assumir o cargo", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const suplente = await criarPessoa({ cargo: "suplente_material" });
    await sistema.pessoas.transferirCargoMaterial(material, suplente);
    expect((await sistema.ator(suplente))?.cargo).toBe("diretor_material");
  });

  it("duas transferências simultâneas deixam um único diretor", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const presidente = await criarPessoa({ cargo: "presidente" });
    const a = await criarPessoa({ categoria: "ritmista" });
    const b = await criarPessoa({ categoria: "ritmista" });
    await Promise.allSettled([
      sistema.pessoas.transferirCargoMaterial(material, a),
      sistema.pessoas.transferirCargoMaterial(presidente, b),
    ]);
    const cargos = [(await sistema.ator(a))?.cargo, (await sistema.ator(b))?.cargo];
    expect(cargos.filter((c) => c === "diretor_material")).toHaveLength(1);
  });
});

describe("suspensão e desativação", () => {
  it("suspenso perde tudo, menos o catálogo, e volta ao ser reativado", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const membro = await criarPessoa({ categoria: "ritmista" });

    await sistema.pessoas.definirSituacao(diretor, membro, "suspensa");
    expect(await podeFazer(membro, "pedir_emprestimo")).toBe(false);
    expect(await podeFazer(membro, "ver_catalogo")).toBe(true);
    expect(enviados.map((a) => a.tipo)).toEqual(["situacao_alterada"]);

    await sistema.pessoas.definirSituacao(diretor, membro, "ativa");
    expect(await podeFazer(membro, "pedir_emprestimo")).toBe(true);
  });

  it("diretor suspenso perde seus poderes", async () => {
    const material = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.pessoas.definirSituacao(material, diretor, "suspensa");
    await expect(sistema.pessoas.listar(diretor)).rejects.toMatchObject(semPermissao);
  });

  it("desativado não faz nada, e a conta continua registrada", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await sistema.pessoas.definirSituacao(diretor, membro, "desativada");
    expect(await podeFazer(membro, "ver_catalogo")).toBe(false);
    expect((await sistema.pessoas.obter(diretor, membro)).situacao).toBe("desativada");
  });

  it("não suspende a si mesmo nem quem ocupa cargo protegido", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const material = await criarPessoa({ cargo: "diretor_material" });
    const presidente = await criarPessoa({ cargo: "presidente" });
    for (const alvo of [diretor, material, presidente]) {
      await expect(sistema.pessoas.definirSituacao(diretor, alvo, "suspensa")).rejects.toMatchObject(regraViolada);
    }
  });
});

describe("avisos", () => {
  it("cada pessoa só vê os próprios avisos e pode marcá-los como lidos", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const membro = await criarPessoa();
    await sistema.pessoas.definirPapel(diretor, membro, { categoria: "ritmista", cargo: null });

    expect(await sistema.avisos.listar(diretor)).toHaveLength(0);
    expect(await sistema.avisos.listar(membro)).toHaveLength(1);

    await sistema.avisos.marcarTodosLidos(membro);
    expect(await sistema.avisos.contarNaoLidos(membro)).toBe(0);
  });

  it("uma operação que falha não deixa aviso nem envia push", async () => {
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await criarPessoa({ cargo: "diretor_juridico" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await expect(sistema.pessoas.definirPapel(diretor, membro, { categoria: "ritmista", cargo: "diretor_juridico" })).rejects.toThrow();
    expect(enviados).toHaveLength(0);
    expect(await sistema.avisos.contarNaoLidos(membro)).toBe(0);
  });
});

describe("assinaturas de push", () => {
  const chaves = { p256dh: "a", auth: "b" };

  it("aceita só serviços de push conhecidos", async () => {
    const membro = await criarPessoa({ categoria: "ritmista" });
    await sistema.notificacoes.assinar(membro, { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: chaves });
    await sistema.notificacoes.assinar(membro, { endpoint: "https://web.push.apple.com/x", keys: chaves });
    for (const endpoint of ["http://fcm.googleapis.com/x", "https://exemplo.com/x", "https://fcm.googleapis.com.exemplo.com/x", "https://127.0.0.1/x"]) {
      await expect(sistema.notificacoes.assinar(membro, { endpoint, keys: chaves })).rejects.toMatchObject(regraViolada);
    }
  });
});
