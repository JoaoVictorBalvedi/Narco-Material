# Narcóticos Material

App de controle do material da Bateria Narcóticos PUCPR. O escopo está em `docs/spec.md`, e a ordem de construção, em `docs/plano-implementacao.md`.

## Rodar localmente

Requer Node 24 e Docker aberto.

```bash
npm install
npm run banco
cp .env.example .env.local   # preencha a chave com o valor de: npx supabase status
npm run dev
```

Crie uma conta em http://127.0.0.1:3000 e torne-a o primeiro Diretor de Material:

```bash
npm run primeiro-diretor -- seu@email.com
```

Para liberar memória ao terminar: `npm run banco:parar`. Os dados ficam guardados.

O `supabase/config.toml` já desliga os serviços que o app não usa (API REST, tempo real, Studio, funções e registros). Para ver o banco no navegador, ligue `[studio]` lá.

Para testar com dados fictícios, use **Mais > Dados de exemplo**. Para copiar todos os dados em um JSON: `npm run exportar`.

Para publicar, siga `docs/publicacao.md`.

## Testes

```bash
npm test
```

Os testes usam um banco próprio, `narco_teste`, recriado a cada execução no Supabase local. Os dados de desenvolvimento não são afetados.
