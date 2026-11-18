-- Diagnóstico Cultural Hofstede — esquema de dados
-- As tabelas ficam no esquema privado "hofstede", que NÃO é exposto pela API.
-- Todo acesso passa por funções RPC em public (prefixo hof_), com SECURITY DEFINER.

create schema if not exists hofstede;
revoke all on schema hofstede from public, anon, authenticated;

-- Administradores (RH) — identificados pelo e-mail da conta Supabase Auth
create table hofstede.admins (
  email      text primary key check (email = lower(email)),
  criado_em  timestamptz not null default now()
);

create table hofstede.departamentos (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique check (length(trim(nome)) > 0)
);

create table hofstede.funcionarios (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) > 0),
  email            text not null unique check (email = lower(email)),
  departamento_id  uuid not null references hofstede.departamentos(id),
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index on hofstede.funcionarios (departamento_id);

create table hofstede.dimensoes (
  codigo     text primary key,
  ordem      int  not null unique,
  nome       text not null,
  descricao  text not null
);

-- Itens do instrumento. A coluna "invertido" nunca é devolvida ao participante.
-- ATENÇÃO: a Nota Metodológica do questionário lista 13 itens invertidos
-- (2, 5, 6, 8, 10, 12, 14, 17, 26, 30, 32, 34, 36). Os itens 20, 23 e 24 (Aversão à
-- Incerteza) afirmam o polo BAIXO da dimensão, e o próprio Guia de Resposta (Exemplo 5)
-- classifica o item 20 como invertido. Por isso eles também estão marcados como invertidos
-- aqui (16 no total). Para seguir a lista literal, basta:
--   update hofstede.itens set invertido = false where numero in (20, 23, 24);
create table hofstede.itens (
  numero     int  primary key check (numero between 1 and 36),
  dimensao   text not null references hofstede.dimensoes(codigo),
  texto      text not null,
  invertido  boolean not null
);

create table hofstede.pesquisas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  titulo             text not null check (length(trim(titulo)) > 0),
  descricao          text,
  empresa_nome       text not null,
  inicio             timestamptz not null,
  fim                timestamptz not null,
  responsavel_nome   text not null,
  responsavel_email  text not null,
  criado_em          timestamptz not null default now(),
  criado_por         text,
  check (fim > inicio)
);

-- Lista de elegíveis congelada por pesquisa (controle de participação, sem conteúdo)
create table hofstede.pesquisa_elegiveis (
  pesquisa_id      uuid not null references hofstede.pesquisas(id) on delete cascade,
  funcionario_id   uuid not null references hofstede.funcionarios(id),
  departamento_id  uuid not null references hofstede.departamentos(id),
  respondeu_em     date,            -- só a data, para não permitir cruzamento por horário
  primary key (pesquisa_id, funcionario_id)
);
create index on hofstede.pesquisa_elegiveis (funcionario_id);

