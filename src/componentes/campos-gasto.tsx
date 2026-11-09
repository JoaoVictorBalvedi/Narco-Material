/** Campos de custo usados em reformas e compras: o mesmo lançamento entra nas finanças. */
export function CamposGasto({ ajuda }: { ajuda?: string }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-borda p-3">
      <legend className="px-1 text-sm font-medium">Custo (opcional)</legend>
      {ajuda && <p className="text-xs text-suave">{ajuda}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="valor" className="rotulo">Valor (R$)</label>
          <input id="valor" name="valor" inputMode="decimal" placeholder="0,00" className="campo" />
        </div>
        <div>
          <label htmlFor="pagoPor" className="rotulo">Quem pagou</label>
          <input id="pagoPor" name="pagoPor" className="campo" />
        </div>
      </div>
      <label className="opcao"><input type="checkbox" name="reembolso" value="sim" /> Pagou do próprio bolso: reembolso pendente</label>
      <div>
        <label htmlFor="comprovante" className="rotulo">Comprovante (imagem ou PDF, até 5 MB)</label>
        <input id="comprovante" name="comprovante" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="campo py-2 text-sm" />
      </div>
    </fieldset>
  );
}
