# Spec: Narcóticos Material (primeira versão)

**Status:** pronto para implementação
**Data:** 04/11/2026
**Base documental:** Estatuto Social (2024), Regimento Interno (2024) e Proposta de Candidatura à Diretoria de Material

## Problem Statement

A Bateria Narcóticos PUCPR não tem um lugar único para saber o que possui, em que estado cada item está, com quem ele está e quanto já custou mantê-lo.

Hoje, quem precisa de um instrumento depende de encontrar a pessoa certa. O Diretor de Material precisa acompanhar pedidos e devoluções sem um registro central, e fica difícil saber quem responde por um dano. A preparação de eventos não tem uma visão compartilhada de material, responsáveis e conferências. Já a prestação de contas precisa ser remontada a partir de informações dispersas, e a passagem para a próxima gestão corre o risco de perder o histórico.

O estatuto atribui ao Diretor de Material a guarda do patrimônio, do acervo histórico e do almoxarifado (Art. 26). Essas responsabilidades precisam de uma ferramenta simples, gratuita no início e prática no celular.

## Solution

**Narcóticos Material** é um app instalável no celular (PWA), que abre em tela cheia pelo ícone, sem barra de navegador. Ele reúne em um só lugar:

- **Inventário:** instrumentos, bandeiras, troféus, ferramentas, peles, figurino e todo o restante do material, em uma única tela com busca e filtros.
- **Histórico:** reformas, investimentos, responsáveis e usos de cada item.
- **Empréstimos:** pedido, aprovação, termo de responsabilidade, retirada, devolução, conferência, fila de espera, renovação e repasse.
- **Eventos:** material, responsáveis, escala e checklists, com reserva automática dos itens.
- **Movimentações financeiras:** entradas e saídas do material, visíveis só para a diretoria, com relatório semestral exportável.
- **Papéis e permissões:** cada pessoa vê e faz apenas o que seu papel permite, e o Diretor de Material delega permissões quando quiser.

## User Stories

### Conta e acesso

1. Como pessoa interessada, quero criar uma conta com e-mail e senha, para acessar o app sem usar Google.
2. Como pessoa interessada, quero entrar com minha conta Google, para acessar o app sem criar outra senha.
3. Como novo cadastro, quero acessar imediatamente as funções livres, para não precisar esperar uma aprovação para entrar.
4. Como novo cadastro, quero ver o catálogo e a disponibilidade, para conhecer o material da bateria.
5. Como novo cadastro, quero entender que preciso ter minha categoria definida para pedir itens, para saber o próximo passo.
6. Como diretor, quero definir se uma pessoa é calouro, aspirante, ritmista ou membro da diretoria, para liberar o acesso correto.
7. Como pessoa sem permissão, quero não ver as funções restritas, para usar uma interface sem opções que não se aplicam a mim.
8. Como usuário de Android, quero instalar o app por um botão, para abri-lo direto da tela inicial.
9. Como usuário de iPhone, quero um passo a passo de "Adicionar à Tela de Início", para conseguir instalar o app e receber notificações.
10. Como usuário de celular, quero uma navegação na parte de baixo da tela e ações principais a poucos toques, para usar o app rapidamente.
11. Como usuário, quero que o tema claro ou escuro siga a configuração do celular, para enxergar bem em qualquer ambiente.

### Delegação e administração

12. Como Diretor de Material, quero conceder permissões específicas a outros diretores, para dividir o trabalho quando eu precisar.
13. Como Diretor de Material, quero retirar uma permissão quando quiser, para manter o controle do acesso.
14. Como suplente, quero receber apenas as permissões que me forem concedidas, para atuar dentro do que foi combinado.
15. Como diretor com permissão delegada, quero executar as ações concedidas, como aprovar empréstimos ou conferir devoluções, para ajudar na operação.
16. Como Diretor de Material, quero ver quem concedeu cada permissão e quem fez cada ação, para ter rastreabilidade.
17. Como Diretor de Material, quero transferir o cargo para outra conta, para entregar o sistema à próxima gestão.
18. Como Presidente, quero poder transferir o cargo de Diretor de Material, para o app não ficar sem responsável se o diretor não estiver disponível.
19. Como ex-diretor, quero voltar a ser membro comum sem apagar meu histórico, para manter a memória da gestão.
20. Como diretor, quero marcar um membro como suspenso, para impedir novos pedidos durante a suspensão.
21. Como diretor, quero desativar a conta de quem deixou a bateria sem apagar o histórico, para encerrar o acesso sem perder registros.
22. Como Diretor de Material, quero ser alertado quando alguém desativado ainda estiver com um item, para recuperar o material.

