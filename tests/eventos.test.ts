import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { avancarHoras, criarEstoque, criarItem, criarPessoa, encerrar, enviados, limpar, sistema } from "./apoio";

beforeEach(limpar);
afterAll(encerrar);

const ev = sistema.eventos;
const emp = sistema.emprestimos;
const semPermissao = { codigo: "sem_permissao" };
const regraViolada = { codigo: "regra_violada" };
const DADOS = { nome: "Desafio", tipo: "Desafio", dataInicio: "2026-11-20", dataFim: "2026-11-21" };

async function cenario() {
  const dir = await criarPessoa({ cargo: "diretor_material" });
  const diretor = await criarPessoa({ cargo: "diretor_eventos" });
  const membro = await criarPessoa({ categoria: "ritmista" });
  const item = await criarItem(dir);
  const evento = await ev.criar(diretor, DADOS);
  enviados.length = 0;
  return { dir, diretor, membro, item, evento };
}

const pedido = (itemId: string, dataRetirada: string, dataDevolucao: string) => ({ itemIds: [itemId], dataRetirada, dataDevolucao, motivo: "x" });

describe("reserva", () => {
  it("bloqueia a partir de 2 dias antes até o fim do evento, e só nesse período", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    await ev.adicionarItem(diretor, evento, { itemId: item });
    await expect(emp.pedir(membro, pedido(item, "2026-11-18", "2026-11-18"))).rejects.toMatchObject(regraViolada);
    await expect(emp.pedir(membro, pedido(item, "2026-11-21", "2026-11-22"))).rejects.toMatchObject(regraViolada);
    await expect(emp.pedir(membro, pedido(item, "2026-11-16", "2026-11-17"))).resolves.toHaveLength(1);
    await expect(emp.pedir(membro, pedido(item, "2026-11-22", "2026-11-23"))).resolves.toHaveLength(1);
    expect((await sistema.inventario.obter(dir, item)).item.disponibilidade).toBe("disponivel");
    avancarHoras(24 * 8);
    expect((await sistema.inventario.obter(dir, item)).item).toMatchObject({ disponibilidade: "reservado_evento", eventoReservado: "Desafio" });
  });

  it("a antecedência é ajustável em cada evento", async () => {
    const { diretor, membro, item, evento } = await cenario();
    await ev.adicionarItem(diretor, evento, { itemId: item });
    await ev.editar(diretor, evento, { ...DADOS, antecedenciaDias: 5 });
    await expect(emp.pedir(membro, pedido(item, "2026-11-15", "2026-11-15"))).rejects.toMatchObject(regraViolada);
    await ev.editar(diretor, evento, { ...DADOS, antecedenciaDias: 0 });
    await expect(emp.pedir(membro, pedido(item, "2026-11-19", "2026-11-19"))).resolves.toHaveLength(1);
  });

  it("alerta o diretor se o item já tem empréstimo no período", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    const [id] = await emp.pedir(membro, pedido(item, "2026-11-17", "2026-11-19"));
    await emp.decidir(dir, id, { aprovar: true });
    enviados.length = 0;
    expect(await ev.adicionarItem(diretor, evento, { itemId: item })).toBe(1);
    expect(enviados).toMatchObject([{ destinatarioId: dir, tipo: "conflito_evento" }]);
  });

  it("mudar a data do evento também alerta", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    const [id] = await emp.pedir(membro, pedido(item, "2026-11-12", "2026-11-13"));
    await emp.decidir(dir, id, { aprovar: true });
    expect(await ev.adicionarItem(diretor, evento, { itemId: item })).toBe(0);
    enviados.length = 0;
    await ev.editar(diretor, evento, { ...DADOS, dataInicio: "2026-11-14", dataFim: "2026-11-14" });
    expect(enviados.map((a) => a.tipo)).toEqual(["conflito_evento"]);
  });

  it("o diretor libera um item específico; quem não aprova não libera", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    await ev.adicionarItem(diretor, evento, { itemId: item });
    await expect(ev.liberarReserva(diretor, evento, item)).rejects.toMatchObject(semPermissao);
    await ev.liberarReserva(dir, evento, item);
    await expect(emp.pedir(membro, pedido(item, "2026-11-20", "2026-11-21"))).resolves.toHaveLength(1);
    expect((await ev.obter(membro, evento)).itens[0].reservaLiberadaEm).not.toBeNull();
  });

  it("estoque só registra a quantidade planejada, sem reserva nem baixa", async () => {
    const { dir, diretor, evento } = await cenario();
    const pele = await criarEstoque(dir, 4);
    await ev.adicionarItem(diretor, evento, { itemId: pele, quantidade: 3 });
    expect(await ev.adicionarItem(diretor, evento, { itemId: await criarItem(dir, "Outro") })).toBe(0);
    expect((await sistema.inventario.obter(dir, pele)).item.quantidade).toBe(4);
    expect((await ev.obter(dir, evento)).itens.find((i) => i.itemId === pele)?.quantidade).toBe(3);
  });

  it("a fila espera a reserva: só anda quando o item não está reservado", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    const quemEspera = await criarPessoa({ categoria: "aspirante" });
    const [id] = await emp.pedir(dir, pedido(item, "2026-11-10", "2026-11-12"));
    await emp.retirar(dir, id, true);
    const filaPedido = await emp.entrarNaFila(quemEspera, { itemId: item, dias: 5, motivo: "x" });
    await emp.decidir(dir, filaPedido, { aprovar: true });
    await ev.adicionarItem(diretor, evento, { itemId: item });
    avancarHoras(24 * 8); // dia 18: a reserva começou
    await emp.devolver(dir, id);
    await emp.conferir(dir, id, { resultado: "liberado" });
    expect((await emp.meus(quemEspera)).ativos[0].filaSituacao).toBe("aguardando");

    enviados.length = 0;
    await ev.liberarReserva(dir, evento, item);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: quemEspera, tipo: "fila_vez" });
    expect(membro).toBeTruthy();
  });

  it("depois que o evento termina, a rotina faz a fila andar", async () => {
    const { dir, diretor, item, evento } = await cenario();
    const quemEspera = await criarPessoa({ categoria: "aspirante" });
    await ev.adicionarItem(diretor, evento, { itemId: item });
    avancarHoras(24 * 8);
    const filaPedido = await emp.entrarNaFila(quemEspera, { itemId: item, dias: 2, motivo: "x" });
    await emp.decidir(dir, filaPedido, { aprovar: true });
    await emp.executarRotinas();
    expect((await emp.meus(quemEspera)).ativos[0].filaSituacao).toBe("aguardando");
    avancarHoras(24 * 4);
    await emp.executarRotinas();
    expect((await emp.meus(quemEspera)).ativos[0].filaSituacao).toBe("vez");
  });

  it("remover o item do evento devolve a disponibilidade", async () => {
    const { diretor, membro, item, evento } = await cenario();
    await ev.adicionarItem(diretor, evento, { itemId: item });
    await ev.removerItem(diretor, evento, item);
    await expect(emp.pedir(membro, pedido(item, "2026-11-20", "2026-11-21"))).resolves.toHaveLength(1);
  });
});