-- Códigos de acesso de uso único enviados por e-mail
create table hofstede.codigos_acesso (
  id              uuid primary key default gen_random_uuid(),
  pesquisa_id     uuid not null references hofstede.pesquisas(id) on delete cascade,
  funcionario_id  uuid not null references hofstede.funcionarios(id),
  codigo_hash     text not null,
  expira_em       timestamptz not null,
  tentativas      int  not null default 0,
  usado           boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index on hofstede.codigos_acesso (pesquisa_id, funcionario_id, criado_em desc);

-- Sessões curtas do participante (após validar o código)
create table hofstede.sessoes (
  token_hash      text primary key,
  pesquisa_id     uuid not null references hofstede.pesquisas(id) on delete cascade,
  funcionario_id  uuid not null references hofstede.funcionarios(id),
  expira_em       timestamptz not null
);

-- Respostas: SEM vínculo com o funcionário e SEM data/hora.
create table hofstede.respostas (
  id               uuid primary key default gen_random_uuid(),
  pesquisa_id      uuid not null references hofstede.pesquisas(id) on delete cascade,
  departamento_id  uuid not null references hofstede.departamentos(id),
  rotulo           text not null,          -- identificador anônimo exibido ao RH (ex.: R-7KQ2M)
  recibo_hash      text not null unique,   -- hash do código pessoal entregue ao participante
  aberta_1         text,
  aberta_2         text,
  flags            jsonb not null default '{}'::jsonb,
  excluida         boolean not null default false,
  motivo_exclusao  text,
  unique (pesquisa_id, rotulo)
);
create index on hofstede.respostas (pesquisa_id, departamento_id);

create table hofstede.respostas_itens (
  resposta_id  uuid not null references hofstede.respostas(id) on delete cascade,
  item         int  not null references hofstede.itens(numero),
  hoje         smallint not null check (hoje between 1 and 5),
  deveria      smallint not null check (deveria between 1 and 5),
  primary key (resposta_id, item)
);

create table hofstede.auditoria (
  id       bigserial primary key,
  quando   timestamptz not null default now(),
  quem     text,
  acao     text not null,
  detalhe  jsonb
);

-- RLS ligado em tudo, sem políticas: nenhum acesso direto pela API.
alter table hofstede.admins             enable row level security;
alter table hofstede.departamentos      enable row level security;
alter table hofstede.funcionarios       enable row level security;
alter table hofstede.dimensoes          enable row level security;
alter table hofstede.itens              enable row level security;
alter table hofstede.pesquisas          enable row level security;
alter table hofstede.pesquisa_elegiveis enable row level security;
alter table hofstede.codigos_acesso     enable row level security;
alter table hofstede.sessoes            enable row level security;
alter table hofstede.respostas          enable row level security;
alter table hofstede.respostas_itens    enable row level security;
alter table hofstede.auditoria          enable row level security;

revoke all on all tables in schema hofstede from public, anon, authenticated;
revoke all on all sequences in schema hofstede from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conteúdo do instrumento
-- ---------------------------------------------------------------------------
insert into hofstede.dimensoes (codigo, ordem, nome, descricao) values
 ('PDI', 1, 'Distância ao Poder', 'Mede o quanto a hierarquia é aceita e o quanto a decisão é concentrada no topo.'),
 ('IDV', 2, 'Individualismo vs. Coletivismo', 'Mede se o foco está no resultado individual ou no resultado do time.'),
 ('MAS', 3, 'Masculinidade vs. Feminilidade', 'Mede se o ambiente valoriza competição e assertividade ou cooperação e bem-estar.'),
 ('UAI', 4, 'Aversão à Incerteza', 'Mede a tolerância a ambiguidade, risco e mudança.'),
 ('LTO', 5, 'Orientação de Longo Prazo', 'Mede se a empresa prioriza resultado imediato ou sustentabilidade e construção de futuro.'),
 ('IVR', 6, 'Indulgência vs. Restrição', 'Mede o espaço para autonomia, informalidade e prazer no trabalho.');

insert into hofstede.itens (numero, dimensao, texto, invertido) values
 (1,  'PDI', 'Um líder eficaz deve tomar as decisões sem consultar a equipe.', false),
 (2,  'PDI', 'Colaboradores devem poder discordar abertamente de um superior.', true),
 (3,  'PDI', 'A hierarquia aqui é respeitada mesmo quando atrapalha a velocidade das decisões.', false),
 (4,  'PDI', 'Subordinados esperam instruções claras antes de agir.', false),
 (5,  'PDI', 'Reuniões de decisão devem incluir as pessoas que executarão a tarefa.', true),
 (6,  'PDI', 'O acesso à alta liderança é natural e informal nesta empresa.', true),
 (7,  'IDV', 'Reconhecimento individual é mais motivador que reconhecimento de equipe.', false),
 (8,  'IDV', 'Metas coletivas pesam mais que metas individuais na avaliação de desempenho.', true),
 (9,  'IDV', 'Cada área deve priorizar seu próprio resultado, mesmo que isso prejudique outra área.', false),
 (10, 'IDV', 'As pessoas aqui se sentem responsáveis pelo resultado do time como um todo.', true),
 (11, 'IDV', 'A empresa valoriza o especialista que resolve sozinho mais que o articulador de time.', false),
 (12, 'IDV', 'Compartilhar crédito por um resultado é prática comum nesta empresa.', true),
 (13, 'MAS', 'Ambiente competitivo é o que extrai o melhor das pessoas.', false),
 (14, 'MAS', 'O bem-estar da equipe importa tanto quanto o resultado financeiro.', true),
 (15, 'MAS', 'Conflito aberto é saudável e deve ser estimulado.', false),
 (16, 'MAS', 'As pessoas aqui são avaliadas principalmente por entrega e superação de meta.', false),
 (17, 'MAS', 'A empresa tolera queda de resultado em troca de qualidade de vida da equipe.', true),
 (18, 'MAS', 'Assertividade e franqueza são mais valorizadas que gentileza no trato.', false),
 (19, 'UAI', 'Precisamos de processos formais definidos antes de agir.', false),
 (20, 'UAI', 'Trabalhamos bem com informação incompleta e em ambiente ambíguo.', true),
 (21, 'UAI', 'Mudanças frequentes de rumo geram desconforto real nesta empresa.', false),
 (22, 'UAI', 'Regras e procedimentos escritos são essenciais para o funcionamento do dia a dia.', false),
 (23, 'UAI', 'As pessoas aqui se sentem confortáveis em testar algo sem garantia de resultado.', true),
 (24, 'UAI', 'A empresa prefere errar rápido a esperar certeza absoluta.', true),
 (25, 'LTO', 'Sacrificamos resultado de curto prazo por posição estratégica de longo prazo.', false),
 (26, 'LTO', 'O que mais importa aqui é o resultado deste trimestre.', true),
 (27, 'LTO', 'Investimos em iniciativas cujo retorno vem em dois anos ou mais.', false),
 (28, 'LTO', 'A empresa mantém compromissos mesmo quando o cenário muda.', false),
 (29, 'LTO', 'Decisões são tomadas pensando nos próximos cinco anos.', false),
 (30, 'LTO', 'Há pressão constante por resultado imediato nesta empresa.', true),
 (31, 'IVR', 'As pessoas aqui têm autonomia real sobre como organizam o próprio trabalho.', false),
 (32, 'IVR', 'O ambiente de trabalho é formal e controlado.', true),
 (33, 'IVR', 'Há espaço para humor e leveza no dia a dia.', false),
 (34, 'IVR', 'As regras de conduta são rígidas e pouco flexíveis.', true),
 (35, 'IVR', 'As pessoas demonstram satisfação genuína em trabalhar aqui.', false),
 (36, 'IVR', 'O trabalho é tratado como dever, não como realização.', true);