### Inventário

23. Como membro, quero ver todo o material em uma única tela, para não precisar procurar em áreas separadas.
24. Como membro, quero buscar por nome ou código, para encontrar um item rapidamente.
25. Como membro, quero filtrar por categoria, status e localização, para reduzir a lista ao que me interessa.
26. Como membro, quero ver a foto, a descrição, o estado de conservação e o vídeo de um item, para saber exatamente de que item se trata.
27. Como membro, quero ver se um item está na salinha, com alguém, em manutenção ou reservado, para saber se posso usá-lo.
28. Como Diretor de Material, quero cadastrar um item individual com código próprio, para acompanhar sua história completa.
29. Como Diretor de Material, quero cadastrar um item de estoque por quantidade e variação, para controlar peles, baquetas e camisetas sem criar uma ficha por unidade.
30. Como Diretor de Material, quero fazer um cadastro rápido com foto, nome, categoria e estado, para levantar a salinha sem preencher tudo de uma vez.
31. Como Diretor de Material, quero que o próximo cadastro abra logo depois de salvar, para registrar vários itens em sequência.
32. Como Diretor de Material, quero que o código seja gerado por categoria e possa ser editado, para aproveitar uma numeração existente.
33. Como Diretor de Material, quero criar e editar categorias, para adaptar o catálogo ao acervo real.
34. Como Diretor de Material, quero adicionar um link do YouTube ou do Google Drive à ficha, para exibir vídeos sem usar o espaço gratuito do app.
35. Como Diretor de Material, quero que as fotos sejam comprimidas automaticamente, para o espaço gratuito durar mais.
36. Como Diretor de Material, quero registrar o estado como Novo, Bom, Regular, Ruim ou Fora de uso, para ter um padrão de conservação.
37. Como Diretor de Material, quero registrar entradas e saídas de estoque, para saber o consumo real.
38. Como Diretor de Material, quero definir uma quantidade mínima, para ser avisado antes de faltar material.
39. Como Diretor de Material, quero que uma troca de peça baixe o estoque e entre no histórico do instrumento, para não registrar a mesma ação duas vezes.
40. Como membro, quero avisar sobre um problema em um instrumento, para que o desgaste seja tratado logo.
41. Como Diretor de Material, quero testar o app com dados de exemplo e apagá-los com um botão, para começar o uso real com a base limpa.

### Histórico e manutenção

42. Como Diretor de Material, quero registrar cada reforma com data, serviço, responsável e valor, para manter o histórico de investimentos.
43. Como Diretor de Material, quero lançar reformas antigas com data retroativa e valor opcional, para preservar o histórico mesmo quando o valor for desconhecido.
44. Como Diretor de Material, quero anexar um comprovante, para fundamentar a prestação de contas.
45. Como membro da diretoria, quero ver quanto já foi investido em um item, para apoiar decisões de reforma ou substituição.
46. Como Diretor de Material, quero ver quem já usou cada item, para acompanhar seu histórico de uso.

### Empréstimos

