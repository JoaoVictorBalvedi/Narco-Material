import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { avancarHoras, criarItem, criarPessoa, encerrar, enviados, limpar, relogio, sistema } from "./apoio";

beforeEach(limpar);
afterAll(encerrar);

const emp = sistema.emprestimos;
const inv = sistema.inventario;
const semPermissao = { codigo: "sem_permissao" };
const regraViolada = { codigo: "regra_violada" };
const HOJE = "2026-11-10";
const pedido = (itemIds: string[], dataRetirada = HOJE, dataDevolucao = "2026-11-12") => ({ itemIds, dataRetirada, dataDevolucao, motivo: "Estudo" });
const situacaoDe = async (dir: string, item: string) => (await inv.obter(dir, item)).item.disponibilidade;
const tipos = () => enviados.map((a) => a.tipo);

async function cenario() {
  const dir = await criarPessoa({ cargo: "diretor_material" });
  const membro = await criarPessoa({ categoria: "ritmista" });
  const outro = await criarPessoa({ categoria: "aspirante" });
  const item = await criarItem(dir);
  enviados.length = 0;
  return { dir, membro, outro, item };
}

async function emprestar(dir: string, pessoa: string, item: string) {
  const [id] = await emp.pedir(pessoa, pedido([item]));
  if (pessoa !== dir) await emp.decidir(dir, id, { aprovar: true });
  await emp.retirar(pessoa, id, true);
  return id;
}

describe("ciclo do empréstimo", () => {
  it("vai do pedido à conferência, com notificações e histórico", async () => {
    const { dir, membro, item } = await cenario();
    const [id] = await emp.pedir(membro, pedido([item]));
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "pedido_criado" });

    await emp.decidir(dir, id, { aprovar: true });
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: membro, tipo: "pedido_decidido" });

    await expect(emp.retirar(membro, id, false)).rejects.toMatchObject(regraViolada);
    await emp.retirar(membro, id, true);
    expect(await situacaoDe(dir, item)).toBe("emprestado");
    expect((await inv.obter(dir, item)).item.comQuem).toBeTruthy();

    await emp.devolver(membro, id);
    expect(await situacaoDe(dir, item)).toBe("aguardando_conferencia");
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "devolucao_para_conferir" });

    await emp.conferir(dir, id, { resultado: "liberado" });
    expect(await situacaoDe(dir, item)).toBe("disponivel");
    expect((await inv.obter(dir, item)).usos).toHaveLength(1);
    expect((await emp.meus(membro)).historico[0].situacao).toBe("conferido");
  });

  it("pedido direto não aparece como se fosse da fila", async () => {
    const { dir, membro, item } = await cenario();
    await emp.pedir(membro, pedido([item]));
    expect((await emp.painel(dir))!.pendentes[0]).toMatchObject({ emFila: false, posicaoFila: null, filaSituacao: null });
    expect((await emp.meus(membro)).ativos[0].posicaoFila).toBeNull();
  });

  it("recusa exige motivo e notifica", async () => {
    const { dir, membro, item } = await cenario();
    const [id] = await emp.pedir(membro, pedido([item]));
    await expect(emp.decidir(dir, id, { aprovar: false })).rejects.toMatchObject(regraViolada);
    await emp.decidir(dir, id, { aprovar: false, justificativa: "Reservado" });
    expect(enviados.at(-1)?.corpo).toContain("Reservado");
    await expect(emp.retirar(membro, id, true)).rejects.toMatchObject(regraViolada);
  });

  it("conferência pode mandar para a manutenção, e o problema fica no item", async () => {
    const { dir, membro, item } = await cenario();
    const id = await emprestar(dir, membro, item);
    await emp.devolver(membro, id, "Aro torto");
    await emp.conferir(dir, id, { resultado: "manutencao", estado: "ruim" });
    const ficha = await inv.obter(dir, item);
    expect(ficha.item).toMatchObject({ disponibilidade: "manutencao", estado: "ruim" });
    expect(ficha.problemas[0].descricao).toBe("Aro torto");
    await expect(emp.pedir(membro, pedido([item]))).rejects.toMatchObject(regraViolada);
    await emp.definirManutencao(dir, item, false);
    expect(await situacaoDe(dir, item)).toBe("disponivel");
  });

  it("permissões: só quem pode aprova, retira, confere", async () => {
    const { dir, membro, outro, item } = await cenario();
    const novo = await criarPessoa();
    await expect(emp.pedir(novo, pedido([item]))).rejects.toMatchObject(semPermissao);
    const [id] = await emp.pedir(membro, pedido([item]));
    await expect(emp.decidir(outro, id, { aprovar: true })).rejects.toMatchObject(semPermissao);
    await emp.decidir(dir, id, { aprovar: true });
    await expect(emp.retirar(outro, id, true)).rejects.toMatchObject(semPermissao);
    await emp.retirar(membro, id, true);
    await expect(emp.devolver(outro, id)).rejects.toMatchObject(semPermissao);
    await emp.devolver(membro, id);
    await expect(emp.conferir(membro, id, { resultado: "liberado" })).rejects.toMatchObject(semPermissao);
  });

  it("aprovação delegada funciona, e deixa de funcionar ao retirar", async () => {
    const { dir, membro, item } = await cenario();
    const delegado = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(dir, delegado, "aprovar_emprestimos");
    const [id] = await emp.pedir(membro, pedido([item]));
    await emp.decidir(delegado, id, { aprovar: true });
    await emp.cancelar(membro, id);
    await sistema.permissoes.retirar(dir, delegado, "aprovar_emprestimos");
    const [id2] = await emp.pedir(membro, pedido([item]));
    await expect(emp.decidir(delegado, id2, { aprovar: true })).rejects.toMatchObject(semPermissao);
  });

  it("suspenso não pede, e o item de quem é desativado gera alerta", async () => {
    const { dir, membro, outro, item } = await cenario();
    await sistema.pessoas.definirSituacao(dir, outro, "suspensa");
    await expect(emp.pedir(outro, pedido([item]))).rejects.toMatchObject(semPermissao);
    await emprestar(dir, membro, item);
    const presidente = await criarPessoa({ cargo: "presidente" });
    enviados.length = 0;
    await sistema.pessoas.definirSituacao(presidente, membro, "desativada");
    expect(enviados).toMatchObject([{ destinatarioId: dir, tipo: "conta_desativada_com_item" }]);
  });
});

