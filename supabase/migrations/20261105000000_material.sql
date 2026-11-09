-- Inventário, finanças do material, empréstimos, fila, repasse, eventos e push.

create type tipo_item as enum ('individual', 'estoque');
create type estado_conservacao as enum ('novo', 'bom', 'regular', 'ruim', 'fora_de_uso');
create type tipo_movimento as enum ('entrada', 'saida');
create type situacao_reembolso as enum ('nao_se_aplica', 'pendente', 'pago');
create type situacao_emprestimo as enum (
  'pendente', 'aprovado', 'recusado', 'cancelado', 'retirado', 'devolvido', 'conferido'
);
create type situacao_fila as enum ('aguardando', 'vez', 'retirado', 'expirada', 'saiu', 'recusada');
create type situacao_decisao as enum ('pendente', 'aprovada', 'recusada', 'cancelada');
create type situacao_repasse as enum (
  'aguardando_aceite', 'aguardando_aprovacao', 'aprovado', 'concluido', 'recusado', 'cancelado'
);
create type funcao_evento as enum ('montar', 'guardar', 'transportar', 'responder');
create type etapa_checklist as enum ('conferencia', 'carga', 'descarga');

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  prefixo text not null unique
);

insert into categorias (nome, prefixo) values
  ('Caixas', 'CX'), ('Surdos', 'SD'), ('Repiques', 'RP'), ('Tamborins', 'TB'),
  ('Chocalhos', 'CH'), ('Agogôs', 'AG'), ('Bandeiras', 'BD'), ('Estandartes e faixas', 'ES'),
  ('Troféus e medalhas', 'TF'), ('Adereços', 'AD'), ('Figurino e roupas', 'FG'),
  ('Ferramentas', 'FR'), ('Peles', 'PL'), ('Baquetas', 'BQ'), ('Talabartes', 'TL'),
  ('Peças de reposição', 'PC'), ('Outros', 'OU');

create table itens (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_item not null,
  categoria_id uuid not null references categorias (id) on delete restrict,
  nome text not null,
  variacao text,
  codigo text unique,
  descricao text,
  estado estado_conservacao not null,
  localizacao text not null default 'Salinha',
  quantidade int check (quantidade >= 0),
  quantidade_minima int check (quantidade_minima >= 0),
  em_manutencao boolean not null default false,
  exemplo boolean not null default false,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null,
  check (
    (tipo = 'individual' and codigo is not null and quantidade is null)
    or (tipo = 'estoque' and quantidade is not null)
  )
);

create table item_midias (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'video')),
  referencia text not null,
  criado_em timestamptz not null
);
create index item_midias_item on item_midias (item_id, criado_em);

create table problemas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  autor_id uuid references perfis (id) on delete set null,
  descricao text not null,
  criado_em timestamptz not null,
  resolvido_por uuid references perfis (id) on delete set null,
  resolvido_em timestamptz
);
create index problemas_item on problemas (item_id, criado_em desc);

create table movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_movimento not null,
  data date not null,
  descricao text not null,
  quem_fez text,
  valor_centavos int not null check (valor_centavos > 0),
  pago_por text,
  comprovante text,
  reembolso situacao_reembolso not null default 'nao_se_aplica',
  exemplo boolean not null default false,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null
);
create index movimentacoes_data on movimentacoes (data desc);

create table movimentacao_itens (
  movimentacao_id uuid not null references movimentacoes (id) on delete cascade,
  item_id uuid not null references itens (id) on delete cascade,
  valor_centavos int not null,
  primary key (movimentacao_id, item_id)
);
create index movimentacao_itens_item on movimentacao_itens (item_id);

create table manutencoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  servico text not null,
  quem_fez text,
  movimentacao_id uuid references movimentacoes (id) on delete set null,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null
);

create table manutencao_itens (
  manutencao_id uuid not null references manutencoes (id) on delete cascade,
  item_id uuid not null references itens (id) on delete cascade,
  primary key (manutencao_id, item_id)
);
create index manutencao_itens_item on manutencao_itens (item_id);

create table estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  tipo tipo_movimento not null,
  quantidade int not null check (quantidade > 0),
  motivo text,
  manutencao_id uuid references manutencoes (id) on delete set null,
  movimentacao_id uuid references movimentacoes (id) on delete set null,
  autor_id uuid references perfis (id) on delete set null,
  criado_em timestamptz not null
);
create index estoque_movimentos_item on estoque_movimentos (item_id, criado_em desc);

create table emprestimos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  item_id uuid not null references itens (id) on delete cascade,
  solicitante_id uuid not null references perfis (id) on delete restrict,
  responsavel_id uuid not null references perfis (id) on delete restrict,
  situacao situacao_emprestimo not null,
  dias int not null check (dias > 0),
  data_retirada date,
  data_devolucao date,
  motivo text,
  justificativa_prazo text,
  em_fila boolean not null default false,
  decidido_por uuid references perfis (id) on delete set null,
  decidido_em timestamptz,
  justificativa_decisao text,
  retirado_em timestamptz,
  devolvido_em timestamptz,
  problema_devolucao text,
  conferido_por uuid references perfis (id) on delete set null,
  conferido_em timestamptz,
  resultado_conferencia text check (resultado_conferencia in ('liberado', 'manutencao')),
  lembrete_vespera_em timestamptz,
  lembrete_dia_em timestamptz,
  atraso_avisado_em timestamptz,
  criado_em timestamptz not null
);
create index emprestimos_item on emprestimos (item_id, situacao);
create index emprestimos_responsavel on emprestimos (responsavel_id, situacao);

