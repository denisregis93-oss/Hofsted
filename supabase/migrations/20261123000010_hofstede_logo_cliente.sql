-- Logotipo do cliente por pesquisa (imagem pequena guardada como data URL), exibido na abertura e na impressão.

alter table hofstede.pesquisas
  add column cliente_logo text
  check (cliente_logo is null or (cliente_logo like 'data:image/%' and length(cliente_logo) <= 400000));

create or replace function public.hof_salvar_pesquisa(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_inicio timestamptz := (p ->> 'inicio')::timestamptz;
  v_fim timestamptz := (p ->> 'fim')::timestamptz;
  v_hoje boolean := coalesce((p ->> 'coletar_hoje')::boolean, true);
  v_dev boolean := coalesce((p ->> 'coletar_deveria')::boolean, true);
  v_publico text := coalesce(nullif(p ->> 'publico', ''), 'todos');
  v_logo text := nullif(p ->> 'cliente_logo', '');
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
                                    criado_por, coletar_hoje, coletar_deveria, publico, cliente_logo)
    values (v_codigo, trim(p ->> 'titulo'), nullif(trim(p ->> 'descricao'), ''), trim(p ->> 'empresa_nome'),
            v_inicio, v_fim, trim(p ->> 'responsavel_nome'), lower(trim(p ->> 'responsavel_email')),
            hofstede.email_atual(), v_hoje, v_dev, v_publico, v_logo)
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
           coletar_hoje = v_hoje, coletar_deveria = v_dev, publico = v_publico,
           cliente_logo = case when p ? 'cliente_logo' then v_logo else atual.cliente_logo end
     where id = v_id;
    perform hofstede.auditar('editar_pesquisa', jsonb_build_object('id', v_id));
  end if;
  return v_id;
end $$;

drop function public.hof_listar_pesquisas();
create function public.hof_listar_pesquisas()
returns table (id uuid, codigo text, titulo text, descricao text, empresa_nome text, inicio timestamptz, fim timestamptz,
               responsavel_nome text, responsavel_email text, status text, elegiveis bigint, respondentes bigint,
               coletar_hoje boolean, coletar_deveria boolean, publico text, cliente_logo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform hofstede.exigir_admin();
  return query
    select p.id, p.codigo, p.titulo, p.descricao, p.empresa_nome, p.inicio, p.fim, p.responsavel_nome, p.responsavel_email,
           hofstede.status_pesquisa(p.inicio, p.fim),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id),
           (select count(*) from hofstede.pesquisa_elegiveis e where e.pesquisa_id = p.id and e.respondeu_em is not null),
           p.coletar_hoje, p.coletar_deveria, p.publico, p.cliente_logo
      from hofstede.pesquisas p order by p.inicio desc;
end $$;

create or replace function public.hof_info_pesquisa(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('titulo', p.titulo, 'descricao', p.descricao, 'empresa_nome', p.empresa_nome,
                            'inicio', p.inicio, 'fim', p.fim, 'status', hofstede.status_pesquisa(p.inicio, p.fim),
                            'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email,
                            'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria,
                            'cliente_logo', p.cliente_logo)
    from hofstede.pesquisas p where p.codigo = lower(trim(p_codigo))
$$;

create or replace function public.hof_questionario(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s hofstede.sessoes := hofstede.sessao_valida(p_token);
begin
  return jsonb_build_object(
    'pesquisa', (select jsonb_build_object('titulo', p.titulo, 'empresa_nome', p.empresa_nome, 'fim', p.fim,
                                           'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email,
                                           'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria,
                                           'cliente_logo', p.cliente_logo)
                   from hofstede.pesquisas p where p.id = s.pesquisa_id),
    'partes', (select jsonb_agg(jsonb_build_object(
                 'ordem', d.ordem, 'nome', d.nome, 'descricao', d.descricao,
                 'itens', (select jsonb_agg(jsonb_build_object('numero', i.numero, 'texto', i.texto) order by i.numero)
                             from hofstede.itens i where i.dimensao = d.codigo)) order by d.ordem)
                 from hofstede.dimensoes d)
  );
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
                                   'coletar_hoje', p.coletar_hoje, 'coletar_deveria', p.coletar_deveria,
                                   'cliente_logo', p.cliente_logo),
    'departamento', (select nome from hofstede.departamentos where id = r.departamento_id),
    'meu', (select jsonb_agg(jsonb_build_object('dimensao', e.dimensao, 'hoje', round(e.hoje, 2),
                                                'deveria', round(e.deveria, 2), 'gap', round(e.deveria - e.hoje, 2)))
              from hofstede.escores e where e.resposta_id = r.id),
    'departamento_media', hofstede.estatisticas(p.id, r.departamento_id),
    'empresa_media', hofstede.estatisticas(p.id, null)
  );
end $$;

revoke all on function public.hof_listar_pesquisas() from public, anon;
grant execute on function public.hof_listar_pesquisas() to authenticated;
