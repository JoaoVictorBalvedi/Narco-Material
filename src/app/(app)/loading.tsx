/** Aparece na hora ao trocar de tela, enquanto os dados chegam. */
export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando…" className="space-y-3 motion-safe:animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-borda" />
      <div className="h-20 rounded-2xl bg-borda/70" />
      <div className="h-28 rounded-2xl bg-borda/60" />
      <div className="h-28 rounded-2xl bg-borda/50" />
    </div>
  );
}