47. Como membro, quero pedir um ou mais itens informando datas e motivo, para solicitar o material pelo celular.
48. Como membro, quero que o app impeça um pedido em datas ocupadas e ofereça a fila quando o item estiver ocupado, para não fazer um pedido inviável.
49. Como Diretor de Material, quero receber uma notificação no celular quando houver um pedido, para responder rapidamente.
50. Como Diretor de Material, quero aprovar ou recusar um pedido com justificativa, para aplicar critérios claros.
51. Como membro, quero ser notificado da decisão, para saber se posso retirar o item.
52. Como membro da diretoria, quero registrar o empréstimo só avisando o Diretor de Material, para seguir a regra definida para a diretoria.
53. Como membro, quero aceitar o termo de responsabilidade na retirada, para formalizar o empréstimo com base no Art. 9º, III do estatuto.
54. Como membro da diretoria, quero aceitar o mesmo termo, porque a responsabilidade por danos vale para todos os associados.
55. Como membro, quero marcar que devolvi o item na salinha e informar problemas, para registrar a devolução.
56. Como Diretor de Material, quero conferir cada devolução, liberar o item ou enviá-lo para manutenção, para identificar danos no momento certo.
57. Como membro, quero receber lembretes um dia antes e no dia do prazo, para devolver a tempo.
58. Como Diretor de Material, quero ver empréstimos atrasados, para fazer o acompanhamento sem punição automática.
59. Como membro, quero pedir mais de 5 dias com justificativa, para cobrir casos reais, sabendo que isso depende de aprovação.
60. Como membro da diretoria, quero que meu pedido acima de 5 dias também passe por aprovação, para seguir o mesmo limite.
61. Como membro, quero pedir renovação antes do fim do prazo, mesmo que haja fila, para continuar com o item se isso for aprovado.
62. Como Diretor de Material, quero ver a fila ao decidir uma renovação, para considerar quem está esperando.

### Fila de espera

63. Como membro, quero entrar na fila de um item individual ocupado, para pegá-lo quando for liberado.
64. Como membro, quero informar por quantos dias quero o item ao entrar na fila, para que meu pedido fique completo desde o início.
65. Como Diretor de Material, quero decidir o pedido já quando a pessoa entra na fila, para não aprovar duas vezes.
66. Como membro, quero sair da fila se o pedido for recusado, para saber que não preciso continuar esperando.
67. Como primeiro da fila, quero ser notificado quando o item for liberado na conferência, para retirá-lo a tempo.
68. Como primeiro da fila, quero ter 24 horas para retirar o item sem um novo pedido, para não repetir o processo.
69. Como próximo da fila, quero que a vez passe para mim se a pessoa anterior não retirar, para a fila não travar.
70. Como Diretor de Material, quero receber um lembrete se o item for liberado com pedido pendente, para decidir sem atrasar a fila.
71. Como membro, quero ver minha posição na fila, para ter uma expectativa realista.

### Repasse

72. Como responsável por um item, quero repassar o empréstimo para outra pessoa, para evitar uma devolução desnecessária à salinha.
73. Como pessoa indicada, quero aceitar o repasse e o prazo herdado, para assumir o item sabendo das condições.
74. Como pessoa indicada, quero conferir o estado do item e aceitar o termo na entrega, para deixar claro em que condição o recebi.
75. Como responsável atual, quero continuar responsável até a entrega ser concluída, para não haver dúvida sobre quem responde pelo item.
76. Como Diretor de Material, quero aprovar repasses, recebendo apenas um aviso quando a pessoa indicada for da diretoria e não houver fila, para seguir a regra de cada caso.
77. Como Diretor de Material, quero aprovar todo repasse dentro do prazo quando houver fila, vendo as pessoas que aguardam, para evitar que alguém fure a fila sem que eu saiba.
78. Como primeiro da fila, quero que um item com prazo encerrado volte à salinha e passe pela conferência, para recebê-lo na minha vez.

### Eventos e escala

79. Como diretor, quero criar um evento com tipo, datas, local e observações, para centralizar sua organização.
80. Como diretor, quero adicionar ao evento itens individuais e de estoque, para saber o que precisa ser levado.
81. Como diretor, quero nomear responsáveis por montar, guardar, transportar e responder pelo material, para dividir as tarefas antes do evento.
82. Como diretor, quero registrar a escala da bateria oficial por instrumento, com uma ou mais pessoas, para todos saberem quem toca o quê.
83. Como membro, quero ver os eventos, os responsáveis e a escala, para saber o que me cabe.
84. Como Diretor de Material, quero que os itens do evento sejam reservados 2 dias antes, com ajuste por evento, para haver tempo de conferência.
85. Como Diretor de Material, quero receber um alerta se um item separado já estiver emprestado no período, para decidir como resolver.
86. Como Diretor de Material, quero liberar um item específico da reserva, para tratar exceções.
87. Como responsável, quero marcar a conferência pré-evento, para registrar que o material está pronto.
88. Como responsável, quero marcar carga e descarga, com registro de quem marcou, para saber o que saiu e o que voltou.
89. Como diretor, quero um kit de emergência na lista do evento, para resolver imprevistos no local.
90. Como Diretor de Material, quero definir uma escala fixa de ensaio por instrumento, para não refazê-la a cada ensaio.
91. Como membro, quero ver na ficha quem está escalado no instrumento, sabendo que a escala não bloqueia empréstimos, para ter a informação sem uma regra adicional.