describe("diretoria e prazos", () => {
  it("diretoria só avisa, e aceita o termo na retirada", async () => {
    const { dir, item } = await cenario();
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const [id] = await emp.pedir(diretor, pedido([item]));
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "aviso_emprestimo" });
    await expect(emp.retirar(diretor, id, false)).rejects.toMatchObject(regraViolada);
    await emp.retirar(diretor, id, true);
    expect(await situacaoDe(dir, item)).toBe("emprestado");
  });

  it("mais de 5 dias exige justificativa e aprovação, mesmo para a diretoria", async () => {
    const { dir, item } = await cenario();
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await expect(emp.pedir(diretor, pedido([item], HOJE, "2026-11-16"))).rejects.toMatchObject(regraViolada);
    const [id] = await emp.pedir(diretor, { ...pedido([item], HOJE, "2026-11-16"), justificativaPrazo: "Estudo longo" });
    await expect(emp.retirar(diretor, id, true)).rejects.toMatchObject(regraViolada);
    expect(enviados.at(-1)?.tipo).toBe("pedido_criado");
    await emp.decidir(dir, id, { aprovar: true });
    await emp.retirar(diretor, id, true);
  });

  it("os dias contam a partir da retirada", async () => {
    const { dir, membro, item } = await cenario();
    const [id] = await emp.pedir(membro, pedido([item], "2026-11-11", "2026-11-14"));
    await emp.decidir(dir, id, { aprovar: true });
    await expect(emp.retirar(membro, id, true)).rejects.toMatchObject(regraViolada);
    avancarHoras(48);
    await emp.retirar(membro, id, true);
    const [ativo] = (await emp.meus(membro)).ativos;
    expect(ativo).toMatchObject({ dataRetirada: "2026-11-12", dataDevolucao: "2026-11-15" });
  });

  it("não permite datas em conflito, no passado ou invertidas", async () => {
    const { dir, membro, outro, item } = await cenario();
    const [id] = await emp.pedir(membro, pedido([item]));
    await emp.decidir(dir, id, { aprovar: true });
    await expect(emp.pedir(outro, pedido([item], "2026-11-11", "2026-11-13"))).rejects.toMatchObject(regraViolada);
    await expect(emp.pedir(outro, pedido([item], "2026-11-01", "2026-11-02"))).rejects.toMatchObject(regraViolada);
    await expect(emp.pedir(outro, pedido([item], "2026-11-20", "2026-11-19"))).rejects.toMatchObject(regraViolada);
    await expect(emp.pedir(outro, pedido([item], "2026-11-13", "2026-11-15"))).resolves.toHaveLength(1);
  });

  it("pedidos pendentes não reservam: a segunda aprovação em conflito é recusada", async () => {
    const { dir, membro, outro, item } = await cenario();
    const [a] = await emp.pedir(membro, pedido([item]));
    const [b] = await emp.pedir(outro, pedido([item]));
    await emp.decidir(dir, a, { aprovar: true });
    await expect(emp.decidir(dir, b, { aprovar: true })).rejects.toMatchObject(regraViolada);
  });

  it("vários itens têm decisões próprias", async () => {
    const { dir, membro, item } = await cenario();
    const segundo = await criarItem(dir, "Surdo");
    const [a, b] = await emp.pedir(membro, pedido([item, segundo]));
    await emp.decidir(dir, a, { aprovar: true });
    await emp.decidir(dir, b, { aprovar: false, justificativa: "Em uso" });
    const { ativos, historico } = await emp.meus(membro);
    expect(ativos.map((e) => e.id)).toEqual([a]);
    expect(historico.map((e) => e.id)).toEqual([b]);
  });

  it("dois pedidos simultâneos da diretoria deixam só um com o item", async () => {
    const { dir, item } = await cenario();
    const d1 = await criarPessoa({ cargo: "diretor_eventos" });
    const d2 = await criarPessoa({ cargo: "diretor_juridico" });
    const r = await Promise.allSettled([emp.pedir(d1, pedido([item])), emp.pedir(d2, pedido([item]))]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(dir).toBeTruthy();
  });

  it("lembretes saem uma vez, e o atraso avisa sem punir", async () => {
    const { dir, membro, item } = await cenario();
    await emprestar(dir, membro, item);
    enviados.length = 0;
    await emp.executarRotinas();
    expect(tipos()).toEqual([]);

    avancarHoras(24);
    await emp.executarRotinas();
    await emp.executarRotinas();
    expect(enviados).toMatchObject([{ destinatarioId: membro, titulo: "A devolução é amanhã" }]);

    enviados.length = 0;
    avancarHoras(24);
    await emp.executarRotinas();
    expect(enviados).toMatchObject([{ destinatarioId: membro, titulo: "A devolução é hoje" }]);

    enviados.length = 0;
    avancarHoras(24);
    await emp.executarRotinas();
    await emp.executarRotinas();
    expect(enviados.map((a) => a.destinatarioId).sort()).toEqual([dir, membro].sort());
    expect((await emp.meus(membro)).ativos[0].atrasado).toBe(true);
    expect((await emp.painel(dir))?.emAndamento[0].atrasado).toBe(true);
    expect((await sistema.ator(membro))?.situacao).toBe("ativa");
    await emp.pedirRenovacao(membro, (await emp.meus(membro)).ativos[0].id, { novaData: "2026-11-20", motivo: "x" }).catch((e) => expect(e.codigo).toBe("regra_violada"));
  });

  it("reserva aprovada e nunca retirada expira e libera as datas", async () => {
    const { dir, membro, outro, item } = await cenario();
    const [id] = await emp.pedir(membro, pedido([item]));
    await emp.decidir(dir, id, { aprovar: true });
    avancarHoras(24 * 3);
    await expect(emp.retirar(membro, id, true)).rejects.toMatchObject(regraViolada);
    await emp.executarRotinas();
    await expect(emp.pedir(outro, pedido([item], "2026-11-13", "2026-11-14"))).resolves.toHaveLength(1);
    expect((await emp.meus(membro)).historico[0].situacao).toBe("cancelado");
  });
});

