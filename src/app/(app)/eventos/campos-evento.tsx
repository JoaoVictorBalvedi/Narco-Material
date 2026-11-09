import { TIPOS_EVENTO } from "@/sistema/eventos";

type Valores = {
  nome?: string; tipo?: string; dataInicio?: string; dataFim?: string; local?: string | null;
  observacoes?: string | null; antecedenciaDias?: number; kitEmergencia?: boolean;
};

export function CamposEvento({ valores = {} }: { valores?: Valores }) {
  return (
    <>
      <div>
        <label htmlFor="nome" className="rotulo">Nome</label>
        <input id="nome" name="nome" required defaultValue={valores.nome} className="campo" />
      </div>
      <div>
        <label htmlFor="tipo" className="rotulo">Tipo</label>
        <select id="tipo" name="tipo" defaultValue={valores.tipo ?? TIPOS_EVENTO[0]} className="campo">
          {TIPOS_EVENTO.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="dataInicio" className="rotulo">Início</label>
          <input id="dataInicio" name="dataInicio" type="date" required defaultValue={valores.dataInicio} className="campo" />
        </div>
        <div>
          <label htmlFor="dataFim" className="rotulo">Fim</label>
          <input id="dataFim" name="dataFim" type="date" defaultValue={valores.dataFim} className="campo" />
        </div>
      </div>
      <div>
        <label htmlFor="local" className="rotulo">Local</label>
        <input id="local" name="local" defaultValue={valores.local ?? ""} className="campo" />
      </div>
      <div>
        <label htmlFor="antecedenciaDias" className="rotulo">Reservar os itens quantos dias antes</label>
        <input id="antecedenciaDias" name="antecedenciaDias" type="number" min={0} defaultValue={valores.antecedenciaDias ?? 2} className="campo" />
      </div>
      <label className="opcao"><input type="checkbox" name="kit" value="sim" defaultChecked={valores.kitEmergencia ?? true} /> Levar o kit de emergência</label>
      <div>
        <label htmlFor="observacoes" className="rotulo">Observações</label>
        <textarea id="observacoes" name="observacoes" rows={3} defaultValue={valores.observacoes ?? ""} className="campo py-2" />
      </div>
    </>
  );
}