### Movimentações financeiras

92. Como Diretor de Material, quero que uma reforma ou compra registrada no item entre nas movimentações, para não digitar duas vezes.
93. Como Diretor de Material ou Financeiro, quero lançar saídas ligadas a um ou mais itens, para saber o custo de cada um.
94. Como Diretor de Material ou Financeiro, quero lançar saídas gerais, para registrar gastos como prateleiras e transporte.
95. Como Diretor de Material ou Financeiro, quero lançar entradas, como vendas e doações, para ver o que entrou para o material.
96. Como Diretor de Material ou Financeiro, quero anexar comprovantes, para facilitar a prestação de contas.
97. Como Diretor de Material ou Financeiro, quero ratear um gasto entre vários itens, para o custo por item ficar correto.
98. Como membro da diretoria, quero ver entradas, saídas e totais por período, para entender as movimentações do material.
99. Como membro da diretoria, quero ver gastos por categoria e por item, para identificar onde o dinheiro está indo.
100. Como membro da diretoria, quero ver reembolsos pendentes, para acompanhar quem pagou do próprio bolso.
101. Como Diretor de Material, quero exportar o relatório semestral, para apresentar ao Diretor Financeiro e à Assembleia sem remontar os dados.
102. Como membro que não é da diretoria, não devo ver valores, resumos ou comprovantes, para respeitar a restrição definida.

## Implementation Decisions

### Plataforma e infraestrutura

- O produto é um **PWA instalável**, com uso principal no celular e abertura em tela cheia pelo ícone. Não há publicação em lojas de aplicativos.
- A pilha é **Next.js, Supabase e Vercel**. O Supabase fornece PostgreSQL, autenticação e armazenamento de arquivos.
- A infraestrutura deve caber em planos gratuitos no início e ficará na conta do desenvolvedor até haver uma conta da bateria acessível para a transferência.
- O app usa português do Brasil e os termos da bateria, como salinha, naipe e desafio.
- O visual usa o logo do mascote e vermelho, branco e preto, com tema claro e escuro conforme o celular. Status são mostrados com cor e texto.
- A interface reduz separações: inventário em tela única, com o tipo de registro tratado como detalhe da ficha.

### Módulos

- **Identidade e Permissões:** contas, categorias, cargos, delegação, suspensão, desativação e transferência de cargo.
- **Inventário:** categorias, itens individuais, itens de estoque, mídia, estado de conservação, localização, histórico e problemas informados.
- **Empréstimos:** pedidos, aprovação, termo, retirada, devolução, conferência, prazos, renovação, repasse e fila.
- **Eventos:** eventos, material, responsáveis, escala, checklists e reserva de itens.
- **Movimentações:** entradas, saídas, vínculo com itens, rateio, comprovantes, reembolsos e relatório.
- **Notificações:** push web e central de avisos no app, com e-mail apenas se couber no plano gratuito.
- **Auditoria:** registro de quem fez cada ação relevante.

Todas as regras ficam em **operações do sistema**, chamadas sempre em nome de um usuário. As telas não decidem regras de negócio. Relógio e envio de notificações são dependências substituíveis.

### Papéis e permissões

Categorias de membro: calouro, aspirante e ritmista. Cargos com regra especial: Diretor de Material, Diretor Financeiro e Presidente.

