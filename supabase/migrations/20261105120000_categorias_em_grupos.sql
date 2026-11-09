-- Categorias em dois níveis: Instrumentos > Caixa, Surdo... Os itens existentes
-- continuam ligados às mesmas linhas, só muda a organização.

alter table categorias
  add column pai_id uuid references categorias (id) on delete restrict,
  add column tipo_padrao tipo_item not null default 'individual',
  add column ordem int not null default 80;

insert into categorias (nome, prefixo) values
  ('Instrumentos', 'IN'),
  ('Bandeiras e estandartes', 'BE')
on conflict do nothing;

update categorias set ordem = 10 where nome = 'Instrumentos';
update categorias set ordem = 20 where nome = 'Bandeiras e estandartes';
update categorias set ordem = 30 where prefixo = 'AD';
update categorias set ordem = 40 where prefixo = 'TF';
update categorias set ordem = 50 where prefixo = 'FG';
update categorias set ordem = 60 where prefixo = 'FR';
update categorias set ordem = 70, tipo_padrao = 'estoque' where prefixo = 'PC';
update categorias set ordem = 90 where prefixo = 'OU';

update categorias set nome = 'Caixa', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'CX' and nome = 'Caixas';
update categorias set nome = 'Surdo', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'SD' and nome = 'Surdos';
update categorias set nome = 'Repique', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'RP' and nome = 'Repiques';
update categorias set nome = 'Tamborim', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'TB' and nome = 'Tamborins';
update categorias set nome = 'Chocalho', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'CH' and nome = 'Chocalhos';
update categorias set nome = 'Agogô', pai_id = (select id from categorias where nome = 'Instrumentos') where prefixo = 'AG' and nome = 'Agogôs';

update categorias set nome = 'Bandeira', pai_id = (select id from categorias where nome = 'Bandeiras e estandartes') where prefixo = 'BD' and nome = 'Bandeiras';
update categorias set nome = 'Estandarte ou faixa', pai_id = (select id from categorias where nome = 'Bandeiras e estandartes') where prefixo = 'ES' and nome = 'Estandartes e faixas';

update categorias set nome = 'Pele', tipo_padrao = 'estoque', pai_id = (select id from categorias where prefixo = 'PC') where prefixo = 'PL' and nome = 'Peles';
update categorias set nome = 'Baqueta', tipo_padrao = 'estoque', pai_id = (select id from categorias where prefixo = 'PC') where prefixo = 'BQ' and nome = 'Baquetas';
update categorias set nome = 'Talabarte', tipo_padrao = 'estoque', pai_id = (select id from categorias where prefixo = 'PC') where prefixo = 'TL' and nome = 'Talabartes';

create index categorias_pai on categorias (pai_id);
