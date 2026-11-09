import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { arquivosGuardados, categoria, consultar, criarEstoque, criarItem, criarPessoa, encerrar, enviados, foto, limpar, sistema } from "./apoio";

beforeEach(limpar);
afterAll(encerrar);

const inv = sistema.inventario;
const semPermissao = { codigo: "sem_permissao" };
const regraViolada = { codigo: "regra_violada" };

describe("cadastro", () => {
  it("gera código por categoria, em sequência, e aceita código existente", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const categoriaId = await categoria("CX");
    const base = { tipo: "individual" as const, categoriaId, nome: "Caixa", estado: "bom" as const, foto };
    expect((await inv.cadastrar(dir, base)).codigo).toBe("CX-01");
    expect((await inv.cadastrar(dir, { ...base, codigo: "CX-07" })).codigo).toBe("CX-07");
    expect((await inv.cadastrar(dir, base)).codigo).toBe("CX-08");
    await expect(inv.cadastrar(dir, { ...base, codigo: "cx-07" })).rejects.toMatchObject(regraViolada);
  });

  it("um cadastro recusado não deixa a foto guardada", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const base = { tipo: "individual" as const, categoriaId: await categoria("CX"), nome: "Caixa", estado: "bom" as const, foto, codigo: "A1" };
    await inv.cadastrar(dir, base);
    await expect(inv.cadastrar(dir, base)).rejects.toMatchObject(regraViolada);
    expect(arquivosGuardados.size).toBe(1);
  });

  it("exige permissão e recusa arquivo que não é imagem", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    const base = { tipo: "individual" as const, categoriaId: await categoria("CX"), nome: "Caixa", estado: "bom" as const, foto };
    await expect(inv.cadastrar(membro, base)).rejects.toMatchObject(semPermissao);
    await expect(inv.cadastrar(dir, { ...base, foto: { bytes: new Uint8Array([1]), tipo: "image/svg+xml" } })).rejects.toMatchObject(regraViolada);
  });

  it("permissão delegada libera o cadastro", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const outro = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(dir, outro, "editar_inventario");
    await expect(criarItem(outro)).resolves.toBeTruthy();
  });

  it("só aceita vídeo do YouTube ou do Drive", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const item = await criarItem(dir);
    await inv.adicionarVideo(dir, item, "https://youtu.be/abc_123");
    await expect(inv.adicionarVideo(dir, item, "https://exemplo.com/video.mp4")).rejects.toMatchObject(regraViolada);
    expect((await inv.obter(dir, item)).videos[0].embutido).toContain("youtube-nocookie.com/embed/abc_123");
  });

  it("item precisa manter uma foto, e item com histórico não é apagado", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const item = await criarItem(dir);
    const [f] = (await inv.obter(dir, item)).fotos;
    await expect(inv.removerMidia(dir, f.id)).rejects.toMatchObject(regraViolada);
    await inv.registrarManutencao(dir, { itemIds: [item], data: "2026-11-01", servico: "Afinação" });
    await expect(inv.remover(dir, item)).rejects.toMatchObject(regraViolada);
    const livre = await criarItem(dir);
    await inv.remover(dir, livre);
    expect(arquivosGuardados.size).toBe(1);
  });
});

