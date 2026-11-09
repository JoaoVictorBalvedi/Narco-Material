import { MOTIVOS } from "@/lib/motivos";
import { TEXTO_TERMO } from "@/sistema/emprestimos";

const PRAZOS = [1, 2, 3, 5];

/** Prazo e motivo em um toque. Datas exatas ficam escondidas para quem precisar. */
export function CamposPedido({ hoje, comDatas = true }: { hoje?: string; comDatas?: boolean }) {
  return (
    <>
      <fieldset>
        <legend className="rotulo">Por quantos dias?</legend>
        <div className="grid grid-cols-4 gap-2">
          {PRAZOS.map((dias) => (
            <label key={dias} className="pilula px-2">
              <input type="radio" name="dias" value={dias} defaultChecked={dias === 3} className="sr-only" />
              {dias} {dias === 1 ? "dia" : "dias"}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="rotulo">Para quê?</legend>
        <div className="flex flex-wrap gap-2">
          {MOTIVOS.map((motivo) => (
            <label key={motivo} className="pilula">
              <input type="radio" name="motivo" value={motivo} defaultChecked={motivo === "Ensaio"} className="sr-only" />
              {motivo}
            </label>
          ))}
        </div>
        <input name="detalhe" aria-label="Detalhe do motivo" placeholder="Detalhe, se quiser…" autoComplete="off" className="campo mt-2" />
      </fieldset>
      {comDatas && hoje && (
        <details className="sanfona">
          <summary className="text-sm font-medium text-suave">Escolher datas ou mais de 5 dias</summary>
          <div className="space-y-2 pb-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label htmlFor="inicio" className="rotulo">Retirada</label>
                <input id="inicio" name="inicio" type="date" min={hoje} className="campo" />
              </div>
              <div className="min-w-0">
                <label htmlFor="fim" className="rotulo">Devolução</label>
                <input id="fim" name="fim" type="date" min={hoje} className="campo" />
              </div>
            </div>
            <div>
              <label htmlFor="justificativaPrazo" className="rotulo">Justificativa (acima de 5 dias)</label>
              <input id="justificativaPrazo" name="justificativaPrazo" autoComplete="off" className="campo" />
            </div>
          </div>
        </details>
      )}
    </>
  );
}

/** Checkbox curto, com o texto completo do termo a um toque. */
export function CampoTermo({ name = "termo", rotulo = "Li e aceito o termo de responsabilidade", obrigatorio = true }: { name?: string; rotulo?: string; obrigatorio?: boolean }) {
  return (
    <div className="rounded-xl bg-fundo p-3">
      <label className="opcao font-medium">
        <input type="checkbox" name={name} value="sim" required={obrigatorio} />
        {rotulo}
      </label>
      <details className="text-xs text-suave">
        <summary className="cursor-pointer py-1 font-medium underline-offset-2 hover:underline">Ler o termo</summary>
        <p className="pt-1">{TEXTO_TERMO}</p>
      </details>
    </div>
  );
}