describe("renovação", () => {
  it("sem fila: aprovada muda o prazo e renova os lembretes", async () => {
    const { dir, membro, item } = await cenario();
    const id = await emprestar(dir, membro, item);
    await expect(emp.pedirRenovacao(membro, id, { novaData: "2026-11-12", motivo: "x" })).rejects.toMatchObject(regraViolada);
    await emp.pedirRenovacao(membro, id, { novaData: "2026-11-20", motivo: "Show" });
    await expect(emp.pedirRenovacao(membro, id, { novaData: "2026-11-21", motivo: "x" })).rejects.toMatchObject(regraViolada);
    const painel = await emp.painel(dir);
    await emp.decidirRenovacao(dir, painel!.renovacoes[0].id, { aprovar: true });
    expect((await emp.meus(membro)).ativos[0].dataDevolucao).toBe("2026-11-20");
  });

  it("com fila: pode pedir, e o diretor decide vendo quem espera", async () => {
    const { dir, membro, outro, item } = await cenario();
    const id = await emprestar(dir, membro, item);
    await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "Ensaio" });
    await emp.pedirRenovacao(membro, id, { novaData: "2026-11-20", motivo: "Show" });
    const [renovacao] = (await emp.painel(dir))!.renovacoes;
    expect(renovacao.filaNomes).toHaveLength(1);
    await emp.decidirRenovacao(dir, renovacao.id, { aprovar: false, justificativa: "Há fila" });
    expect((await emp.meus(membro)).ativos[0].dataDevolucao).toBe("2026-11-12");
  });

  it("não renova depois do fim do prazo, nem sobre outra reserva", async () => {
    const { dir, membro, outro, item } = await cenario();
    const id = await emprestar(dir, membro, item);
    const [futuro] = await emp.pedir(outro, pedido([item], "2026-11-15", "2026-11-16"));
    await emp.decidir(dir, futuro, { aprovar: true });
    await emp.pedirRenovacao(membro, id, { novaData: "2026-11-15", motivo: "x" });
    const [renovacao] = (await emp.painel(dir))!.renovacoes;
    await expect(emp.decidirRenovacao(dir, renovacao.id, { aprovar: true })).rejects.toMatchObject(regraViolada);
    await emp.decidirRenovacao(dir, renovacao.id, { aprovar: false, justificativa: "Reservado" });
    avancarHoras(24 * 3);
    await expect(emp.pedirRenovacao(membro, id, { novaData: "2026-11-14", motivo: "x" })).rejects.toMatchObject(regraViolada);
  });
});