| Ação | Novo cadastro | Membro | Diretoria | Diretor de Material |
|---|---|---|---|---|
| Ver catálogo e disponibilidade | Sim | Sim | Sim | Sim |
| Pedir empréstimo e entrar na fila | Não | Sim | Sim, só avisando | Sim |
| Ver com quem cada item está | Não | Sim | Sim | Sim |
| Ver eventos e escala | Não | Sim | Sim | Sim |
| Avisar sobre problema em item | Não | Sim | Sim | Sim |
| Ver resumo financeiro e custo por item | Não | Não | Sim | Sim |
| Ver lançamentos e comprovantes | Não | Não | Sim | Sim |
| Aprovar empréstimos, conferir devoluções e editar inventário | Não | Não | Só com delegação | Sim |
| Criar e editar eventos | Não | Não | Sim | Sim |
| Lançar dados financeiros | Não | Não | Diretor Financeiro ou delegação | Sim |
| Definir papel de uma pessoa | Não | Não | Sim | Sim |
| Conceder e retirar permissões | Não | Não | Não | Sim |

- Um novo cadastro só vira membro quando um diretor define sua categoria.
- As permissões são delegáveis uma a uma, incluindo aprovar empréstimos, conferir devoluções, editar inventário e lançar custos.
- O suplente não tem acesso automático: recebe permissões como qualquer outro diretor.
- As permissões são aplicadas nas operações do sistema, no servidor. No banco, RLS sem políticas e a retirada de acessos fecham a API pública do Supabase, então o navegador nunca consulta as tabelas diretamente.
- Valores e comprovantes não podem chegar ao dispositivo de quem não tem permissão.
- A primeira conta do Diretor de Material é a do desenvolvedor.
- Ao confirmar a transferência do cargo, a conta anterior perde os poderes do cargo. Permissões delegadas continuam até serem retiradas.
- O Presidente também pode transferir o cargo de Diretor de Material.
- Membro suspenso não pode fazer pedidos durante a suspensão.
- Conta desativada mantém o histórico e gera alerta se ainda houver item sob sua responsabilidade.

### Modelo de inventário

| | Item individual | Item de estoque |
|---|---|---|
| **Exemplos** | Caixa, surdo, bandeirão, troféu, cabeça do Homer, furadeira, fantasia devolvida após o uso | Pele, baqueta, talabarte, mandioca, parafuso, camiseta por tamanho |
| **Identificação** | Código por categoria, como `CX-07`, editável | Nome e variação |
| **Ficha** | Foto ou vídeo, descrição, estado e localização | Foto, descrição, quantidade e mínimo |
| **Histórico** | Reformas, custos, responsáveis e usos | Entradas, saídas e custos |
| **Empréstimo** | Sim | Não; registra-se consumo |

- Campos obrigatórios: foto, nome, categoria e estado de conservação. Item de estoque também exige quantidade.
- As categorias têm dois níveis: categorias principais (Instrumentos, Bandeiras e estandartes, Adereços, Troféus e medalhas, Figurino e roupas, Ferramentas, Peças de reposição, Outros) e tipos dentro delas (Instrumentos > Caixa, Surdo, Repique...). O código usa a sigla do tipo, como `CX-07`.
- O cadastro começa por "O que você vai cadastrar?", escolhendo a categoria principal e depois o tipo. A categoria sugere se o item é peça única ou várias iguais.
- O app abre em uma página inicial com as pendências da pessoa e botões grandes para as ações principais.
- Estados de conservação: Novo, Bom, Regular, Ruim e Fora de uso.
- O cadastro rápido abre o próximo registro após salvar. Os detalhes podem ser completados depois.
- Não há importação de planilha na primeira versão.
- Uma troca de peça baixa o estoque e registra a ação e o custo no item.
- Quando o estoque fica abaixo do mínimo, o diretor recebe um aviso.
- Fotos são comprimidas e guardadas no app. Vídeos são links do YouTube (não listado) ou do Google Drive, exibidos na ficha.
- Os dados de exemplo são identificáveis e podem ser apagados de uma vez.

### Ciclo do empréstimo

```
Pedido → Aprovado → Retirado → Devolvido → Conferido
```

