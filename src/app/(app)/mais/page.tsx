import { Bell, ChevronRight, Download, History, Tags, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { AtivarNotificacoes } from "@/componentes/ativar-notificacoes";
import { BotaoEnviar, Formulario } from "@/componentes/formulario";
import { chavePublicaPush } from "@/lib/push";
import { atorAtual } from "@/lib/sessao";
import { sistema } from "@/lib/sistema";
import { NOME_CARGO, NOME_CATEGORIA, NOME_PERMISSAO, pode } from "@/sistema/permissoes";
import { sair } from "../../(publico)/entrar/acoes";
import { apagarExemplos, criarExemplos } from "./acoes";

export const metadata = { title: "Mais | Narcóticos Material" };

function Atalho({ href, icone: Icone, children }: { href: string; icone: LucideIcon; children: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-3 px-4 font-medium">
        <Icone aria-hidden size={20} className="text-suave" />
        <span className="flex-1">{children}</span>
        <ChevronRight aria-hidden size={18} className="text-suave" />
      </Link>
    </li>
  );
}

export default async function Page() {
  const ator = await atorAtual();
  const papel = ator.cargo
    ? NOME_CARGO[ator.cargo]
    : ator.categoria
      ? NOME_CATEGORIA[ator.categoria]
      : "Novo cadastro";
  const gerenciaExemplos = pode(ator, "delegar_permissoes");
  const temExemplos = gerenciaExemplos && (await sistema.exemplo.existe(ator.id));
  const chave = chavePublicaPush();

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Mais</h1>
      <section className="cartao mb-4">
        <p className="text-lg font-semibold">{ator.nome}</p>
        <p className="text-sm text-suave">{papel}</p>
        {ator.delegadas.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium">Permissões recebidas</p>
            <div className="flex flex-wrap gap-1">
              {ator.delegadas.map((p) => (
                <span key={p} className="selo-marca">{NOME_PERMISSAO[p]}</span>
              ))}
            </div>
          </div>
        )}
      </section>
      {(pode(ator, "ver_financas") || pode(ator, "editar_inventario") || pode(ator, "definir_papeis")) && (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Gestão</h2>
          <ul className="mb-5 divide-y divide-borda rounded-2xl border border-borda bg-superficie">
            {pode(ator, "ver_financas") && <Atalho href="/financas" icone={Wallet}>Finanças</Atalho>}
            {pode(ator, "definir_papeis") && <Atalho href="/pessoas" icone={Users}>Pessoas e permissões</Atalho>}
            {pode(ator, "editar_inventario") && <Atalho href="/inventario/categorias" icone={Tags}>Categorias do material</Atalho>}
            {pode(ator, "ver_auditoria") && <Atalho href="/auditoria" icone={History}>Histórico de ações</Atalho>}
          </ul>
        </>
      )}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Aplicativo</h2>
      <ul className="mb-4 divide-y divide-borda rounded-2xl border border-borda bg-superficie">
        <Atalho href="/avisos" icone={Bell}>Avisos</Atalho>
        <Atalho href="/instalar" icone={Download}>Instalar no celular</Atalho>
      </ul>
      {chave && <AtivarNotificacoes chavePublica={chave} />}
      {gerenciaExemplos && (
        <section className="cartao mb-4">
          <h2 className="mb-1 font-semibold">Dados de exemplo</h2>
          {temExemplos ? (
            <Formulario acao={apagarExemplos} className="space-y-2">
              <p className="text-sm text-suave">Apaga os itens, eventos e movimentações fictícios, com o que estiver ligado a eles. Os dados reais ficam.</p>
              <label className="opcao"><input type="checkbox" name="confirmo" value="sim" required /> Confirmo que quero apagar</label>
              <BotaoEnviar variante="secundario" className="w-full">Apagar dados de exemplo</BotaoEnviar>
            </Formulario>
          ) : (
            <Formulario acao={criarExemplos} className="space-y-2">
              <p className="text-sm text-suave">Cria itens, um evento e movimentações fictícios para testar o app.</p>
              <BotaoEnviar variante="secundario" className="w-full">Criar dados de exemplo</BotaoEnviar>
            </Formulario>
          )}
        </section>
      )}
      <form action={sair}>
        <BotaoEnviar variante="secundario" className="w-full">Sair</BotaoEnviar>
      </form>
    </>
  );
}