describe("fila de espera", () => {
  async function comFila() {
    const c = await cenario();
    const terceiro = await criarPessoa({ categoria: "calouro" });
    const id = await emprestar(c.dir, c.membro, c.item);
    return { ...c, terceiro, id };
  }

  it("item livre não tem fila, e item ocupado não aceita pedido direto", async () => {
    const { dir, membro, item } = await cenario();
    await expect(emp.entrarNaFila(membro, { itemId: item, dias: 2, motivo: "x" })).rejects.toMatchObject(regraViolada);
    await emprestar(dir, membro, item);
    await expect(emp.entrarNaFila(membro, { itemId: item, dias: 2, motivo: "x" })).rejects.toMatchObject(regraViolada);
  });

  it("entrar já cria o pedido, o diretor decide e ninguém pede duas vezes", async () => {
    const { dir, outro, item } = await comFila();
    enviados.length = 0;
    const pedidoFila = await emp.entrarNaFila(outro, { itemId: item, dias: 3, motivo: "Ensaio" });
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "pedido_criado" });
    await expect(emp.entrarNaFila(outro, { itemId: item, dias: 3, motivo: "Ensaio" })).rejects.toMatchObject(regraViolada);
    await emp.decidir(dir, pedidoFila, { aprovar: true });
    expect((await emp.meus(outro)).ativos[0]).toMatchObject({ situacao: "aprovado", posicaoFila: 1, filaSituacao: "aguardando" });
    await expect(emp.retirar(outro, pedidoFila, true)).rejects.toMatchObject(regraViolada);
  });

  it("recusa tira da fila", async () => {
    const { dir, outro, terceiro, item } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, a, { aprovar: false, justificativa: "Não" });
    expect((await emp.meus(terceiro)).ativos[0].posicaoFila).toBe(1);
  });

  it("a conferência notifica o primeiro, por ordem de chegada, e a retirada não pede de novo", async () => {
    const { dir, membro, outro, terceiro, item, id } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 3, motivo: "x" });
    const b = await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, b, { aprovar: true });
    await emp.decidir(dir, a, { aprovar: true });
    await emp.devolver(membro, id);
    enviados.length = 0;
    await emp.conferir(dir, id, { resultado: "liberado" });
    expect(enviados).toMatchObject([{ destinatarioId: outro, tipo: "fila_vez", titulo: "É a sua vez" }]);
    expect(await situacaoDe(dir, item)).toBe("guardado_fila");
    await expect(emp.pedir(membro, pedido([item]))).rejects.toMatchObject(regraViolada);
    await expect(emp.retirar(terceiro, b, true)).rejects.toMatchObject(regraViolada);

    await emp.retirar(outro, a, true);
    expect((await emp.meus(outro)).ativos[0]).toMatchObject({ situacao: "retirado", dataRetirada: HOJE, dataDevolucao: "2026-11-13" });
    expect((await emp.meus(terceiro)).ativos[0].posicaoFila).toBe(1);
  });

  it("24 horas sem retirar passam a vez para o próximo", async () => {
    const { dir, membro, outro, terceiro, item, id } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    const b = await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, a, { aprovar: true });
    await emp.decidir(dir, b, { aprovar: true });
    await emp.devolver(membro, id);
    await emp.conferir(dir, id, { resultado: "liberado" });

    avancarHoras(23);
    await emp.executarRotinas();
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("vez");

    avancarHoras(2);
    await expect(emp.retirar(outro, a, true)).rejects.toMatchObject(regraViolada);
    enviados.length = 0;
    await emp.executarRotinas();
    expect(enviados.map((x) => [x.destinatarioId, x.tipo])).toEqual([[outro, "fila_expirada"], [terceiro, "fila_vez"]]);
    await emp.retirar(terceiro, b, true);
    expect((await emp.meus(outro)).historico[0].situacao).toBe("cancelado");
  });

  it("pedido pendente na liberação: lembra o diretor, e as 24 horas só contam após aprovar", async () => {
    const { dir, membro, outro, item, id } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    await emp.devolver(membro, id);
    enviados.length = 0;
    await emp.conferir(dir, id, { resultado: "liberado" });
    expect(enviados.map((x) => [x.destinatarioId, x.tipo]).sort()).toEqual([[dir, "pedido_pendente"], [outro, "fila_vez"]].sort());
    await expect(emp.retirar(outro, a, true)).rejects.toMatchObject(regraViolada);

    avancarHoras(30);
    await emp.executarRotinas();
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("vez");
    await emp.decidir(dir, a, { aprovar: true });
    avancarHoras(23);
    await emp.retirar(outro, a, true);
  });

  it("recusa de quem estava na vez passa para o próximo", async () => {
    const { dir, membro, outro, terceiro, item, id } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    const b = await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, b, { aprovar: true });
    await emp.devolver(membro, id);
    await emp.conferir(dir, id, { resultado: "liberado" });
    await emp.decidir(dir, a, { aprovar: false, justificativa: "Não" });
    await emp.retirar(terceiro, b, true);
  });

  it("sair da fila passa a vez, e item em manutenção não avança até sair dela", async () => {
    const { dir, membro, outro, terceiro, item, id } = await comFila();
    const a = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    const b = await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, a, { aprovar: true });
    await emp.decidir(dir, b, { aprovar: true });
    await emp.devolver(membro, id);
    await emp.conferir(dir, id, { resultado: "manutencao" });
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("aguardando");
    await emp.definirManutencao(dir, item, false);
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("vez");
    await emp.cancelar(outro, a);
    expect((await emp.meus(terceiro)).ativos[0].filaSituacao).toBe("vez");
  });

  it("entradas simultâneas mantêm uma vez e uma ordem", async () => {
    const { dir, membro, outro, terceiro, item, id } = await comFila();
    const [a, b] = await Promise.all([
      emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" }),
      emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" }),
    ]);
    await Promise.all([emp.decidir(dir, a, { aprovar: true }), emp.decidir(dir, b, { aprovar: true })]);
    await emp.devolver(membro, id);
    await Promise.all([emp.conferir(dir, id, { resultado: "liberado" }), emp.executarRotinas()]);
    const fila = await emp.filaDoItem(dir, item);
    expect(fila.map((f) => f.situacao)).toEqual(["vez", "aguardando"]);
  });
});

