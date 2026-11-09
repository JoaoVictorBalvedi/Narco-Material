# Publicação

Os passos abaixo exigem as suas contas. Eles ainda não foram executados, então os itens marcados como **conferir** só podem ser confirmados no ambiente real.

Use uma conta à qual você tenha acesso. Quando a bateria tiver uma conta acessível, transfira os projetos para ela.

## 1. Supabase

1. Crie um projeto em supabase.com, na região de São Paulo.
2. Aplique o banco, com o projeto vinculado:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJETO
   npx supabase db push
   ```
3. Em **Authentication > URL Configuration**, informe o endereço do app em **Site URL** e adicione `https://SEU_APP/auth/callback` em **Redirect URLs**.
4. O envio de e-mail do plano gratuito tem limite baixo. Se a confirmação de e-mail atrapalhar os cadastros, avalie desligá-la ou configurar um serviço de e-mail. **Conferir** a opção antes de divulgar.

## 2. Google (opcional)

1. No Google Cloud, crie um cliente OAuth do tipo aplicativo web.
2. Em **URIs de redirecionamento**, use `https://SEU_PROJETO.supabase.co/auth/v1/callback`.
3. No Supabase, em **Authentication > Providers > Google**, informe o ID e o segredo.
4. Na hospedagem, defina `NEXT_PUBLIC_LOGIN_GOOGLE=true`.

## 3. Hospedagem

**Conferir** se o plano Hobby da Vercel se aplica ao uso pela associação. Se não, escolha outra hospedagem para Next.js, com um agendador que chame `/api/rotinas` uma vez por dia enviando o `CRON_SECRET`.

Importe o projeto e defina as variáveis de `.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável |
| `SUPABASE_SECRET_KEY` | Chave secreta. Nunca exponha no navegador |
| `DATABASE_URL` | Conexão pelo pooler (**Connect > Transaction pooler**). **Conferir** a conexão SSL no primeiro acesso |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` | Gere com `npx web-push generate-vapid-keys` |
| `VAPID_CONTATO` | `mailto:` de um e-mail seu |
| `CRON_SECRET` | Valor longo e aleatório |

O agendamento diário já está em `vercel.json`, às 8h de Curitiba.

## 4. Primeiro acesso

1. Crie sua conta no app publicado.
2. Com `DATABASE_URL` de produção em um `.env.local` temporário, rode `npm run primeiro-diretor -- seu@email.com`, e depois apague essa variável do arquivo local.
3. Em **Mais > Dados de exemplo**, teste o que quiser e apague antes do uso real.

## 5. Conferir nos celulares

- Instalar em um Android e em um iPhone.
- Ligar as notificações em **Mais**, fazer um pedido com outra conta e ver a notificação chegar.
- Tirar uma foto pela câmera e conferir o cadastro.

## 6. Antes de divulgar

- Mostre o visual à Diretoria de Comunicação e Produtos (Estatuto, Art. 25, VI).
- O Supabase gratuito pode pausar projetos parados, inclusive nas férias: confira as regras atuais.
- O plano gratuito tem backup limitado: rode `npm run exportar` com frequência e guarde o arquivo em local privado, porque ele contém dados pessoais e financeiros.
