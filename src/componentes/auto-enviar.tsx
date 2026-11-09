"use client";

/** Seletor que aplica o filtro ao escolher, sem botão extra. */
export function SelectAutoEnviar(props: React.ComponentProps<"select">) {
  return <select {...props} onChange={(evento) => evento.currentTarget.form?.requestSubmit()} />;
}
