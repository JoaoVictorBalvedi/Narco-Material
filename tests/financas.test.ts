import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { arquivosGuardados, criarItem, criarPessoa, encerrar, foto, limpar, sistema } from "./apoio";

beforeEach(limpar);
afterAll(encerrar);

const fin = sistema.financas;
const inv = sistema.inventario;
const semPermissao = { codigo: "sem_permissao" };
const regraViolada = { codigo: "regra_violada" };
const DE = "2026-11-01";
const ATE = "2026-11-30";

describe("acesso", () => {
  it("só a diretoria vê; membro e novo cadastro não veem nada", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const suplente = await criarPessoa({ cargo: "suplente_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    const novo = await criarPessoa();
    const mov = await fin.lancar(dir, { tipo: "entrada", data: "2026-11-02", descricao: "Venda", valorCentavos: 100, comprovante: foto });

    for (const quem of [diretor, suplente]) await expect(fin.resumo(quem, DE, ATE)).resolves.toMatchObject({ entradas: 100 });
    for (const quem of [membro, novo]) {
      await expect(fin.resumo(quem, DE, ATE)).rejects.toMatchObject(semPermissao);
      await expect(fin.listar(quem, { de: DE, ate: ATE })).rejects.toMatchObject(semPermissao);
      await expect(fin.relatorio(quem, DE, ATE)).rejects.toMatchObject(semPermissao);
      await expect(fin.urlComprovante(quem, mov)).rejects.toMatchObject(semPermissao);
    }
    await expect(fin.urlComprovante(diretor, mov)).resolves.toContain("assinado");
  });

  it("lançam o Diretor de Material, o Financeiro e quem recebeu a permissão", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const financeiro = await criarPessoa({ cargo: "diretor_financeiro" });
    const diretor = await criarPessoa({ cargo: "diretor_eventos" });
    const dados = { tipo: "saida" as const, data: "2026-11-02", descricao: "Prateleira", valorCentavos: 100 };
    await fin.lancar(financeiro, dados);
    await expect(fin.lancar(diretor, dados)).rejects.toMatchObject(semPermissao);
    await sistema.permissoes.conceder(dir, diretor, "lancar_custos");
    await fin.lancar(diretor, dados);
    await sistema.permissoes.retirar(dir, diretor, "lancar_custos");
    await expect(fin.lancar(diretor, dados)).rejects.toMatchObject(semPermissao);
  });
});

describe("movimentações", () => {
  it("resume por período, categoria e item, sem saldo", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const [a, b] = [await criarItem(dir), await criarItem(dir)];
    await fin.lancar(dir, { tipo: "entrada", data: "2026-11-02", descricao: "Venda", valorCentavos: 5000 });
    await fin.lancar(dir, { tipo: "saida", data: "2026-11-03", descricao: "Peles", valorCentavos: 1001, itemIds: [a, b] });
    await fin.lancar(dir, { tipo: "saida", data: "2026-11-04", descricao: "Prateleira", valorCentavos: 2000 });
    await fin.lancar(dir, { tipo: "saida", data: "2026-10-01", descricao: "Fora do período", valorCentavos: 9999 });

    const r = await fin.resumo(dir, DE, ATE);
    expect(r).toMatchObject({ entradas: 5000, saidas: 3001 });
    expect(r).not.toHaveProperty("saldo");
    expect(r.porCategoria).toEqual(expect.arrayContaining([{ categoria: "Instrumentos", totalCentavos: 1001 }, { categoria: "Gastos gerais", totalCentavos: 2000 }]));
    expect(r.porItem.reduce((t, i) => t + i.totalCentavos, 0)).toBe(1001);
    expect((await inv.obter(dir, a)).totalInvestidoCentavos! + (await inv.obter(dir, b)).totalInvestidoCentavos!).toBe(1001);
    expect(await fin.listar(dir, { de: DE, ate: ATE, tipo: "entrada" })).toHaveLength(1);
  });

  it("acompanha reembolsos pendentes", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const mov = await fin.lancar(dir, { tipo: "saida", data: "2026-11-03", descricao: "Parafusos", valorCentavos: 300, pagoPor: "Ana", reembolsoPendente: true });
    expect((await fin.resumo(dir, DE, ATE)).reembolsos).toMatchObject([{ pagoPor: "Ana" }]);
    await fin.marcarReembolsado(dir, mov);
    expect((await fin.resumo(dir, DE, ATE)).reembolsos).toHaveLength(0);
  });

  it("validações e remoção apagam o comprovante", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    await expect(fin.lancar(dir, { tipo: "saida", data: "2026-11-03", descricao: "x", valorCentavos: 0 })).rejects.toMatchObject(regraViolada);
    await expect(fin.lancar(dir, { tipo: "saida", data: "x", descricao: "x", valorCentavos: 1 })).rejects.toMatchObject(regraViolada);
    await expect(fin.resumo(dir, ATE, DE)).rejects.toMatchObject(regraViolada);
    const mov = await fin.lancar(dir, { tipo: "saida", data: "2026-11-03", descricao: "x", valorCentavos: 1, comprovante: { bytes: new Uint8Array([1]), tipo: "application/pdf" } });
    expect(arquivosGuardados.size).toBe(1);
    await fin.remover(dir, mov);
    expect(arquivosGuardados.size).toBe(0);
  });

  it("remover o lançamento mantém a reforma no histórico do item", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const item = await criarItem(dir);
    await inv.registrarManutencao(dir, { itemIds: [item], data: "2026-11-03", servico: "Reforma", valorCentavos: 500 });
    const [mov] = await fin.listar(dir, { de: DE, ate: ATE });
    expect(mov.ligadaManutencao).toBe(true);
    await fin.remover(dir, mov.id);
    const ficha = await inv.obter(dir, item);
    expect(ficha.manutencoes[0].valorCentavos).toBeNull();
    expect(ficha.totalInvestidoCentavos).toBe(0);
  });

  it("o relatório traz o que entrou, saiu, foi consertado e cadastrado", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const item = await criarItem(dir);
    await inv.registrarManutencao(dir, { itemIds: [item], data: "2026-11-03", servico: "Reforma", valorCentavos: 500 });
    await fin.lancar(dir, { tipo: "entrada", data: "2026-11-02", descricao: "Venda", valorCentavos: 100 });
    const r = await fin.relatorio(dir, DE, ATE);
    expect(r.movimentacoes).toHaveLength(2);
    expect(r.manutencoes).toMatchObject([{ servico: "Reforma", valorCentavos: 500 }]);
    expect(r.novosItens).toHaveLength(1);
  });
});