describe("lista única", () => {
  it("traz individual e estoque juntos, com busca sem acento e filtros", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    await criarItem(dir, "Agogô");
    await criarEstoque(dir, 0);
    expect(await inv.listar(dir)).toHaveLength(2);
    expect((await inv.listar(dir, { busca: "agogo" })).map((i) => i.nome)).toEqual(["Agogô"]);
    expect((await inv.listar(dir, { disponibilidade: "sem_estoque" })).map((i) => i.nome)).toEqual(["Pele"]);
    expect((await inv.listar(dir, { categoriaId: await categoria("PL") })).map((i) => i.tipo)).toEqual(["estoque"]);
  });

  it("novo cadastro vê disponibilidade, mas não com quem o item está", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    const novo = await criarPessoa();
    const item = await criarItem(dir);
    const [id] = await sistema.emprestimos.pedir(dir, { itemIds: [item], dataRetirada: "2026-11-10", dataDevolucao: "2026-11-12", motivo: "Estudo" });
    await sistema.emprestimos.retirar(dir, id, true);

    const [visto] = await inv.listar(novo);
    expect(visto.disponibilidade).toBe("emprestado");
    expect(visto.comQuem).toBeNull();
    expect((await inv.listar(membro))[0].comQuem).not.toBeNull();
  });

  it("conta desativada não lê o catálogo", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    await sistema.pessoas.definirSituacao(dir, membro, "desativada");
    await expect(inv.listar(membro)).rejects.toMatchObject(semPermissao);
  });
});

describe("categorias", () => {
  const cats = sistema.inventario.categorias;

  it("Instrumentos é uma categoria própria, com os tipos dentro", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const lista = await cats.listar(dir);
    const instrumentos = lista.find((c) => c.nome === "Instrumentos")!;
    expect(instrumentos.tipos.map((t) => t.nome)).toEqual(expect.arrayContaining(["Caixa", "Surdo", "Repique", "Tamborim"]));
    expect(lista[0].nome).toBe("Instrumentos");
    expect(lista.map((c) => c.nome)).not.toContain("Caixa");
    expect(lista.find((c) => c.prefixo === "PC")?.tipoPadrao).toBe("estoque");
  });

  it("filtrar pela categoria principal traz os itens de todos os tipos", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    await criarItem(dir, "Caixa de guerra");
    await sistema.inventario.cadastrar(dir, { tipo: "individual", categoriaId: await categoria("SD"), nome: "Surdo", estado: "bom", foto });
    await criarEstoque(dir);
    const instrumentos = (await cats.listar(dir)).find((c) => c.nome === "Instrumentos")!;
    const itens = await inv.listar(dir, { categoriaId: instrumentos.id });
    expect(itens.map((i) => i.nome).sort()).toEqual(["Caixa de guerra", "Surdo"]);
    expect(itens[0]).toMatchObject({ grupo: "Instrumentos" });
    expect((await inv.listar(dir, { categoriaId: await categoria("SD") })).map((i) => i.nome)).toEqual(["Surdo"]);
  });

  it("cria tipo dentro de categoria, sem terceiro nível, herdando o controle", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const lista = await cats.listar(dir);
    const instrumentos = lista.find((c) => c.nome === "Instrumentos")!;
    const pecas = lista.find((c) => c.prefixo === "PC")!;
    await cats.salvar(dir, { nome: "Cuíca Teste", prefixo: "CU1", paiId: instrumentos.id });
    await cats.salvar(dir, { nome: "Parafuso Teste", prefixo: "PF1", paiId: pecas.id });
    const depois = await cats.listar(dir);
    const parafuso = depois.find((c) => c.prefixo === "PC")!.tipos.find((t) => t.prefixo === "PF1")!;
    expect(parafuso.tipoPadrao).toBe("estoque");
    await expect(cats.salvar(dir, { nome: "Neto", prefixo: "NT1", paiId: await categoria("CX") })).rejects.toMatchObject(regraViolada);
    await expect(cats.remover(dir, instrumentos.id)).rejects.toMatchObject(regraViolada);
    await cats.remover(dir, parafuso.id);
    await cats.remover(dir, await categoria("CU1"));
  });
});

