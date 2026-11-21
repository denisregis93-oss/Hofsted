-- Público por pesquisa: todos os funcionários ativos ou uma lista específica de e-mails.

alter table hofstede.pesquisas
  add column publico text not null default 'todos' check (publico in ('todos', 'lista'));

-- Adiciona participantes a uma pesquisa.
-- p_linhas: [{"email": "...", "nome": "...", "departamento": "..."}]  (nome e departamento opcionais)
-- Se nome e departamento vierem preenchidos, o cadastro do funcionário é criado/atualizado.
-- Se vier só o e-mail, o funcionário precisa já estar cadastrado.
create or replace function public.hof_adicionar_participantes(p_pesquisa uuid, p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p hofstede.pesquisas;
  l jsonb;
  v_email text; v_nome text; v_dep text; v_dep_id uuid;
  f hofstede.funcionarios;
  n_linha int := 0;
  incluidos int := 0; ja_estavam int := 0; cadastrados int := 0;
  erros jsonb := '[]'::jsonb;
  vistos text[] := '{}';
begin
  perform hofstede.exigir_admin();
  select * into p from hofstede.pesquisas where id = p_pesquisa;
  if not found then raise exception 'Pesquisa não encontrada'; end if;
  if now() > p.fim then raise exception 'A pesquisa está encerrada'; end if;

  for l in select * from jsonb_array_elements(p_linhas) loop
    n_linha := n_linha + 1;
    v_email := nullif(lower(trim(coalesce(l ->> 'email', ''))), '');
    v_nome  := nullif(regexp_replace(trim(coalesce(l ->> 'nome', '')), '\s+', ' ', 'g'), '');
    v_dep   := nullif(regexp_replace(trim(coalesce(l ->> 'departamento', '')), '\s+', ' ', 'g'), '');

    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email, 'erro', 'E-mail inválido');
      continue;
    end if;
    if v_email = any (vistos) then continue; end if;
    vistos := vistos || v_email;

    if v_nome is not null and v_dep is not null then
      select id into v_dep_id from hofstede.departamentos where lower(nome) = lower(v_dep);
      if v_dep_id is null then
        insert into hofstede.departamentos (nome) values (v_dep) returning id into v_dep_id;
      end if;
      insert into hofstede.funcionarios (nome, email, departamento_id) values (v_nome, v_email, v_dep_id)
      on conflict (email) do update set nome = excluded.nome, departamento_id = excluded.departamento_id,
                                        ativo = true, atualizado_em = now();
      cadastrados := cadastrados + 1;
    end if;

    select * into f from hofstede.funcionarios where email = v_email;
    if not found then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email,
        'erro', 'Não cadastrado — informe nome e departamento ou cadastre em Funcionários');
      continue;
    end if;
    if not f.ativo then
      erros := erros || jsonb_build_object('linha', n_linha, 'email', v_email, 'erro', 'Funcionário inativo — reative em Funcionários');
      continue;
    end if;

    insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
    values (p.id, f.id, f.departamento_id)
    on conflict do nothing;
    if found then incluidos := incluidos + 1; else ja_estavam := ja_estavam + 1; end if;
  end loop;

  perform hofstede.auditar('adicionar_participantes', jsonb_build_object('pesquisa', p.id, 'incluidos', incluidos,
                           'ja_estavam', ja_estavam, 'cadastrados', cadastrados, 'erros', jsonb_array_length(erros)));
  return jsonb_build_object('incluidos', incluidos, 'ja_estavam', ja_estavam, 'cadastrados', cadastrados, 'erros', erros);
end $$;