| Etapa | Responsável | Resultado |
|---|---|---|
| **Pedido** | Solicitante | Itens, datas e motivo registrados; diretor notificado |
| **Aprovação** | Diretor de Material ou delegado | Aprovado ou recusado com justificativa; solicitante notificado; itens reservados nas datas |
| **Retirada** | Solicitante | Termo aceito; item fica "com Fulano" |
| **Devolução** | Solicitante | Devolução marcada e problemas informados; item fica "aguardando conferência" |
| **Conferência** | Diretor de Material ou delegado | Item liberado ou enviado para manutenção; primeiro da fila notificado, se houver |

- **Aprovação:** todos os membros precisam dela. A diretoria pula essa etapa e gera um aviso ao Diretor de Material, exceto nos casos indicados nesta seção.
- **Termo:** todos aceitam, inclusive a diretoria. O aceite fica registrado com pessoa, item e data.
- **Conflito:** o app impede pedidos em datas já reservadas ou ocupadas.
- **Prazo:** máximo padrão de 5 dias a partir da retirada, configurável.
- **Exceção:** mais de 5 dias exige justificativa e aprovação, inclusive para a diretoria.
- **Renovação:** deve ser pedida antes do fim do prazo e aprovada pelo diretor. Com fila, continua permitida, e o diretor vê quem está aguardando.
- **Atraso:** lembretes um dia antes e no dia. Depois disso, o empréstimo aparece como atrasado para o diretor. Não há punição automática.

### Fila de espera

- Vale apenas para item individual ocupado.
- A ordem é de chegada, sem prioridade por categoria ou cargo.
- A entrada na fila já cria o pedido, com a duração desejada (até 5 dias a partir da retirada; acima disso, vale a regra de exceção).
- O diretor aprova ou recusa logo. A recusa remove a pessoa da fila. A entrada de quem é da diretoria gera apenas aviso, salvo nos casos que exigem aprovação.
- A liberação na conferência notifica o primeiro da fila, que tem **24 horas** para retirar sem um novo pedido.
- Durante essas 24 horas, o item fica guardado para essa pessoa.
- Sem retirada no prazo, a vez passa automaticamente para o próximo.
- Se o pedido do primeiro ainda estiver pendente, o diretor recebe um lembrete e as 24 horas só começam após a aprovação.

### Repasse

1. O responsável atual escolhe a pessoa indicada.
2. A pessoa indicada aceita e assume o **prazo original, sem renovação**.
3. O diretor aprova. Se a pessoa indicada for da diretoria e não houver fila, ele recebe apenas um aviso.
4. Na entrega, a pessoa indicada confere o estado e aceita o termo. A responsabilidade muda somente nesse momento, e o histórico registra a troca.

Com fila:
- **Dentro do prazo:** o repasse é permitido, sempre com aprovação do Diretor de Material, inclusive para a diretoria.
- **Prazo encerrado:** o item volta à salinha, passa pela conferência e só então o primeiro da fila é notificado.

### Eventos e escala

- Cada evento tem nome, tipo, datas, local, observações, material, responsáveis, escala e checklists.
- Responsáveis podem ser nomeados para montar, guardar, transportar e responder por cada item.
- A checklist cobre conferência pré-evento, carga e descarga, com registro de quem marcou.
- Itens individuais adicionados ao evento ficam **reservados a partir de 2 dias antes até o fim do evento**. O prazo pode ser ajustado em cada evento.
- O diretor pode liberar um item específico da reserva.
- Se houver empréstimo no período, o diretor recebe um alerta e decide o que fazer.
- A escala permite uma ou mais pessoas por instrumento e é **apenas informativa**. Ela nunca bloqueia empréstimos.
- A escala da bateria oficial fica no evento. A escala fixa de ensaio aparece na ficha do instrumento.

### Movimentações financeiras

- Há um único lançamento: registrar reforma ou compra em um item já cria a movimentação.
- Tipos: saída ligada a itens, saída geral e entrada.
- Saídas registram data, itens (quando houver), descrição, quem fez, valor, quem pagou, comprovante e situação de reembolso.
- Entradas registram data, origem, valor e comprovante. Vendas entram apenas como movimentação.
- Um gasto de vários itens é rateado entre eles.
- A tela mostra entradas, saídas, totais por período, gastos por categoria e item, e reembolsos pendentes.
- **Não há saldo nem fundo do material.**
- O relatório semestral é exportável.
- O app apenas registra. Autorizações e pagamentos continuam fora dele (Estatuto, Art. 22, VIII e Art. 24, IV).
- Podem lançar: Diretor de Material, Diretor Financeiro e diretores com permissão delegada.