describe("estoque", () => {
  it("baixa, recusa saldo negativo e avisa uma vez ao cruzar o mínimo", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const outro = await criarPessoa({ cargo: "diretor_eventos" });
    await sistema.permissoes.conceder(dir, outro, "editar_inventario");
    const pele = await criarEstoque(dir, 5, 3);
    enviados.length = 0;

    await inv.movimentarEstoque(outro, { itemId: pele, tipo: "saida", quantidade: 2 });
    expect(enviados.filter((a) => a.tipo === "estoque_baixo")).toHaveLength(0);
    await inv.movimentarEstoque(outro, { itemId: pele, tipo: "saida", quantidade: 1 });
    expect(enviados.filter((a) => a.tipo === "estoque_baixo").map((a) => a.destinatarioId).sort()).toEqual([dir, outro].sort());
    await inv.movimentarEstoque(outro, { itemId: pele, tipo: "saida", quantidade: 1 });
    expect(enviados.filter((a) => a.tipo === "estoque_baixo")).toHaveLength(2);

    await expect(inv.movimentarEstoque(dir, { itemId: pele, tipo: "saida", quantidade: 9 })).rejects.toMatchObject(regraViolada);
    await inv.movimentarEstoque(dir, { itemId: pele, tipo: "entrada", quantidade: 10 });
    expect((await inv.obter(dir, pele)).item.quantidade).toBe(11);
  });

  it("compra com valor entra nas finanças, ligada ao item", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const pele = await criarEstoque(dir);
    await inv.movimentarEstoque(dir, { itemId: pele, tipo: "entrada", quantidade: 5, valorCentavos: 50000 });
    expect((await inv.obter(dir, pele)).totalInvestidoCentavos).toBe(50000);
  });
});

describe("manutenção", () => {
  it("troca de peça baixa estoque, registra no item e lança o gasto uma vez", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const caixa = await criarItem(dir);
    const pele = await criarEstoque(dir, 3);
    await inv.registrarManutencao(dir, {
      itemIds: [caixa], data: "2026-11-05", servico: "Troca de pele", quemFez: "Oficina",
      valorCentavos: 8000, pagoPor: "Ana", reembolsoPendente: true, pecas: [{ itemId: pele, quantidade: 1 }],
    });
    const ficha = await inv.obter(dir, caixa);
    expect(ficha.manutencoes).toMatchObject([{ servico: "Troca de pele", quemFez: "Oficina", valorCentavos: 8000 }]);
    expect((await inv.obter(dir, pele)).item.quantidade).toBe(2);
    const resumo = await sistema.financas.resumo(dir, "2026-11-01", "2026-11-30");
    expect(resumo.saidas).toBe(8000);
    expect(resumo.reembolsos).toHaveLength(1);
  });

  it("rateia sem perder centavos, e quem faltou estoque não deixa nada pela metade", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const [a, b, c] = [await criarItem(dir), await criarItem(dir), await criarItem(dir)];
    const pele = await criarEstoque(dir, 1);
    await inv.registrarManutencao(dir, { itemIds: [a, b, c], data: "2026-11-05", servico: "Revisão", valorCentavos: 1000 });
    const totais = await Promise.all([a, b, c].map(async (i) => (await inv.obter(dir, i)).totalInvestidoCentavos!));
    expect(totais.reduce((x, y) => x + y)).toBe(1000);
    expect(Math.max(...totais) - Math.min(...totais)).toBeLessThanOrEqual(1);

    await expect(inv.registrarManutencao(dir, { itemIds: [a], data: "2026-11-05", servico: "Falha", valorCentavos: 500, pecas: [{ itemId: pele, quantidade: 5 }] })).rejects.toMatchObject(regraViolada);
    expect((await sistema.financas.resumo(dir, "2026-11-01", "2026-11-30")).saidas).toBe(1000);
  });

  it("aceita data retroativa sem valor, e recusa data futura", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const item = await criarItem(dir);
    await inv.registrarManutencao(dir, { itemIds: [item], data: "2020-03-01", servico: "Reforma antiga" });
    expect((await inv.obter(dir, item)).manutencoes[0].valorCentavos).toBeNull();
    await expect(inv.registrarManutencao(dir, { itemIds: [item], data: "2026-12-30", servico: "Futuro" })).rejects.toMatchObject(regraViolada);
  });

  it("membro vê a reforma, mas nunca o valor", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    const item = await criarItem(dir);
    await inv.registrarManutencao(dir, { itemIds: [item], data: "2026-11-01", servico: "Reforma", valorCentavos: 9900 });
    const ficha = await inv.obter(membro, item);
    expect(ficha.manutencoes[0].servico).toBe("Reforma");
    expect(ficha.manutencoes[0].valorCentavos).toBeNull();
    expect(ficha.totalInvestidoCentavos).toBeNull();
    expect(JSON.stringify(ficha)).not.toContain("9900");
  });

  it("quem edita inventário sem permissão de custos não lança valor", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const outro = await criarPessoa({ cargo: "diretor_eventos" });
    const financeiro = await criarPessoa({ cargo: "diretor_financeiro" });
    await sistema.permissoes.conceder(dir, outro, "editar_inventario");
    const item = await criarItem(dir);
    await expect(inv.registrarManutencao(outro, { itemIds: [item], data: "2026-11-01", servico: "X", valorCentavos: 100 })).rejects.toMatchObject(semPermissao);
    await inv.registrarManutencao(outro, { itemIds: [item], data: "2026-11-01", servico: "Sem valor" });
    await inv.registrarManutencao(financeiro, { itemIds: [item], data: "2026-11-01", servico: "Com valor", valorCentavos: 100 });
    expect((await inv.obter(dir, item)).manutencoes).toHaveLength(2);
  });
});

