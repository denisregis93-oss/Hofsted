-- RPCs do participante. Os funcionários NÃO viram usuários do Supabase Auth:
-- o acesso é por código de uso único enviado por e-mail + sessão curta própria.

create or replace function public.hof_info_pesquisa(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('titulo', p.titulo, 'descricao', p.descricao, 'empresa_nome', p.empresa_nome,
                            'inicio', p.inicio, 'fim', p.fim, 'status', hofstede.status_pesquisa(p.inicio, p.fim),
                            'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email)
    from hofstede.pesquisas p where p.codigo = lower(trim(p_codigo))
$$;

-- Situação do e-mail diante da pesquisa (regras de prazo, cadastro e resposta única)
create or replace function hofstede.situacao(p_codigo text, p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p hofstede.pesquisas;
  f hofstede.funcionarios;
  e hofstede.pesquisa_elegiveis;
  st text;
  base jsonb;
begin
  select * into p from hofstede.pesquisas where codigo = lower(trim(p_codigo));
  if not found then return jsonb_build_object('situacao', 'pesquisa_inexistente'); end if;

  st := hofstede.status_pesquisa(p.inicio, p.fim);
  base := jsonb_build_object('inicio', p.inicio, 'fim', p.fim,
                             'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email);

  select * into f from hofstede.funcionarios where email = lower(trim(p_email));
  if not found then return base || jsonb_build_object('situacao', 'nao_cadastrado'); end if;

  select * into e from hofstede.pesquisa_elegiveis where pesquisa_id = p.id and funcionario_id = f.id;
  if not found then
    return base || jsonb_build_object('situacao', 'nao_elegivel');
  end if;

  base := base || jsonb_build_object('nome', split_part(f.nome, ' ', 1), 'respondeu_em', e.respondeu_em,
                                     'pesquisa_id', p.id, 'funcionario_id', f.id);

  if st = 'agendada' then
    return base || jsonb_build_object('situacao', 'nao_iniciada');
  elsif st = 'encerrada' then
    return base || jsonb_build_object('situacao',
      case when e.respondeu_em is not null then 'encerrada_respondeu' else 'encerrada_nao_respondeu' end);
  elsif e.respondeu_em is not null then
    return base || jsonb_build_object('situacao', 'ja_respondeu');
  elsif not f.ativo then
    return base || jsonb_build_object('situacao', 'nao_elegivel');
  end if;
  return base || jsonb_build_object('situacao', 'pode_responder');
end $$;

create or replace function public.hof_verificar_acesso(p_codigo text, p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select hofstede.situacao(p_codigo, p_email) - 'pesquisa_id' - 'funcionario_id'
$$;

-- Gera o código de 6 dígitos. Chamado SOMENTE pela Edge Function (service_role), que envia o e-mail.
create or replace function public.hof_gerar_codigo(p_codigo text, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := hofstede.situacao(p_codigo, p_email);
  v_pesquisa uuid; v_func uuid;
  v_codigo text;
  ultimos int;
  recente boolean;
begin
  if s ->> 'situacao' <> 'pode_responder' then
    return s - 'pesquisa_id' - 'funcionario_id';
  end if;
  v_pesquisa := (s ->> 'pesquisa_id')::uuid;
  v_func := (s ->> 'funcionario_id')::uuid;

  select count(*), bool_or(criado_em > now() - interval '60 seconds')
    into ultimos, recente
    from hofstede.codigos_acesso
   where pesquisa_id = v_pesquisa and funcionario_id = v_func and criado_em > now() - interval '1 hour';
  if coalesce(recente, false) then
    return jsonb_build_object('situacao', 'aguarde', 'mensagem', 'Aguarde 1 minuto para pedir um novo código.');
  end if;
  if ultimos >= 5 then
    return jsonb_build_object('situacao', 'aguarde', 'mensagem', 'Limite de códigos atingido. Tente novamente em 1 hora.');
  end if;

  -- invalida códigos anteriores
  update hofstede.codigos_acesso set usado = true
   where pesquisa_id = v_pesquisa and funcionario_id = v_func and not usado;

  v_codigo := hofstede.aleatorio(6, '0123456789');
  insert into hofstede.codigos_acesso (pesquisa_id, funcionario_id, codigo_hash, expira_em)
  values (v_pesquisa, v_func, hofstede.sha(v_codigo || ':' || v_func::text), now() + interval '15 minutes');

  return jsonb_build_object('situacao', 'codigo_gerado', 'codigo', v_codigo,
                            'nome', s ->> 'nome', 'email', lower(trim(p_email)));
end $$;

create or replace function public.hof_validar_codigo(p_codigo text, p_email text, p_codigo_acesso text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := hofstede.situacao(p_codigo, p_email);
  v_pesquisa uuid; v_func uuid;
  c hofstede.codigos_acesso;
  v_token text;
begin
  if s ->> 'situacao' <> 'pode_responder' then
    return s - 'pesquisa_id' - 'funcionario_id';
  end if;
  v_pesquisa := (s ->> 'pesquisa_id')::uuid;
  v_func := (s ->> 'funcionario_id')::uuid;

  select * into c from hofstede.codigos_acesso
   where pesquisa_id = v_pesquisa and funcionario_id = v_func and not usado and expira_em > now()
   order by criado_em desc limit 1;
  if not found then
    return jsonb_build_object('situacao', 'codigo_invalido', 'mensagem', 'Código expirado. Peça um novo código.');
  end if;

  if c.codigo_hash <> hofstede.sha(regexp_replace(coalesce(p_codigo_acesso, ''), '\D', '', 'g') || ':' || v_func::text) then
    update hofstede.codigos_acesso
       set tentativas = tentativas + 1, usado = (tentativas + 1 >= 5)
     where id = c.id;
    return jsonb_build_object('situacao', 'codigo_invalido',
      'mensagem', case when c.tentativas + 1 >= 5 then 'Muitas tentativas. Peça um novo código.'
                       else 'Código incorreto.' end);
  end if;

  update hofstede.codigos_acesso set usado = true where id = c.id;
  delete from hofstede.sessoes where expira_em < now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into hofstede.sessoes (token_hash, pesquisa_id, funcionario_id, expira_em)
  values (hofstede.sha(v_token), v_pesquisa, v_func, now() + interval '3 hours');

  return jsonb_build_object('situacao', 'ok', 'token', v_token, 'nome', s ->> 'nome');
end $$;

create or replace function hofstede.sessao_valida(p_token text)
returns hofstede.sessoes language plpgsql stable security definer set search_path = '' as $$
declare s hofstede.sessoes;
begin
  select * into s from hofstede.sessoes where token_hash = hofstede.sha(coalesce(p_token, '')) and expira_em > now();
  if not found then
    raise exception 'sessao_expirada' using errcode = '28000';
  end if;
  return s;
end $$;

-- Questionário (sem a informação de quais itens são invertidos)
create or replace function public.hof_questionario(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s hofstede.sessoes := hofstede.sessao_valida(p_token);
begin
  return jsonb_build_object(
    'pesquisa', (select jsonb_build_object('titulo', p.titulo, 'empresa_nome', p.empresa_nome, 'fim', p.fim,
                                           'responsavel_nome', p.responsavel_nome, 'responsavel_email', p.responsavel_email)
                   from hofstede.pesquisas p where p.id = s.pesquisa_id),
    'partes', (select jsonb_agg(jsonb_build_object(
                 'ordem', d.ordem, 'nome', d.nome, 'descricao', d.descricao,
                 'itens', (select jsonb_agg(jsonb_build_object('numero', i.numero, 'texto', i.texto) order by i.numero)
                             from hofstede.itens i where i.dimensao = d.codigo)) order by d.ordem)
                 from hofstede.dimensoes d)
  );
end $$;

-- Envio único. p_itens: [{"item": 1, "hoje": 3, "deveria": 4}, ...] (36 itens)
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

  -- validação: 36 itens distintos, notas 1–5 nas duas colunas
  select count(distinct (x ->> 'item')::int) into n
    from jsonb_array_elements(p_itens) x
   where (x ->> 'item')::int between 1 and 36
     and (x ->> 'hoje')::int between 1 and 5
     and (x ->> 'deveria')::int between 1 and 5;
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

-- Relatório individual: acessível somente com o código pessoal (recibo) entregue ao participante
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
                                   'status', hofstede.status_pesquisa(p.inicio, p.fim)),
    'departamento', (select nome from hofstede.departamentos where id = r.departamento_id),
    'meu', (select jsonb_agg(jsonb_build_object('dimensao', e.dimensao, 'hoje', round(e.hoje, 2),
                                                'deveria', round(e.deveria, 2), 'gap', round(e.deveria - e.hoje, 2)))
              from hofstede.escores e where e.resposta_id = r.id),
    'departamento_media', hofstede.estatisticas(p.id, r.departamento_id),
    'empresa_media', hofstede.estatisticas(p.id, null)
  );
end $$;

revoke all on function hofstede.situacao(text, text) from public, anon, authenticated;
revoke all on function hofstede.sessao_valida(text) from public, anon, authenticated;

revoke all on function public.hof_gerar_codigo(text, text) from public, anon, authenticated;
grant execute on function public.hof_gerar_codigo(text, text) to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'hof_info_pesquisa(text)',
    'hof_verificar_acesso(text, text)',
    'hof_validar_codigo(text, text, text)',
    'hof_questionario(text)',
    'hof_enviar_respostas(text, jsonb, text, text)',
    'hof_relatorio_individual(text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Primeiro administrador
insert into hofstede.admins (email) values ('denisregis93@gmail.com') on conflict do nothing;
