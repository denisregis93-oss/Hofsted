-- RPCs da área administrativa (RH). Todas exigem usuário autenticado presente em hofstede.admins.

create or replace function public.hof_sou_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select hofstede.eh_admin()
$$;

-- ---------------------------------------------------------------------------
-- Funcionários e departamentos
-- ---------------------------------------------------------------------------

-- linhas: [{"nome": "...", "email": "...", "departamento": "..."}]
create or replace function public.hof_importar_funcionarios(p_linhas jsonb, p_inativar_ausentes boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l jsonb;
  v_nome text; v_email text; v_dep text; v_dep_id uuid;
  n_linha int := 0;
  inseridos int := 0; atualizados int := 0; inativados int := 0;
  erros jsonb := '[]'::jsonb;
  vistos text[] := '{}';
  existe boolean;
begin
  perform hofstede.exigir_admin();
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'formato_invalido';
  end if;

  for l in select * from jsonb_array_elements(p_linhas) loop
    n_linha := n_linha + 1;
    v_nome  := nullif(regexp_replace(trim(coalesce(l ->> 'nome', '')), '\s+', ' ', 'g'), '');
    v_email := nullif(lower(trim(coalesce(l ->> 'email', ''))), '');
    v_dep   := nullif(regexp_replace(trim(coalesce(l ->> 'departamento', '')), '\s+', ' ', 'g'), '');

    if v_nome is null or v_email is null or v_dep is null then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email, 'erro', 'Nome, e-mail e departamento são obrigatórios');
      continue;
    end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email, 'erro', 'E-mail inválido');
      continue;
    end if;
    if v_email = any (vistos) then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email, 'erro', 'E-mail repetido na planilha (mantida a primeira ocorrência)');
      continue;
    end if;
    vistos := vistos || v_email;

    select id into v_dep_id from hofstede.departamentos where lower(nome) = lower(v_dep);
    if v_dep_id is null then
      insert into hofstede.departamentos (nome) values (v_dep) returning id into v_dep_id;
    end if;

    select true into existe from hofstede.funcionarios where email = v_email;
    if coalesce(existe, false) then
      update hofstede.funcionarios
         set nome = v_nome, departamento_id = v_dep_id, ativo = true, atualizado_em = now()
       where email = v_email;
      atualizados := atualizados + 1;
    else
      insert into hofstede.funcionarios (nome, email, departamento_id) values (v_nome, v_email, v_dep_id);
      inseridos := inseridos + 1;
    end if;
    existe := null;
  end loop;

  if p_inativar_ausentes and array_length(vistos, 1) > 0 then
    update hofstede.funcionarios set ativo = false, atualizado_em = now()
     where ativo and not (email = any (vistos));
    get diagnostics inativados = row_count;
  end if;

  perform hofstede.auditar('importar_funcionarios', jsonb_build_object(
    'linhas', n_linha, 'inseridos', inseridos, 'atualizados', atualizados,
    'inativados', inativados, 'erros', jsonb_array_length(erros)));

  return jsonb_build_object('linhas', n_linha, 'inseridos', inseridos, 'atualizados', atualizados,
                            'inativados', inativados, 'erros', erros);
end $$;

