const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil em Curitiba, no formato AAAA-MM-DD. */
export const dataLocal = (instante: Date) => formatador.format(instante);

const utc = (data: string) => new Date(`${data}T00:00:00Z`).getTime();

export function somarDias(data: string, dias: number): string {
  return new Date(utc(data) + dias * 86_400_000).toISOString().slice(0, 10);
}

export const diferencaDias = (de: string, ate: string) => (utc(ate) - utc(de)) / 86_400_000;

export const dataValida = (data: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(utc(data));

/** Divide um valor em partes que somam exatamente o total. */
export function ratear(totalCentavos: number, partes: number): number[] {
  const base = Math.floor(totalCentavos / partes);
  const sobra = totalCentavos - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < sobra ? 1 : 0));
}
