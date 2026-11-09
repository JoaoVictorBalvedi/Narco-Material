import { NOME_DISPONIBILIDADE, type Disponibilidade } from "@/sistema/inventario";

const ESTILO: Partial<Record<Disponibilidade, string>> = {
  disponivel: "selo-sucesso",
  em_estoque: "selo-sucesso",
  emprestado: "selo-marca",
  sem_estoque: "selo-marca",
  aguardando_conferencia: "selo-alerta",
  guardado_fila: "selo-alerta",
  reservado_evento: "selo-alerta",
  manutencao: "selo-alerta",
  estoque_baixo: "selo-alerta",
};

export function SeloDisponibilidade({ valor }: { valor: Disponibilidade }) {
  return <span className={ESTILO[valor] ?? "selo"}>{NOME_DISPONIBILIDADE[valor]}</span>;
}
