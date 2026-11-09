"use client";

import { createContext, Fragment, startTransition, useActionState, useContext } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoAcao } from "@/lib/estado-acao";

export type AcaoFormulario = (anterior: EstadoAcao, dados: FormData) => Promise<EstadoAcao>;

const Enviando = createContext(false);

/**
 * Mantém o que foi digitado quando há erro, o que o envio padrão do React não faz.
 * Com `limparAoSalvar`, os campos voltam ao início para o próximo registro, sem
 * perder o que o componente pai controla, como a categoria escolhida.
 */
export function Formulario({
  acao,
  className,
  limparAoSalvar = false,
  children,
}: {
  acao: AcaoFormulario;
  className?: string;
  limparAoSalvar?: boolean;
  children: React.ReactNode;
}) {
  const [estado, enviar, enviando] = useActionState(
    async (anterior: EstadoAcao & { salvos: number }, dados: FormData) => {
      const resultado = await acao(anterior, dados);
      return { ...resultado, salvos: anterior.salvos + (resultado.sucesso ? 1 : 0) };
    },
    { salvos: 0 },
  );

  return (
    <form
      action={enviar}
      className={className}
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget, (evento.nativeEvent as SubmitEvent).submitter);
        startTransition(() => enviar(dados));
      }}
    >
      <Enviando.Provider value={enviando}>
        <Fragment key={limparAoSalvar ? estado.salvos : 0}>{children}</Fragment>
      </Enviando.Provider>
      <div aria-live="polite" className="empty:hidden">
        {estado.erro && <p className="mt-2 text-sm font-medium text-marca">{estado.erro}</p>}
        {estado.sucesso && <p className="mt-2 text-sm font-medium text-sucesso">{estado.sucesso}</p>}
      </div>
    </form>
  );
}

export function BotaoEnviar({
  children,
  variante = "principal",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  variante?: "principal" | "secundario";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const enviando = useContext(Enviando);
  const estilo = variante === "principal" ? "botao" : "botao-secundario";
  return (
    <button type="submit" disabled={pending || enviando} name={name} value={value} className={`${estilo} ${className}`}>
      {children}
    </button>
  );
}