-- Remove um participante que ainda não respondeu
create or replace function public.hof_remover_participante(p_pesquisa uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare e hofstede.pesquisa_elegiveis;
begin
  perform hofstede.exigir_admin();
  select el.* into e from hofstede.pesquisa_elegiveis el join hofstede.funcionarios f on f.id = el.funcionario_id
   where el.pesquisa_id = p_pesquisa and f.email = lower(trim(p_email));
  if not found then raise exception 'Participante não encontrado'; end if;
  if e.respondeu_em is not null then raise exception 'Quem já respondeu não pode ser removido'; end if;
  delete from hofstede.codigos_acesso where pesquisa_id = p_pesquisa and funcionario_id = e.funcionario_id;
  delete from hofstede.sessoes where pesquisa_id = p_pesquisa and funcionario_id = e.funcionario_id;
  delete from hofstede.pesquisa_elegiveis where pesquisa_id = p_pesquisa and funcionario_id = e.funcionario_id;
  perform hofstede.auditar('remover_participante', jsonb_build_object('pesquisa', p_pesquisa, 'email', lower(trim(p_email))));
end $$;

-- Salvar pesquisa: aceita "publico" ('todos' | 'lista')
create or replace function public.hof_salvar_pesquisa(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_inicio timestamptz := (p ->> 'inicio')::timestamptz;
  v_fim timestamptz := (p ->> 'fim')::timestamptz;
  v_hoje boolean := coalesce((p ->> 'coletar_hoje')::boolean, true);
  v_dev boolean := coalesce((p ->> 'coletar_deveria')::boolean, true);
  v_publico text := coalesce(nullif(p ->> 'publico', ''), 'todos');
  atual hofstede.pesquisas;
  v_codigo text;
begin
  perform hofstede.exigir_admin();
  if v_fim <= v_inicio then
    raise exception 'O fim da pesquisa deve ser posterior ao início';
  end if;
  if not (v_hoje or v_dev) then
    raise exception 'Selecione pelo menos uma coluna: É hoje ou Deveria ser';
  end if;
  if v_publico not in ('todos', 'lista') then
    raise exception 'Público inválido';
  end if;
  if coalesce(trim(p ->> 'responsavel_email'), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail do responsável inválido';
  end if;

  if v_id is null then
    loop
      v_codigo := lower(hofstede.aleatorio(8, '23456789abcdefghjkmnpqrstuvwxyz'));
      exit when not exists (select 1 from hofstede.pesquisas where codigo = v_codigo);
    end loop;
    insert into hofstede.pesquisas (codigo, titulo, descricao, empresa_nome, inicio, fim, responsavel_nome, responsavel_email,
                                    criado_por, coletar_hoje, coletar_deveria, publico)
    values (v_codigo, trim(p ->> 'titulo'), nullif(trim(p ->> 'descricao'), ''), trim(p ->> 'empresa_nome'),
            v_inicio, v_fim, trim(p ->> 'responsavel_nome'), lower(trim(p ->> 'responsavel_email')),
            hofstede.email_atual(), v_hoje, v_dev, v_publico)
    returning id into v_id;

    if v_publico = 'todos' then
      insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
      select v_id, f.id, f.departamento_id from hofstede.funcionarios f where f.ativo;
    end if;

    perform hofstede.auditar('criar_pesquisa', jsonb_build_object('id', v_id, 'publico', v_publico));
  else
    select * into atual from hofstede.pesquisas where id = v_id;
    if not found then raise exception 'Pesquisa não encontrada'; end if;
    if now() >= atual.inicio and v_inicio <> atual.inicio then
      raise exception 'A data de início não pode ser alterada depois que a pesquisa começou';
    end if;
    if (v_hoje <> atual.coletar_hoje or v_dev <> atual.coletar_deveria)
       and exists (select 1 from hofstede.respostas where pesquisa_id = v_id) then
      raise exception 'As colunas do questionário não podem ser alteradas depois que a pesquisa recebeu respostas';
    end if;
    update hofstede.pesquisas
       set titulo = trim(p ->> 'titulo'), descricao = nullif(trim(p ->> 'descricao'), ''),
           empresa_nome = trim(p ->> 'empresa_nome'), inicio = v_inicio, fim = v_fim,
           responsavel_nome = trim(p ->> 'responsavel_nome'),
           responsavel_email = lower(trim(p ->> 'responsavel_email')),
           coletar_hoje = v_hoje, coletar_deveria = v_dev, publico = v_publico
     where id = v_id;
    perform hofstede.auditar('editar_pesquisa', jsonb_build_object('id', v_id));
  end if;
  return v_id;
end $$;

drop function public.hof_listar_pesquisas();
create function public.hof_listar_pesquisas()
returns table (id uuid, codigo text, titulo text, descricao text, empresa_nome text, inicio timestamptz, fim timestamptz,
               responsavel_nome text, responsavel_email text, status text, elegiveis bigint, respondentes bigint,
               coletar_hoje boolean, coletar_deveria boolean, publico text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select p.id, p.codigo, p.titulo, p.descricao, p.empresa_nome, p.inicio, p.fim, p.responsavel_nome, p.responsavel_email,
           hofstede.status_pesquisa(p.inicio, p.fim),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id and e.respondeu_em is not null),
           p.coletar_hoje, p.coletar_deveria, p.publico
      from hofstede.pesquisas p order by p.inicio desc;
end $$;

-- Acompanhamento: inclui a lista completa de participantes com situação (participação, nunca conteúdo)
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
       where e.pesquisa_id = p_pesquisa and e.respondeu_em is null), '[]'::jsonb),
    'participantes', coalesce((
      select jsonb_agg(jsonb_build_object('nome', f.nome, 'email', f.email, 'departamento', d.nome,
                                          'respondeu', e.respondeu_em is not null) order by f.nome)
        from hofstede.pesquisa_elegiveis e
        join hofstede.funcionarios f on f.id = e.funcionario_id
        join hofstede.departamentos d on d.id = e.departamento_id
       where e.pesquisa_id = p_pesquisa), '[]'::jsonb)
  ) into r;
  return r;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'hof_adicionar_participantes(uuid, jsonb)',
    'hof_remover_participante(uuid, text)',
    'hof_listar_pesquisas()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
