-- Colunas configuráveis por pesquisa: É HOJE e/ou DEVERIA SER (pelo menos uma).

alter table hofstede.pesquisas
  add column coletar_hoje    boolean not null default true,
  add column coletar_deveria boolean not null default true,
  add constraint pesquisas_ao_menos_uma_coluna check (coletar_hoje or coletar_deveria);

alter table hofstede.respostas_itens
  alter column hoje drop not null,
  alter column deveria drop not null,
  add constraint respostas_itens_ao_menos_uma_nota check (hoje is not null or deveria is not null);

-- ---------------------------------------------------------------------------
-- Qualidade: ignora a coluna não coletada
-- ---------------------------------------------------------------------------
create or replace function hofstede.calcular_flags(p_resposta uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  eixo text;
  v int[];
  moda int;
  seq_asc int; seq_desc int;
  i int;
  resultado jsonb := '{}'::jsonb;
  contr jsonb;
begin
  foreach eixo in array array['hoje', 'deveria'] loop
    select array_agg(x.nota order by x.item) into v
      from (select ri.item, case when eixo = 'hoje' then ri.hoje else ri.deveria end as nota
              from hofstede.respostas_itens ri where ri.resposta_id = p_resposta) x
     where x.nota is not null;
    continue when v is null or array_length(v, 1) < 36;

    select max(c) into moda from (select count(*) c from unnest(v) u group by u) t;
    if moda >= 34 then
      resultado := resultado || jsonb_build_object('reta_' || eixo, true);
    end if;

    seq_asc := 0; seq_desc := 0;
    for i in 1 .. array_length(v, 1) - 1 loop
      if v[i + 1] = (v[i] % 5) + 1 then seq_asc := seq_asc + 1; end if;
      if v[i + 1] = ((v[i] + 3) % 5) + 1 then seq_desc := seq_desc + 1; end if;
    end loop;
    if greatest(seq_asc, seq_desc) >= 28 then
      resultado := resultado || jsonb_build_object('alternada_' || eixo, true);
    end if;

    if not exists (select 1 from unnest(v) u where u not in (1, 5)) then
      resultado := resultado || jsonb_build_object('polarizada_' || eixo, true);
    end if;
  end loop;

  with a as (
    select i.dimensao, i.invertido, ri.item, 'hoje' as eixo, ri.hoje as nota
      from hofstede.respostas_itens ri join hofstede.itens i on i.numero = ri.item
     where ri.resposta_id = p_resposta and ri.hoje is not null
    union all
    select i.dimensao, i.invertido, ri.item, 'deveria', ri.deveria
      from hofstede.respostas_itens ri join hofstede.itens i on i.numero = ri.item
     where ri.resposta_id = p_resposta and ri.deveria is not null
  )
  select coalesce(jsonb_agg(distinct jsonb_build_object('dimensao', x.dimensao, 'eixo', x.eixo)), '[]'::jsonb)
    into contr
  from a x join a y
    on x.dimensao = y.dimensao and x.invertido = y.invertido and x.eixo = y.eixo
   and x.item < y.item and abs(x.nota - y.nota) = 4;

  if jsonb_array_length(contr) > 0 then
    resultado := resultado || jsonb_build_object('contradicoes', contr);
  end if;
  return resultado;
end $$;
revoke all on function hofstede.calcular_flags(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pesquisas (RH)
-- ---------------------------------------------------------------------------
create or replace function public.hof_salvar_pesquisa(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_inicio timestamptz := (p ->> 'inicio')::timestamptz;
  v_fim timestamptz := (p ->> 'fim')::timestamptz;
  v_hoje boolean := coalesce((p ->> 'coletar_hoje')::boolean, true);
  v_dev boolean := coalesce((p ->> 'coletar_deveria')::boolean, true);
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
  if coalesce(trim(p ->> 'responsavel_email'), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail do responsável inválido';
  end if;

  if v_id is null then
    loop
      v_codigo := lower(hofstede.aleatorio(8, '23456789abcdefghjkmnpqrstuvwxyz'));
      exit when not exists (select 1 from hofstede.pesquisas where codigo = v_codigo);
    end loop;
    insert into hofstede.pesquisas (codigo, titulo, descricao, empresa_nome, inicio, fim,
                                    responsavel_nome, responsavel_email, criado_por, coletar_hoje, coletar_deveria)
    values (v_codigo, trim(p ->> 'titulo'), nullif(trim(p ->> 'descricao'), ''), trim(p ->> 'empresa_nome'),
            v_inicio, v_fim, trim(p ->> 'responsavel_nome'), lower(trim(p ->> 'responsavel_email')),
            hofstede.email_atual(), v_hoje, v_dev)
    returning id into v_id;

    insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
    select v_id, f.id, f.departamento_id from hofstede.funcionarios f where f.ativo;

    perform hofstede.auditar('criar_pesquisa', jsonb_build_object('id', v_id));
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
           coletar_hoje = v_hoje, coletar_deveria = v_dev
     where id = v_id;
    perform hofstede.auditar('editar_pesquisa', jsonb_build_object('id', v_id));
  end if;
  return v_id;
end $$;

drop function public.hof_listar_pesquisas();
create function public.hof_listar_pesquisas()
returns table (id uuid, codigo text, titulo text, descricao text, empresa_nome text, inicio timestamptz, fim timestamptz,
               responsavel_nome text, responsavel_email text, status text, elegiveis bigint, respondentes bigint,
               coletar_hoje boolean, coletar_deveria boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select p.id, p.codigo, p.titulo, p.descricao, p.empresa_nome, p.inicio, p.fim, p.responsavel_nome, p.responsavel_email,
           hofstede.status_pesquisa(p.inicio, p.fim),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id and e.respondeu_em is not null),
           p.coletar_hoje, p.coletar_deveria
      from hofstede.pesquisas p order by p.inicio desc;
end $$;
revoke all on function public.hof_listar_pesquisas() from public, anon;
grant execute on function public.hof_listar_pesquisas() to authenticated;

-- Evolução: informa as colunas de cada pesquisa
create or replace function public.hof_evolucao(p_departamento uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('pesquisa_id', p.id, 'titulo', p.titulo, 'inicio', p.inicio,
                                        'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria,
                                        'dimensoes', hofstede.estatisticas(p.id, p_departamento)) order by p.inicio)
      from hofstede.pesquisas p
     where exists (select 1 from hofstede.respostas r where r.pesquisa_id = p.id and not r.excluida
                     and (p_departamento is null or r.departamento_id = p_departamento))
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Participante
-- ---------------------------------------------------------------------------
create or replace function public.hof_info_pesquisa(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('titulo', p.titulo, 'descricao', p.descricao, 'empresa_nome', p.empresa_nome,
                            'inicio', p.inicio, 'fim', p.fim, 'status', hofstede.status_pesquisa(p.inicio, p.fim),
                            'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email,
                            'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria)
    from hofstede.pesquisas p where p.codigo = lower(trim(p_codigo))
$$;

create or replace function public.hof_questionario(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s hofstede.sessoes := hofstede.sessao_valida(p_token);
begin
  return jsonb_build_object(
    'pesquisa', (select jsonb_build_object('titulo', p.titulo, 'empresa_nome', p.empresa_nome, 'fim', p.fim,
                                           'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email,
                                           'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria)
                   from hofstede.pesquisas p where p.id = s.pesquisa_id),
    'partes', (select jsonb_agg(jsonb_build_object(
                 'ordem', d.ordem, 'nome', d.nome, 'descricao', d.descricao,
                 'itens', (select jsonb_agg(jsonb_build_object('numero', i.numero, 'texto', i.texto) order by i.numero)
                             from hofstede.itens i where i.dimensao = d.codigo)) order by d.ordem)
                 from hofstede.dimensoes d)
  );
end $$;

create or replace function public.hof_enviar_respostas(p_token text, p_itens jsonb, p_aberta_1 text, p_aberta_2 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s hofstede.sessoes := hofstede.sessao_valida(p_token);
  p hofstede.pesquisas;
  e hofstede.pesquisa_elegiveis;
  v_resposta uuid;
  v_recibo text;
  v_rotulo text;
  n int;
begin
  select * into p from hofstede.pesquisas where id = s.pesquisa_id;
  if hofstede.status_pesquisa(p.inicio, p.fim) <> 'aberta' then
    raise exception 'pesquisa_fora_do_prazo';
  end if;

  select * into e from hofstede.pesquisa_elegiveis
   where pesquisa_id = s.pesquisa_id and funcionario_id = s.funcionario_id for update;
  if e.respondeu_em is not null then
    raise exception 'ja_respondeu';
  end if;

  -- 36 itens distintos; cada coluna coletada com nota 1–5; coluna não coletada deve vir vazia
  select count(distinct (x ->> 'item')::int) into n
    from jsonb_array_elements(p_itens) x
   where (x ->> 'item')::int between 1 and 36
     and case when p.coletar_hoje    then coalesce((x ->> 'hoje')::int, 0)    between 1 and 5 else x ->> 'hoje'    is null end
     and case when p.coletar_deveria then coalesce((x ->> 'deveria')::int, 0) between 1 and 5 else x ->> 'deveria' is null end;
  if n <> 36 or jsonb_array_length(p_itens) <> 36 then
    raise exception 'respostas_incompletas';
  end if;

  v_recibo := hofstede.aleatorio(12);
  loop
    v_rotulo := 'R-' || hofstede.aleatorio(5);
    exit when not exists (select 1 from hofstede.respostas where pesquisa_id = p.id and rotulo = v_rotulo);
  end loop;

  insert into hofstede.respostas (pesquisa_id, departamento_id, rotulo, recibo_hash, aberta_1, aberta_2)
  values (p.id, e.departamento_id, v_rotulo, hofstede.sha(v_recibo),
          nullif(left(trim(p_aberta_1), 4000), ''), nullif(left(trim(p_aberta_2), 4000), ''))
  returning id into v_resposta;

  insert into hofstede.respostas_itens (resposta_id, item, hoje, deveria)
  select v_resposta, (x ->> 'item')::int, (x ->> 'hoje')::smallint, (x ->> 'deveria')::smallint
    from jsonb_array_elements(p_itens) x;

  update hofstede.respostas set flags = hofstede.calcular_flags(v_resposta) where id = v_resposta;

  update hofstede.pesquisa_elegiveis set respondeu_em = (now() at time zone 'America/Sao_Paulo')::date
   where pesquisa_id = s.pesquisa_id and funcionario_id = s.funcionario_id;
  delete from hofstede.sessoes where funcionario_id = s.funcionario_id and pesquisa_id = s.pesquisa_id;

  return jsonb_build_object('recibo', substr(v_recibo, 1, 4) || '-' || substr(v_recibo, 5, 4) || '-' || substr(v_recibo, 9, 4));
end $$;

create or replace function public.hof_relatorio_individual(p_codigo text, p_recibo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r hofstede.respostas;
  p hofstede.pesquisas;
begin
  select * into p from hofstede.pesquisas where codigo = lower(trim(p_codigo));
  if not found then raise exception 'recibo_invalido'; end if;
  select * into r from hofstede.respostas
   where pesquisa_id = p.id and recibo_hash = hofstede.sha(upper(regexp_replace(coalesce(p_recibo, ''), '[^A-Za-z0-9]', '', 'g')));
  if not found then raise exception 'recibo_invalido'; end if;

  return jsonb_build_object(
    'pesquisa', jsonb_build_object('titulo', p.titulo, 'empresa_nome', p.empresa_nome, 'fim', p.fim,
                                   'status', hofstede.status_pesquisa(p.inicio, p.fim),
                                   'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria),
    'departamento', (select nome from hofstede.departamentos where id = r.departamento_id),
    'meu', (select jsonb_agg(jsonb_build_object('dimensao', e.dimensao, 'hoje', round(e.hoje, 2),
                                                'deveria', round(e.deveria, 2), 'gap', round(e.deveria - e.hoje, 2)))
              from hofstede.escores e where e.resposta_id = r.id),
    'departamento_media', hofstede.estatisticas(p.id, r.departamento_id),
    'empresa_media', hofstede.estatisticas(p.id, null)
  );
end $$;
