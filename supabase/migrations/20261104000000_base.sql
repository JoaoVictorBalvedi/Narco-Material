-- Base: pessoas, papéis, permissões delegadas, avisos e auditoria.
--
-- O app só acessa estas tabelas pelo servidor. As permissões ficam nas
-- operações do sistema, então o RLS sem políticas e o revoke fecham o acesso
-- direto pela API pública do Supabase.

create type categoria_membro as enum ('calouro', 'aspirante', 'ritmista');

create type cargo_diretoria as enum (
  'presidente',
  'vice_presidente',
  'diretor_eventos',
  'diretor_juridico',
  'diretor_material',
  'suplente_material',
  'diretora_forca_feminina',
  'diretor_comunicacao',
  'diretor_financeiro',
  'diretor_administrativo'
);

create type situacao_pessoa as enum ('ativa', 'suspensa', 'desativada');

create type permissao_delegavel as enum (
  'aprovar_emprestimos',
  'conferir_devolucoes',
  'editar_inventario',
  'lancar_custos'
);

create table perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  categoria categoria_membro,
  cargo cargo_diretoria,
  situacao situacao_pessoa not null default 'ativa',
  criado_em timestamptz not null default now()
);

-- Cada cargo tem uma única pessoa (Estatuto, Art. 19).
create unique index perfis_cargo_unico on perfis (cargo) where cargo is not null;

create table permissoes_delegadas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis (id) on delete cascade,
  permissao permissao_delegavel not null,
  concedida_por uuid references perfis (id) on delete set null,
  concedida_em timestamptz not null,
  retirada_por uuid references perfis (id) on delete set null,
  retirada_em timestamptz
);

create unique index permissoes_delegadas_ativa_unica
  on permissoes_delegadas (perfil_id, permissao) where retirada_em is null;

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references perfis (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  link text,
  criada_em timestamptz not null,
  lida_em timestamptz
);

create index notificacoes_destinatario on notificacoes (destinatario_id, criada_em desc);

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references perfis (id) on delete set null,
  acao text not null,
  alvo_tipo text not null,
  alvo_id uuid,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null
);

create index auditoria_criado_em on auditoria (criado_em desc);

alter table perfis enable row level security;
alter table permissoes_delegadas enable row level security;
alter table notificacoes enable row level security;
alter table auditoria enable row level security;

revoke all on perfis, permissoes_delegadas, notificacoes, auditoria from anon, authenticated;

-- Toda conta nova vira um "novo cadastro": sem categoria e sem cargo.
create function criar_perfil_para_usuario() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function criar_perfil_para_usuario();