### Notificações

Eventos mínimos:
- pedido criado ou pendente;
- decisão sobre pedido, renovação ou repasse;
- aviso de empréstimo ou repasse feito pela diretoria;
- item liberado para o primeiro da fila e mudança de vez;
- prazo de devolução e atraso;
- estoque baixo;
- problema informado em um item;
- conflito entre evento e empréstimo;
- conta desativada com item pendente.

O push é o canal principal. Todo aviso também fica visível no app, para não se perder caso o push falhe ou não esteja disponível. Vencimentos, como as 24 horas da fila, devem ser calculados pela data salva. Assim, uma tarefa agendada atrasada não muda quem tem direito ao item.

### Modelo de dados (conceitual)

- **Pessoa:** conta, categoria, cargo, situação (ativa, suspensa ou desativada).
- **Permissão delegada:** pessoa, permissão, quem concedeu, quando, e retirada.
- **Categoria:** nome, sigla do código, categoria principal (quando é um tipo) e controle padrão (peça única ou quantidade).
- **Item individual:** código, dados da ficha, estado, status e localização.
- **Item de estoque:** nome, variação, quantidade e mínimo.
- **Mídia:** fotos armazenadas e links de vídeo.
- **Registro de manutenção:** itens, data, serviço, responsável e movimentação vinculada.
- **Movimentação de estoque:** item, quantidade, tipo e origem.
- **Movimentação financeira:** tipo, dados, rateio, comprovante e reembolso.
- **Empréstimo:** solicitante, responsável atual, item, datas, situação, decisões, termo, devolução e conferência.
- **Entrada na fila:** item, pessoa, ordem, pedido vinculado e prazo de retirada.
- **Repasse:** empréstimo, pessoa de origem, pessoa indicada, situação e aceite.
- **Evento:** dados, itens, reservas, responsáveis, escala e checklists.
- **Escala de ensaio:** instrumento e pessoas.
- **Notificação** e **assinatura de push**.
- **Registro de auditoria:** autor, ação, alvo e data.

Mudanças em status, fila e reservas devem ser feitas em transação, para dois pedidos simultâneos não ficarem com o mesmo item.

## Testing Decisions

- **Um único ponto de teste:** as operações do sistema, sempre chamadas em nome de um usuário.
- Os testes rodam contra um **PostgreSQL local real**, sem simular o banco.
- **Relógio e notificações são simulados**, para validar prazos e avisos sem esperar.
- Um bom teste verifica o comportamento externo: dado um usuário e uma situação, a operação é permitida ou recusada, e o resultado aparece nas consultas e notificações. Ele não verifica detalhes internos.
- A primeira versão não tem testes automáticos de telas. Elas são validadas pelo uso, com foco em celulares.
- O repositório ainda não tem código nem testes anteriores que sirvam de referência.

Cenários obrigatórios:
- **Permissões:** cada papel da tabela, incluindo delegação, retirada, suspensão e proteção de dados financeiros.
- **Empréstimos:** ciclo completo, recusa, conflito de datas, diferença entre membro e diretoria, limite de 5 dias e atraso.
- **Renovação:** com e sem fila.
- **Fila:** ordem de chegada, pedido na entrada, recusa, pendência na liberação, 24 horas, passagem da vez e dois pedidos simultâneos.
- **Repasse:** prazo herdado, mudança de responsabilidade só na entrega, aprovação com e sem fila, e prazo encerrado.
- **Eventos:** início da reserva, ajuste por evento, alerta de conflito e liberação manual.
- **Inventário:** baixa de estoque, troca de peça, alerta de mínimo e remoção dos dados de exemplo.
- **Finanças:** lançamento único, rateio e totais do relatório.
- **Gestão:** transferência de cargo pelo diretor e pelo Presidente, e alerta de conta desativada com item.

## Out of Scope

Ficam fora da primeira versão:

