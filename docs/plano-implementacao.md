# Plano de implementação: Narcóticos Material (primeira versão)

**Situação em 04/11/2026:** etapas 1 a 6 concluídas. Na etapa 7, o código está pronto, e faltam os passos que exigem login, descritos em `docs/publicacao.md`.

Este plano organiza a ordem de construção do que está definido em `docs/spec.md`. As etapas são feitas em sequência, porque cada uma usa o que a anterior entregou. A primeira versão deve sair em ciclos curtos, sem esperar tudo ficar perfeito.

Regra para todas as etapas: as regras ficam nas operações do sistema, com testes nesse ponto, e as telas são pensadas primeiro para o celular.

## 1. Base do app

Criar o projeto PWA (Next.js e Supabase local), com instalação, visual, tema claro e escuro, navegação inferior, login por e-mail ou Google, papéis, permissões, delegação e auditoria. Também entra a central de avisos no app, com o envio de push ainda simulado.

**Pronto quando:** cada papel entra no app e vê apenas o que pode, e o Diretor de Material concede e retira permissões.

## 2. Inventário

Criar a tela única com busca e filtros, os itens individuais e de estoque, o cadastro rápido, as fotos comprimidas, os links de vídeo, o estoque mínimo, o histórico de manutenção, o aviso de problema e os dados de exemplo.

**Pronto quando:** o inventário pode ser cadastrado pelo celular, e os dados de exemplo podem ser apagados com um botão.

## 3. Empréstimos

Criar o ciclo completo: pedido, aprovação ou aviso, termo, retirada, devolução e conferência. Também entram conflito de datas, limite de 5 dias, renovação, lembretes e atrasos.

**Pronto quando:** um item passa por todo o ciclo, e a ficha mostra corretamente com quem ele está.

## 4. Fila e repasse

Criar a fila com pedido na entrada, as 24 horas para retirar e a passagem da vez. Criar também o repasse, com prazo herdado, aceite, conferência na entrega e as regras para itens com fila.

**Pronto quando:** os cenários de fila e repasse do spec passam nos testes, inclusive com pedidos simultâneos.

## 5. Eventos e escala

Criar a página do evento, com material, responsáveis, escala da bateria oficial e checklists. Criar também a reserva 2 dias antes, o alerta de conflito, a liberação manual e a escala fixa de ensaio.

**Pronto quando:** um evento reserva seus itens, bloqueia novos empréstimos no período e registra a carga e a descarga.

## 6. Movimentações financeiras

Criar o lançamento único ligado às reformas e compras, as entradas e saídas gerais, o rateio, os comprovantes, os reembolsos pendentes, os totais e o relatório semestral exportável.

**Pronto quando:** uma reforma registrada no item aparece nas movimentações e no relatório, e nenhum valor chega a quem não é da diretoria.

## 7. Publicação e testes reais

Ativar o push real, conferir o app em Android e iPhone, confirmar os limites dos planos gratuitos, configurar a exportação periódica dos dados e publicar. Criar as contas e publicar exige o seu login.

**Pronto quando:** o app está no ar, instalado no seu celular, e o pedido de um membro gera uma notificação para você.

Depois disso, você testa a primeira versão, anota o que não gostou e ajustamos a partir dessa lista. Mostre o visual à Diretoria de Comunicação e Produtos antes de divulgar o app para a bateria (Estatuto, Art. 25, VI).
