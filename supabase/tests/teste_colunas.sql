-- Teste das colunas configuráveis (É hoje / Deveria ser). Desfaz tudo no final.
-- Requer ao menos um funcionário ativo; usa o primeiro encontrado. Resultado esperado: "RESULTADO: OK".
do $$
declare
  admin_email text := (select email from hofstede.admins limit 1);
  func text := (select email from hofstede.funcionarios where ativo order by email limit 1);
  pid uuid; pid2 uuid; cod text; cod2 text; g jsonb; v jsonb; itens jsonb; env jsonb; rel jsonb; ind jsonb; falhas text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('email', admin_email, 'role', 'authenticated')::text, true);
  begin
    perform public.hof_salvar_pesquisa(jsonb_build_object('titulo','X','empresa_nome','X','inicio',now()-interval '1 day','fim',now()+interval '1 day',
      'responsavel_nome','RH','responsavel_email','rh@teste.invalid','coletar_hoje',false,'coletar_deveria',false));
    falhas := falhas || 'aceitou nenhuma coluna';
  exception when others then null; end;

  -- Só É HOJE
  pid := public.hof_salvar_pesquisa(jsonb_build_object('titulo','X','empresa_nome','X','inicio',now()-interval '1 day','fim',now()+interval '1 day',
    'responsavel_nome','RH','responsavel_email','rh@teste.invalid','coletar_hoje',true,'coletar_deveria',false));
  select codigo into cod from hofstede.pesquisas where id = pid;
  g := public.hof_gerar_codigo(cod, func);
  v := public.hof_validar_codigo(cod, func, g->>'codigo');
  select jsonb_agg(jsonb_build_object('item', numero, 'hoje', 4, 'deveria', 3)) into itens from hofstede.itens;
  begin perform public.hof_enviar_respostas(v->>'token', itens, null, null); falhas := falhas || 'aceitou coluna desligada';
  exception when others then null; end;
  select jsonb_agg(jsonb_build_object('item', numero, 'hoje', case when invertido then 2 else 4 end)) into itens from hofstede.itens;
  env := public.hof_enviar_respostas(v->>'token', itens, null, null);
  rel := public.hof_relatorio(pid, null);
  if (rel->'dimensoes'->0->>'media_hoje')::numeric <> 4 or rel->'dimensoes'->0->>'media_deveria' is not null or rel->'dimensoes'->0->>'gap' is not null
    then falhas := falhas || 'relatorio so hoje'; end if;
  ind := public.hof_relatorio_individual(cod, env->>'recibo');
  if ind->'meu'->0->>'deveria' is not null then falhas := falhas || 'individual so hoje'; end if;
  begin
    perform public.hof_salvar_pesquisa(jsonb_build_object('id',pid,'titulo','X','empresa_nome','X','inicio',(select inicio from hofstede.pesquisas where id=pid),
      'fim',now()+interval '1 day','responsavel_nome','RH','responsavel_email','rh@teste.invalid','coletar_hoje',true,'coletar_deveria',true));
    falhas := falhas || 'alterou colunas com respostas';
  exception when others then null; end;

  -- Só DEVERIA SER
  pid2 := public.hof_salvar_pesquisa(jsonb_build_object('titulo','Y','empresa_nome','X','inicio',now()-interval '1 day','fim',now()+interval '1 day',
    'responsavel_nome','RH','responsavel_email','rh@teste.invalid','coletar_hoje',false,'coletar_deveria',true));
  select codigo into cod2 from hofstede.pesquisas where id = pid2;
  g := public.hof_gerar_codigo(cod2, func);
  v := public.hof_validar_codigo(cod2, func, g->>'codigo');
  select jsonb_agg(jsonb_build_object('item', numero, 'deveria', 3)) into itens from hofstede.itens;
  perform public.hof_enviar_respostas(v->>'token', itens, null, null);
  rel := public.hof_relatorio(pid2, null);
  if (rel->'dimensoes'->0->>'media_deveria')::numeric <> 3 or rel->'dimensoes'->0->>'media_hoje' is not null then falhas := falhas || 'so deveria'; end if;
  if not ((select x.flags from hofstede.respostas x where x.pesquisa_id = pid2) ? 'reta_deveria') then falhas := falhas || 'reta deveria'; end if;

  raise exception 'RESULTADO: %', case when cardinality(falhas) = 0 then 'OK' else array_to_string(falhas, '; ') end;
end $$;
