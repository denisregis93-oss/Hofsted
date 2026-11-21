-- Teste automatizado do fluxo completo no banco. Roda dentro de uma transação e DESFAZ tudo no final.
-- Uso: cole no SQL Editor do Supabase e execute. O resultado aparece como mensagem de erro "RESULTADO: ..."
-- (o erro proposital é o que desfaz as alterações). Qualquer outra mensagem indica falha.
do $$
declare
  admin_email text := (select email from hofstede.admins limit 1);
  imp jsonb; pid uuid; cod text; v jsonb; env jsonb; itens jsonb; rel jsonb; ind jsonb; fl jsonb; r uuid;
  falhas text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('email', admin_email, 'role', 'authenticated')::text, true);

  imp := public.hof_importar_funcionarios('[
    {"nome":"Teste A","email":"A@teste.invalid","departamento":"Dep Teste"},
    {"nome":"Teste B","email":"b@teste.invalid","departamento":"dep teste"},
    {"nome":"Teste C","email":"c@teste","departamento":"Dep Teste"},
    {"nome":"Teste D","email":"a@teste.invalid","departamento":"Dep Teste"}]'::jsonb, false);
  if (imp->>'inseridos')::int <> 2 or jsonb_array_length(imp->'erros') <> 2 then falhas := falhas || 'importacao'; end if;
  if (select count(*) from hofstede.departamentos where lower(nome) = 'dep teste') <> 1 then falhas := falhas || 'departamento duplicado'; end if;

  pid := public.hof_salvar_pesquisa(jsonb_build_object('titulo','Teste','empresa_nome','Teste','inicio',now()-interval '1 day',
           'fim',now()+interval '1 day','responsavel_nome','RH','responsavel_email','rh@teste.invalid'));
  select codigo into cod from hofstede.pesquisas where id = pid;

  if public.hof_verificar_acesso(cod, 'ninguem@teste.invalid')->>'situacao' <> 'nao_cadastrado' then falhas := falhas || 'nao_cadastrado'; end if;

  v := public.hof_iniciar(cod, 'a@teste.invalid');
  if v->>'situacao' <> 'ok' then falhas := falhas || 'iniciar'; end if;
  if public.hof_iniciar(cod, 'ninguem@teste.invalid') ? 'token' then falhas := falhas || 'nao cadastrado iniciou'; end if;
  if public.hof_questionario(v->>'token')::text like '%invertido%' then falhas := falhas || 'questionario expõe itens invertidos'; end if;

  -- perfil coerente: 5 nos diretos e 1 nos invertidos em É HOJE => todas as dimensões = 5 após recodificação
  select jsonb_agg(jsonb_build_object('item', numero, 'hoje', case when invertido then 1 else 5 end, 'deveria', 3)) into itens from hofstede.itens;
  env := public.hof_enviar_respostas(v->>'token', itens, 'texto 1', null);
  if public.hof_verificar_acesso(cod, 'a@teste.invalid')->>'situacao' <> 'ja_respondeu' then falhas := falhas || 'resposta unica'; end if;
  if public.hof_iniciar(cod, 'a@teste.invalid')->>'situacao' <> 'ja_respondeu' then falhas := falhas || 'reiniciou apos responder'; end if;

  rel := public.hof_relatorio(pid, null);
  if exists (select 1 from jsonb_array_elements(rel->'dimensoes') d where (d->>'media_hoje')::numeric <> 5 or (d->>'gap')::numeric <> -2)
    then falhas := falhas || 'recodificacao/gap'; end if;

  select x.flags into fl from hofstede.respostas x where pesquisa_id = pid;
  if fl ? 'contradicoes' then falhas := falhas || 'falsa contradicao'; end if;
  if not (fl ? 'reta_deveria') then falhas := falhas || 'resposta reta nao detectada'; end if;

  ind := public.hof_relatorio_individual(cod, lower(env->>'recibo'));
  if jsonb_array_length(ind->'meu') <> 6 then falhas := falhas || 'relatorio individual'; end if;

  select id into r from hofstede.respostas where pesquisa_id = pid;
  perform public.hof_definir_exclusao(r, true, 'teste');
  if (public.hof_relatorio(pid, null)->>'respondentes')::int <> 0 then falhas := falhas || 'exclusao'; end if;

  perform set_config('request.jwt.claims', '{"email":"intruso@teste.invalid","role":"authenticated"}', true);
  begin
    perform public.hof_relatorio(pid, null);
    falhas := falhas || 'nao-admin leu relatorio';
  exception when others then null;
  end;

  update hofstede.pesquisas set fim = now() - interval '1 minute', inicio = now() - interval '2 days' where id = pid;
  if public.hof_verificar_acesso(cod, 'a@teste.invalid')->>'situacao' <> 'encerrada_respondeu' then falhas := falhas || 'encerrada_respondeu'; end if;
  if public.hof_verificar_acesso(cod, 'b@teste.invalid')->>'situacao' <> 'encerrada_nao_respondeu' then falhas := falhas || 'encerrada_nao_respondeu'; end if;
  if public.hof_iniciar(cod, 'b@teste.invalid') ? 'token' then falhas := falhas || 'iniciou encerrada'; end if;
  update hofstede.pesquisas set inicio = now() + interval '1 day', fim = now() + interval '2 days' where id = pid;
  if public.hof_verificar_acesso(cod, 'b@teste.invalid')->>'situacao' <> 'nao_iniciada' then falhas := falhas || 'nao_iniciada'; end if;

  raise exception 'RESULTADO: %', case when cardinality(falhas) = 0 then 'TODOS OS TESTES PASSARAM' else 'FALHAS: ' || array_to_string(falhas, ', ') end;
end $$;