create or replace function public.hof_listar_funcionarios()
returns table (id uuid, nome text, email text, departamento_id uuid, departamento text, ativo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select f.id, f.nome, f.email, d.id, d.nome, f.ativo
      from hofstede.funcionarios f join hofstede.departamentos d on d.id = f.departamento_id
     order by d.nome, f.nome;
end $$;

create or replace function public.hof_definir_funcionario_ativo(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  update hofstede.funcionarios set ativo = p_ativo, atualizado_em = now() where id = p_id;
  perform hofstede.auditar('funcionario_ativo', jsonb_build_object('id', p_id, 'ativo', p_ativo));
end $$;

create or replace function public.hof_listar_departamentos()
returns table (id uuid, nome text, funcionarios_ativos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select d.id, d.nome, count(f.id) filter (where f.ativo)
      from hofstede.departamentos d left join hofstede.funcionarios f on f.departamento_id = d.id
     group by d.id, d.nome order by d.nome;
end $$;

-- ---------------------------------------------------------------------------
-- Pesquisas
-- ---------------------------------------------------------------------------

-- p: {id?, titulo, descricao, empresa_nome, inicio, fim, responsavel_nome, responsavel_email}
create or replace function public.hof_salvar_pesquisa(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_inicio timestamptz := (p ->> 'inicio')::timestamptz;
  v_fim timestamptz := (p ->> 'fim')::timestamptz;
  atual hofstede.pesquisas;
  v_codigo text;
begin
  perform hofstede.exigir_admin();
  if v_fim <= v_inicio then
    raise exception 'O fim da pesquisa deve ser posterior ao início';
  end if;
  if coalesce(trim(p ->> 'responsavel_email'), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail do responsável inválido';
  end if;

  if v_id is null then
    loop
      v_codigo := lower(hofstede.aleatorio(8, '23456789abcdefghjkmnpqrstuvwxyz'));
      exit when not exists (select 1 from hofstede.pesquisas where codigo = v_codigo);
    end loop;
    insert into hofstede.pesquisas (codigo, titulo, descricao, empresa_nome, inicio, fim,
                                    responsavel_nome, responsavel_email, criado_por)
    values (v_codigo, trim(p ->> 'titulo'), nullif(trim(p ->> 'descricao'), ''), trim(p ->> 'empresa_nome'),
            v_inicio, v_fim, trim(p ->> 'responsavel_nome'), lower(trim(p ->> 'responsavel_email')),
            hofstede.email_atual())
    returning id into v_id;

    -- congela a lista de elegíveis: todos os funcionários ativos no momento da criação
    insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
    select v_id, f.id, f.departamento_id from hofstede.funcionarios f where f.ativo;

    perform hofstede.auditar('criar_pesquisa', jsonb_build_object('id', v_id));
  else
    select * into atual from hofstede.pesquisas where id = v_id;
    if not found then raise exception 'Pesquisa não encontrada'; end if;
    if now() >= atual.inicio and v_inicio <> atual.inicio then
      raise exception 'A data de início não pode ser alterada depois que a pesquisa começou';
    end if;
    update hofstede.pesquisas
       set titulo = trim(p ->> 'titulo'), descricao = nullif(trim(p ->> 'descricao'), ''),
           empresa_nome = trim(p ->> 'empresa_nome'), inicio = v_inicio, fim = v_fim,
           responsavel_nome = trim(p ->> 'responsavel_nome'),
           responsavel_email = lower(trim(p ->> 'responsavel_email'))
     where id = v_id;
    perform hofstede.auditar('editar_pesquisa', jsonb_build_object('id', v_id));
  end if;
  return v_id;
end $$;

-- Inclui na pesquisa os funcionários ativos que ainda não estão na lista de elegíveis
create or replace function public.hof_atualizar_elegiveis(p_pesquisa uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform hofstede.exigir_admin();
  if exists (select 1 from hofstede.pesquisas where id = p_pesquisa and now() > fim) then
    raise exception 'Pesquisa encerrada';
  end if;
  insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
  select p_pesquisa, f.id, f.departamento_id from hofstede.funcionarios f
   where f.ativo
     and not exists (select 1 from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p_pesquisa and e.funcionario_id = f.id);
  get diagnostics n = row_count;
  perform hofstede.auditar('atualizar_elegiveis', jsonb_build_object('id', p_pesquisa, 'incluidos', n));
  return n;
end $$;

create or replace function public.hof_listar_pesquisas()
returns table (id uuid, codigo text, titulo text, descricao text, empresa_nome text, inicio timestamptz, fim timestamptz,
               responsavel_nome text, responsavel_email text, status text, elegiveis bigint, respondentes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select p.id, p.codigo, p.titulo, p.descricao, p.empresa_nome, p.inicio, p.fim, p.responsavel_nome, p.responsavel_email,
           hofstede.status_pesquisa(p.inicio, p.fim),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id and e.respondeu_em is not null)
      from hofstede.pesquisas p order by p.inicio desc;
end $$;

create or replace function public.hof_excluir_pesquisa(p_pesquisa uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  if exists (select 1 from hofstede.respostas where pesquisa_id = p_pesquisa) then
    raise exception 'A pesquisa já tem respostas e não pode ser excluída';
  end if;
  delete from hofstede.pesquisas where id = p_pesquisa;
  perform hofstede.auditar('excluir_pesquisa', jsonb_build_object('id', p_pesquisa));
end $$;

-- Adesão por departamento + lista de pendentes (participação, nunca conteúdo)
create or replace function public.hof_acompanhamento(p_pesquisa uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform hofstede.exigir_admin();
  select jsonb_build_object(
    'departamentos', coalesce((
      select jsonb_agg(jsonb_build_object('departamento_id', d.id, 'departamento', d.nome,
                                          'elegiveis', x.elegiveis, 'respondentes', x.respondentes) order by d.nome)
        from (select e.departamento_id, count(*) elegiveis, count(e.respondeu_em) respondentes
                from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p_pesquisa group by e.departamento_id) x
        join hofstede.departamentos d on d.id = x.departamento_id), '[]'::jsonb),
    'pendentes', coalesce((
      select jsonb_agg(jsonb_build_object('nome', f.nome, 'email', f.email, 'departamento', d.nome) order by d.nome, f.nome)
        from hofstede.pesquisa_elegiveis e
        join hofstede.funcionarios f on f.id = e.funcionario_id
        join hofstede.departamentos d on d.id = e.departamento_id
       where e.pesquisa_id = p_pesquisa and e.respondeu_em is null), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------------
-- Resultados (somente agregados)
-- ---------------------------------------------------------------------------

create or replace function public.hof_relatorio(p_pesquisa uuid, p_departamento uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return jsonb_build_object(
    'respondentes', (select count(*) from hofstede.respostas r
                      where r.pesquisa_id = p_pesquisa and not r.excluida
                        and (p_departamento is null or r.departamento_id = p_departamento)),
    'excluidas', (select count(*) from hofstede.respostas r
                   where r.pesquisa_id = p_pesquisa and r.excluida
                     and (p_departamento is null or r.departamento_id = p_departamento)),
    'elegiveis', (select count(*) from hofstede.pesquisa_elegiveis e
                   where e.pesquisa_id = p_pesquisa and (p_departamento is null or e.departamento_id = p_departamento)),
    'dimensoes', hofstede.estatisticas(p_pesquisa, p_departamento),
    'itens', hofstede.estatisticas_itens(p_pesquisa, p_departamento)
  );
end $$;

create or replace function public.hof_comparar_departamentos(p_pesquisa uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('departamento_id', d.id, 'departamento', d.nome,
                                        'dimensoes', hofstede.estatisticas(p_pesquisa, d.id)) order by d.nome)
      from hofstede.departamentos d
     where exists (select 1 from hofstede.respostas r where r.pesquisa_id = p_pesquisa and r.departamento_id = d.id and not r.excluida)
  ), '[]'::jsonb);
end $$;

-- Evolução ao longo das pesquisas (empresa ou um departamento)
create or replace function public.hof_evolucao(p_departamento uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('pesquisa_id', p.id, 'titulo', p.titulo, 'inicio', p.inicio,
                                        'dimensoes', hofstede.estatisticas(p.id, p_departamento)) order by p.inicio)
      from hofstede.pesquisas p
     where exists (select 1 from hofstede.respostas r where r.pesquisa_id = p.id and not r.excluida
                     and (p_departamento is null or r.departamento_id = p_departamento))
  ), '[]'::jsonb);
end $$;

-- Lista de respostas com alertas de qualidade (identificadas apenas pelo rótulo anônimo)
create or replace function public.hof_qualidade(p_pesquisa uuid)
returns table (resposta_id uuid, rotulo text, departamento text, flags jsonb, excluida boolean, motivo_exclusao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select r.id, r.rotulo, d.nome, r.flags, r.excluida, r.motivo_exclusao
      from hofstede.respostas r join hofstede.departamentos d on d.id = r.departamento_id
     where r.pesquisa_id = p_pesquisa
     order by r.rotulo;
end $$;

create or replace function public.hof_definir_exclusao(p_resposta uuid, p_excluir boolean, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  if p_excluir and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da exclusão';
  end if;
  update hofstede.respostas
     set excluida = p_excluir, motivo_exclusao = case when p_excluir then trim(p_motivo) else null end
   where id = p_resposta;
  perform hofstede.auditar(case when p_excluir then 'excluir_resposta' else 'reincluir_resposta' end,
                           jsonb_build_object('resposta', p_resposta, 'motivo', p_motivo));
end $$;

create or replace function public.hof_respostas_abertas(p_pesquisa uuid, p_departamento uuid default null)
returns table (pergunta int, texto text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select q.pergunta, q.texto from (
      select 1 as pergunta, r.aberta_1 as texto from hofstede.respostas r
       where r.pesquisa_id = p_pesquisa and not r.excluida and nullif(trim(r.aberta_1), '') is not null
         and (p_departamento is null or r.departamento_id = p_departamento)
      union all
      select 2, r.aberta_2 from hofstede.respostas r
       where r.pesquisa_id = p_pesquisa and not r.excluida and nullif(trim(r.aberta_2), '') is not null
         and (p_departamento is null or r.departamento_id = p_departamento)
    ) q order by q.pergunta, random();   -- ordem aleatória: não permite associar as duas respostas da mesma pessoa
end $$;

-- Base anônima para análise externa (notas originais e recodificadas)
create or replace function public.hof_exportar_base(p_pesquisa uuid)
returns table (rotulo text, departamento text, excluida boolean, item int, dimensao text, invertido boolean,
               hoje int, deveria int, hoje_recod int, deveria_recod int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select r.rotulo, d.nome, r.excluida, ri.item, i.dimensao, i.invertido,
           ri.hoje::int, ri.deveria::int,
           (case when i.invertido then 6 - ri.hoje else ri.hoje end)::int,
           (case when i.invertido then 6 - ri.deveria else ri.deveria end)::int
      from hofstede.respostas r
      join hofstede.departamentos d on d.id = r.departamento_id
      join hofstede.respostas_itens ri on ri.resposta_id = r.id
      join hofstede.itens i on i.numero = ri.item
     where r.pesquisa_id = p_pesquisa
     order by r.rotulo, ri.item;
end $$;

-- Permissões: somente usuários autenticados (a checagem de admin é feita dentro de cada função)
do $$
declare f text;
begin
  foreach f in array array[
    'hof_sou_admin()',
    'hof_importar_funcionarios(jsonb, boolean)',
    'hof_listar_funcionarios()',
    'hof_definir_funcionario_ativo(uuid, boolean)',
    'hof_listar_departamentos()',
    'hof_salvar_pesquisa(jsonb)',
    'hof_atualizar_elegiveis(uuid)',
    'hof_listar_pesquisas()',
    'hof_excluir_pesquisa(uuid)',
    'hof_acompanhamento(uuid)',
    'hof_relatorio(uuid, uuid)',
    'hof_comparar_departamentos(uuid)',
    'hof_evolucao(uuid)',
    'hof_qualidade(uuid)',
    'hof_definir_exclusao(uuid, boolean, text)',
    'hof_respostas_abertas(uuid, uuid)',
    'hof_exportar_base(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
