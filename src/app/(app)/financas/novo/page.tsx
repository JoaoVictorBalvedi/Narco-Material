import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CamposGasto } from "@/componentes/campos-gasto";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { dataLocal } from "@/sistema/datas";
import { lancar } from "../acoes";

export const metadata = { title: "Lançar | Narcóticos Material" };

export default async function Page() {
  const ator = await exigirAcao("lancar_custos");
  const itens = await sistema.inventario.listar(ator.id);
  return (
    <>
      <Link href="/financas" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-suave">
        <ArrowLeft aria-hidden size={18} /> Finanças
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Lançar movimentação</h1>
      <p className="mb-4 text-sm text-suave">Para reforma de um item, use a ficha dele: o valor já entra aqui. O app só registra; os pagamentos seguem fora dele.</p>
      <div className="cartao">
        <Formulario acao={lancar} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="tipo" className="rotulo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue="saida" className="campo">
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </div>
            <div>
              <label htmlFor="data" className="rotulo">Data</label>
              <input id="data" name="data" type="date" defaultValue={dataLocal(new Date())} required className="campo" />
            </div>
          </div>
          <div>
            <label htmlFor="descricao" className="rotulo">Descrição ou origem</label>
            <input id="descricao" name="descricao" required placeholder="Ex.: venda de adesivos, prateleiras" className="campo" />
          </div>
          <div>
            <label htmlFor="quemFez" className="rotulo">Quem fez ou forneceu</label>
            <input id="quemFez" name="quemFez" className="campo" />
          </div>
          <CamposGasto />
          {itens.length > 0 && (
            <details className="sanfona">
              <summary>Ligar a itens (só para saídas)</summary>
              <p className="mb-1 text-xs text-suave">O valor é dividido igualmente entre os itens. Sem item, vira gasto geral.</p>
              <div className="max-h-64 overflow-y-auto">
                {itens.map((i) => (
                  <label key={i.id} className="opcao">
                    <input type="checkbox" name="itens" value={i.id} /> {[i.codigo, i.nome, i.variacao].filter(Boolean).join(" ")}
                  </label>
                ))}
              </div>
            </details>
          )}
          <BotaoEnviar className="w-full">Salvar lançamento</BotaoEnviar>
        </Formulario>
      </div>
    </>
  );
}