describe("repasse", () => {
  async function comItem() {
    const c = await cenario();
    const id = await emprestar(c.dir, c.membro, c.item);
    enviados.length = 0;
    return { ...c, id };
  }

  it("fluxo completo: prazo herdado e responsabilidade muda só na entrega", async () => {
    const { dir, membro, outro, item, id } = await comItem();
    avancarHoras(24);
    const repasse = await emp.proporRepasse(membro, id, outro);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: outro, tipo: "repasse_proposto" });
    await expect(emp.responderRepasse(membro, repasse, true)).rejects.toMatchObject(semPermissao);
    await emp.responderRepasse(outro, repasse, true);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "repasse_para_aprovar" });
    await expect(emp.concluirRepasse(outro, repasse, { aceitouTermo: true })).rejects.toMatchObject(regraViolada);
    await emp.decidirRepasse(dir, repasse, { aprovar: true });
    expect((await inv.obter(dir, item)).item.comQuem).not.toBe((await sistema.ator(outro))?.nome);

    await expect(emp.concluirRepasse(outro, repasse, { aceitouTermo: false })).rejects.toMatchObject(regraViolada);
    await emp.concluirRepasse(outro, repasse, { aceitouTermo: true, observacaoEstado: "Sem riscos" });

    expect((await inv.obter(dir, item)).item.comQuem).toBe((await sistema.ator(outro))?.nome);
    expect((await emp.meus(outro)).ativos[0].dataDevolucao).toBe("2026-11-12");
    expect((await inv.obter(dir, item)).usos.map((u) => u.origem)).toEqual(["repasse", "retirada"]);
    await expect(emp.devolver(membro, id)).rejects.toMatchObject(semPermissao);
    await emp.devolver(outro, id);
  });

  it("para a diretoria, sem fila, o diretor recebe só o aviso", async () => {
    const { dir, membro, item, id } = await comItem();
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const repasse = await emp.proporRepasse(membro, id, diretor);
    await emp.responderRepasse(diretor, repasse, true);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "aviso_repasse" });
    await emp.concluirRepasse(diretor, repasse, { aceitouTermo: true });
    expect((await inv.obter(dir, item)).item.comQuem).toBe((await sistema.ator(diretor))?.nome);
  });

  it("com fila, dentro do prazo, exige aprovação mesmo para a diretoria", async () => {
    const { dir, membro, outro, item, id } = await comItem();
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    const repasse = await emp.proporRepasse(membro, id, diretor);
    await emp.responderRepasse(diretor, repasse, true);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "repasse_para_aprovar" });
    const [visto] = (await emp.painel(dir))!.repasses;
    expect(visto.filaNomes).toHaveLength(1);
    await expect(emp.concluirRepasse(diretor, repasse, { aceitouTermo: true })).rejects.toMatchObject(regraViolada);
    await emp.decidirRepasse(dir, repasse, { aprovar: true });
    await emp.concluirRepasse(diretor, repasse, { aceitouTermo: true });
  });

  it("com prazo encerrado, não repassa: volta à salinha, passa pela conferência e vai para a fila", async () => {
    const { dir, membro, outro, item, id } = await comItem();
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const pedidoFila = await emp.entrarNaFila(outro, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, pedidoFila, { aprovar: true });
    avancarHoras(24 * 3);
    await expect(emp.proporRepasse(membro, id, diretor)).rejects.toMatchObject(regraViolada);
    await emp.devolver(membro, id);
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("aguardando");
    await emp.conferir(dir, id, { resultado: "liberado" });
    expect((await emp.meus(outro)).ativos[0].filaSituacao).toBe("vez");
  });

  it("prazo que acaba durante o repasse com fila impede a conclusão", async () => {
    const { dir, membro, outro, item, id } = await comItem();
    const terceiro = await criarPessoa({ categoria: "calouro" });
    await emp.entrarNaFila(terceiro, { itemId: item, dias: 2, motivo: "x" });
    const repasse = await emp.proporRepasse(membro, id, outro);
    await emp.responderRepasse(outro, repasse, true);
    await emp.decidirRepasse(dir, repasse, { aprovar: true });
    avancarHoras(24 * 3);
    await expect(emp.concluirRepasse(outro, repasse, { aceitouTermo: true })).rejects.toMatchObject(regraViolada);
  });

  it("recusa, pessoa inválida e devolução encerram ou impedem o repasse", async () => {
    const { dir, membro, outro, id } = await comItem();
    const novo = await criarPessoa();
    await expect(emp.proporRepasse(membro, id, novo)).rejects.toMatchObject(regraViolada);
    await expect(emp.proporRepasse(outro, id, membro)).rejects.toMatchObject(semPermissao);
    const r1 = await emp.proporRepasse(membro, id, outro);
    await expect(emp.proporRepasse(membro, id, outro)).rejects.toMatchObject(regraViolada);
    await emp.responderRepasse(outro, r1, false);
    const r2 = await emp.proporRepasse(membro, id, outro);
    await emp.responderRepasse(outro, r2, true);
    await emp.devolver(membro, id);
    await expect(emp.decidirRepasse(dir, r2, { aprovar: true })).rejects.toMatchObject(regraViolada);
    expect((await emp.meus(outro)).repasses).toHaveLength(0);
  });
});

it("usa o dia de Curitiba, não o de Greenwich", async () => {
  const { membro, item } = await cenario();
  relogio.atual = new Date("2026-11-11T01:00:00Z"); // 22h do dia 10 em Curitiba
  await expect(emp.pedir(membro, pedido([item]))).resolves.toHaveLength(1);
});