- Publicação nas lojas de aplicativos.
- Saldo ou fundo do material.
- Caixa geral da associação, incluindo sócios e finanças de eventos.
- Autorização ou execução de pagamentos pelo app.
- Mural de status em tela cheia para a salinha.
- Calendário de manutenção preventiva.
- Assinatura formal do inventário com a gestão anterior.
- Loja e fluxo de venda de produtos, incluindo pele aposentada. As vendas entram apenas como movimentação.
- Importação de planilha.
- Envio direto de vídeos.
- Punições automáticas por atraso ou dano.
- Testes automáticos de telas.

## Further Notes

### Regras dos documentos

- **Regimento, Art. 2º, 5º e 8º:** ritmistas e aspirantes acessam os instrumentos com prévia comunicação; calouros, com comunicação e autorização. Não há regra específica para a diretoria.
- **Decisão da primeira versão:** por decisão do Diretor de Material, "por enquanto" só a diretoria apenas avisa, e os demais precisam de permissão. Isso é mais restritivo que o regimento para ritmistas e aspirantes e pode precisar ser revisto.
- **Transparência:** a proposta promete patrimônio e gastos abertos a qualquer membro. Na primeira versão, valores ficam restritos à diretoria, e a prestação de contas aos membros acontece pelo relatório na Assembleia.
- **Design:** o Art. 25, VI do estatuto exige aprovação prévia do Diretor de Comunicação e Produtos para definições de design. O visual deve ser apresentado antes da divulgação à bateria.

### Limites e riscos a verificar antes do lançamento

- O Supabase gratuito pode pausar projetos inativos, o que pode ocorrer nas férias.
- O backup do plano gratuito é limitado, então é necessária uma exportação periódica.
- O espaço de arquivos é limitado, na ordem de 1 GB.
- O plano Hobby da Vercel é voltado a uso pessoal e não comercial. Se o uso pela associação não se encaixar, a hospedagem precisa mudar.
- No iPhone, o push só funciona com o app adicionado à tela inicial.
- Limites e condições dos planos devem ser confirmados na documentação oficial na data do lançamento.
- A criação das contas e a publicação exigem o login do desenvolvedor.
- As contas de infraestrutura devem ser transferidas para uma conta da bateria quando houver uma acessível.

### Padrões assumidos, a validar no uso

Estes pontos não foram discutidos explicitamente e podem ser ajustados depois da primeira versão:

- **Cargos:** cada cargo tem uma única pessoa (Estatuto, Art. 19). O suplente é um cargo próprio e conta como diretoria para consultar as finanças, sem outras permissões automáticas.
- **Proteção de cargos:** ninguém altera o próprio cargo. A presidência só muda pelo Presidente ou pelo Diretor de Material. Presidente e Diretor de Material não podem ser suspensos nem desativados enquanto ocuparem o cargo.
- **Quem sai da diretoria:** perde as permissões delegadas. Na transferência, o ex-Diretor de Material sem categoria vira ritmista.
- **Suspensão:** uma pessoa suspensa, mesmo sendo diretor, só consulta o catálogo.
- **Repasse com prazo encerrado:** não é permitido, com ou sem fila. Quem recebe herdaria um prazo vencido, então o item volta à salinha.
- **Pedido direto com fila:** um item com fila não aceita pedido direto, mesmo em datas futuras. A pessoa entra na fila.
- **Reserva nunca retirada:** expira depois da data de devolução e libera as datas.
- **Diretor de Material:** os próprios pedidos não precisam de aprovação, inclusive acima de 5 dias, porque é quem aprovaria.
- **Pedido com vários itens:** cada item tem decisão e situação próprias, permitindo aprovação parcial.
- **Evento e fila:** a reserva de evento tem prioridade. O primeiro da fila só é notificado quando o item não estiver reservado para o evento.
- **Item de estoque em evento:** a quantidade é apenas planejada, sem reserva ou baixa automática.
- **Histórico para membros:** membros veem reformas e quem já usou o item, sem valores nem comprovantes.
- **Formato do relatório:** planilha em CSV, que abre no Excel e no Google Planilhas.
- **Publicação do spec:** a pasta não tem repositório git nem issue tracker. Este arquivo é a fonte do spec, e o rótulo `ready-for-agent` não foi aplicado.