-- Um item individual só pode estar fora da salinha com um empréstimo por vez.
create unique index emprestimos_um_ativo_por_item
  on emprestimos (item_id) where situacao in ('retirado', 'devolvido');

create table termos_aceite (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references itens (id) on delete cascade,
  pessoa_id uuid not null references perfis (id) on delete restrict,
  emprestimo_id uuid not null references emprestimos (id) on delete cascade,
  origem text not null check (origem in ('retirada', 'repasse')),
  versao text not null,
  observacao_estado text,
  aceito_em timestamptz not null
);
create index termos_aceite_item on termos_aceite (item_id, aceito_em desc);

create table renovacoes (
  id uuid primary key default gen_random_uuid(),
  emprestimo_id uuid not null references emprestimos (id) on delete cascade,
  nova_data date not null,
  motivo text,
  situacao situacao_decisao not null default 'pendente',
  decidido_por uuid references perfis (id) on delete set null,
  decidido_em timestamptz,
  justificativa_decisao text,
  criado_em timestamptz not null
);
create unique index renovacoes_uma_pendente on renovacoes (emprestimo_id) where situacao = 'pendente';

create table fila_entradas (
  id uuid primary key default gen_random_uuid(),
  ordem bigserial not null,
  item_id uuid not null references itens (id) on delete cascade,
  pessoa_id uuid not null references perfis (id) on delete restrict,
  emprestimo_id uuid not null unique references emprestimos (id) on delete cascade,
  situacao situacao_fila not null default 'aguardando',
  vez_desde timestamptz,
  vez_expira_em timestamptz,
  criada_em timestamptz not null
);
create unique index fila_uma_entrada_ativa on fila_entradas (item_id, pessoa_id)
  where situacao in ('aguardando', 'vez');
create unique index fila_uma_vez_por_item on fila_entradas (item_id) where situacao = 'vez';

create table repasses (
  id uuid primary key default gen_random_uuid(),
  emprestimo_id uuid not null references emprestimos (id) on delete cascade,
  de_id uuid not null references perfis (id) on delete restrict,
  para_id uuid not null references perfis (id) on delete restrict,
  situacao situacao_repasse not null,
  aceito_em timestamptz,
  decidido_por uuid references perfis (id) on delete set null,
  decidido_em timestamptz,
  justificativa_decisao text,
  concluido_em timestamptz,
  criado_em timestamptz not null
);
create unique index repasses_um_aberto on repasses (emprestimo_id)
  where situacao in ('aguardando_aceite', 'aguardando_aprovacao', 'aprovado');

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  data_inicio date not null,
  data_fim date not null,
  local text,
  observacoes text,
  antecedencia_dias int not null default 2 check (antecedencia_dias >= 0),
  kit_emergencia boolean not null default true,
  exemplo boolean not null default false,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null,
  check (data_fim >= data_inicio)
);
create index eventos_data on eventos (data_inicio);

create table evento_itens (
  evento_id uuid not null references eventos (id) on delete cascade,
  item_id uuid not null references itens (id) on delete cascade,
  quantidade int not null default 1 check (quantidade > 0),
  responsavel_id uuid references perfis (id) on delete set null,
  reserva_liberada_em timestamptz,
  reserva_liberada_por uuid references perfis (id) on delete set null,
  primary key (evento_id, item_id)
);
create index evento_itens_item on evento_itens (item_id);

create table evento_responsaveis (
  evento_id uuid not null references eventos (id) on delete cascade,
  pessoa_id uuid not null references perfis (id) on delete cascade,
  funcao funcao_evento not null,
  primary key (evento_id, pessoa_id, funcao)
);

create table evento_escala (
  evento_id uuid not null references eventos (id) on delete cascade,
  item_id uuid not null references itens (id) on delete cascade,
  pessoa_id uuid not null references perfis (id) on delete cascade,
  primary key (evento_id, item_id, pessoa_id)
);

-- "alvo" é o id de um item do evento ou a palavra "kit", para o kit de emergência.
create table evento_checklist (
  evento_id uuid not null references eventos (id) on delete cascade,
  alvo text not null,
  etapa etapa_checklist not null,
  marcado_por uuid references perfis (id) on delete set null,
  marcado_em timestamptz not null,
  primary key (evento_id, alvo, etapa)
);

create table escala_ensaio (
  item_id uuid not null references itens (id) on delete cascade,
  pessoa_id uuid not null references perfis (id) on delete cascade,
  primary key (item_id, pessoa_id)
);

create table push_assinaturas (
  endpoint text primary key,
  pessoa_id uuid not null references perfis (id) on delete cascade,
  chaves jsonb not null,
  criada_em timestamptz not null
);
create index push_assinaturas_pessoa on push_assinaturas (pessoa_id);

do $$
declare tabela text;
begin
  foreach tabela in array array[
    'categorias', 'itens', 'item_midias', 'problemas', 'movimentacoes', 'movimentacao_itens',
    'manutencoes', 'manutencao_itens', 'estoque_movimentos', 'emprestimos', 'termos_aceite',
    'renovacoes', 'fila_entradas', 'repasses', 'eventos', 'evento_itens', 'evento_responsaveis',
    'evento_escala', 'evento_checklist', 'escala_ensaio', 'push_assinaturas'
  ] loop
    execute format('alter table %I enable row level security', tabela);
    execute format('revoke all on %I from anon, authenticated', tabela);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