describe("organização", () => {
  it("responsáveis são avisados, e a escala não bloqueia empréstimos", async () => {
    const { dir, diretor, membro, item, evento } = await cenario();
    await ev.definirResponsaveis(diretor, evento, "transportar", [membro]);
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: membro, tipo: "evento_responsavel" });
    enviados.length = 0;
    await ev.definirResponsaveis(diretor, evento, "transportar", [membro]);
    expect(enviados).toHaveLength(0);

    await ev.definirEscala(diretor, evento, item, [membro, dir]);
    expect((await ev.obter(membro, evento)).escala).toHaveLength(2);
    await sistema.inventario.definirEscalaEnsaio(dir, item, [membro]);
    expect((await sistema.inventario.obter(membro, item)).escala).toHaveLength(1);
    const outro = await criarPessoa({ categoria: "calouro" });
    await expect(emp.pedir(outro, pedido(item, "2026-11-11", "2026-11-12"))).resolves.toHaveLength(1);
  });

  it("checklist: responsáveis e diretoria marcam, com registro de quem marcou", async () => {
    const { diretor, membro, item, evento } = await cenario();
    const outro = await criarPessoa({ categoria: "calouro" });
    await ev.adicionarItem(diretor, evento, { itemId: item, responsavelId: membro });
    await expect(ev.marcarChecklist(outro, evento, item, "carga", true)).rejects.toMatchObject(semPermissao);
    await ev.marcarChecklist(membro, evento, item, "carga", true);
    await ev.marcarChecklist(diretor, evento, "kit", "conferencia", true);
    const { checklist } = await ev.obter(outro, evento);
    expect(checklist).toHaveLength(2);
    expect(checklist.find((c) => c.alvo === item)?.marcadoPorNome).toBeTruthy();
    await ev.marcarChecklist(membro, evento, item, "carga", false);
    expect((await ev.obter(outro, evento)).checklist).toHaveLength(1);
  });

  it("permissões e validações", async () => {
    const { diretor, membro, evento } = await cenario();
    const novo = await criarPessoa();
    await expect(ev.criar(membro, DADOS)).rejects.toMatchObject(semPermissao);
    await expect(ev.listar(novo)).rejects.toMatchObject(semPermissao);
    await expect(ev.obter(novo, evento)).rejects.toMatchObject(semPermissao);
    await expect(ev.criar(diretor, { ...DADOS, dataFim: "2026-11-01" })).rejects.toMatchObject(regraViolada);
  });
});
