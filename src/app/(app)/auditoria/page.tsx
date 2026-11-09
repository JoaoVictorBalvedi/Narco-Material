import { formatarDataHora } from "@/lib/formato";
import { exigirAcao } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";

export const metadata = { title: "Histórico de ações | Narcóticos Material" };

const ACOES: Record<string, string> = {
  papel_definido: "alterou o papel de",
  situacao_definida: "alterou a situação de",
  cargo_material_transferido: "transferiu o cargo de Material para",
  permissao_concedida: "concedeu uma permissão a",
  permissao_retirada: "retirou uma permissão de",
  item_cadastrado: "cadastrou",
  item_editado: "editou",
  item_removido: "removeu",
  estoque_movimentado: "movimentou o estoque de",
  manutencao_registrada: "registrou manutenção em",
  manutencao_iniciada: "colocou em manutenção",
  manutencao_encerrada: "tirou da manutenção",
  emprestimo_aprovado: "aprovou o empréstimo de",
  emprestimo_recusado: "recusou o empréstimo de",
  emprestimo_cancelado: "cancelou o empréstimo de",
  item_retirado: "retirou",
  item_devolvido: "devolveu",
  devolucao_conferida: "conferiu a devolução de",
  renovacao_aprovada: "aprovou a renovação de",
  renovacao_recusada: "recusou a renovação de",
  repasse_concluido: "recebeu por repasse",
  evento_criado: "criou o evento",
  evento_editado: "editou o evento",
  evento_removido: "removeu o evento",
  reserva_liberada: "liberou uma",
  movimentacao_lancada: "lançou",
  movimentacao_removida: "removeu o lançamento",
  reembolso_pago: "marcou como reembolsado",
  exemplos_criados: "criou os",
  exemplos_apagados: "apagou os",
};

export default async function Page() {
  const ator = await exigirAcao("ver_auditoria");
  const registros = await sistema.auditoria.listar(ator.id);
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Histórico de ações</h1>
      {registros.length === 0 && <p className="cartao text-center text-sm text-suave">Nenhuma ação registrada.</p>}
      <ul className="space-y-2">
        {registros.map((r) => (
          <li key={r.id} className="cartao">
            <p className="text-sm">
              <strong>{r.autorNome ?? "Conta removida"}</strong> {ACOES[r.acao] ?? r.acao}{" "}
              <strong>{r.alvoNome ?? "conta removida"}</strong>
            </p>
            <p className="mt-1 text-xs text-suave">{formatarDataHora(r.criadoEm)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