describe("problemas", () => {
  it("membro avisa, diretor é notificado e resolve", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "calouro" });
    const novo = await criarPessoa();
    const item = await criarItem(dir);
    await expect(inv.avisarProblema(novo, item, "x")).rejects.toMatchObject(semPermissao);
    await inv.avisarProblema(membro, item, "Pele rasgada");
    expect(enviados.at(-1)).toMatchObject({ destinatarioId: dir, tipo: "problema_item" });
    const [problema] = (await inv.obter(dir, item)).problemas;
    await inv.resolverProblema(dir, problema.id);
    expect((await inv.obter(dir, item)).problemas[0].resolvidoEm).not.toBeNull();
  });
});

describe("dados de exemplo", () => {
  it("cria e apaga tudo de uma vez, sem tocar nos dados reais", async () => {
    const dir = await criarPessoa({ cargo: "diretor_material" });
    const membro = await criarPessoa({ categoria: "ritmista" });
    const real = await criarItem(dir, "Real");
    await sistema.financas.lancar(dir, { tipo: "entrada", data: "2026-11-01", descricao: "Real", valorCentavos: 100 });

    await expect(sistema.exemplo.criar(membro)).rejects.toMatchObject(semPermissao);
    await sistema.exemplo.criar(dir);
    await expect(sistema.exemplo.criar(dir)).rejects.toMatchObject(regraViolada);
    expect(await sistema.exemplo.existe(dir)).toBe(true);
    const exemplo = (await inv.listar(dir)).find((i) => i.exemplo)!;
    const [id] = await sistema.emprestimos.pedir(membro, { itemIds: [(await inv.listar(dir, { busca: "EX-RP-01" }))[0].id], dataRetirada: "2026-11-10", dataDevolucao: "2026-11-11", motivo: "Teste" });
    expect(id).toBeTruthy();
    expect(exemplo).toBeTruthy();

    await sistema.exemplo.apagar(dir);
    expect(await sistema.exemplo.existe(dir)).toBe(false);
    expect((await inv.listar(dir)).map((i) => i.id)).toEqual([real]);
    expect((await sistema.financas.listar(dir, { de: "2026-01-01", ate: "2026-12-31" })).map((m) => m.descricao)).toEqual(["Real"]);
    expect(await sistema.eventos.listar(dir)).toHaveLength(0);
    expect(await consultar(`select 1 from emprestimos`)).toHaveLength(0);
    expect(await consultar(`select 1 from manutencoes`)).toHaveLength(0);
  });
});
