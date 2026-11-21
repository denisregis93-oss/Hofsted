-- Teste do público por lista de e-mails. Desfaz tudo no final. Requer ao menos 3 funcionários ativos.
-- Resultado esperado: "RESULTADO: OK".
do $$
declare
  admin_email text := (select email from hofstede.admins limit 1);
  e1 text; e2 text; e3 text;
  pid uuid; cod text; r jsonb; v jsonb; itens jsonb; falhas text[] := '{}';
begin
  select (array_agg(email order by email))[1], (array_agg(email order by email))[2], (array_agg(email order by email))[3]
    into e1, e2, e3 from hofstede.funcionarios where ativo;
  perform set_config('request.jwt.claims', json_build_object('email', admin_email, 'role', 'authenticated')::text, true);

  pid := public.hof_salvar_pesquisa(jsonb_build_object('titulo','L','empresa_nome','X','inicio',now()-interval '1 day','fim',now()+interval '1 day',
    'responsavel_nome','RH','responsavel_email','rh@teste.invalid','publico','lista'));
  select codigo into cod from hofstede.pesquisas where id = pid;
  if exists (select 1 from hofstede.pesquisa_elegiveis where pesquisa_id = pid) then falhas := falhas || 'lista começou preenchida'; end if;

  r := public.hof_adicionar_participantes(pid, jsonb_build_array(
         jsonb_build_object('email', upper(e1)), jsonb_build_object('email', e2), jsonb_build_object('email', e1),
         jsonb_build_object('email', 'desconhecido@teste.invalid'), jsonb_build_object('email', 'invalido'),
         jsonb_build_object('email', 'novo.cadastro@teste.invalid', 'nome', 'Novo Cadastro', 'departamento', 'Dep Lista Teste')));
  if (r->>'incluidos')::int <> 3 or (r->>'cadastrados')::int <> 1 or jsonb_array_length(r->'erros') <> 2 then falhas := falhas || ('adicionar ' || r::text); end if;

  if public.hof_verificar_acesso(cod, e3)->>'situacao' <> 'nao_elegivel' then falhas := falhas || 'fora da lista acessou'; end if;
  if public.hof_verificar_acesso(cod, e1)->>'situacao' <> 'pode_responder' then falhas := falhas || 'da lista sem acesso'; end if;

  v := public.hof_iniciar(cod, e1);
  select jsonb_agg(jsonb_build_object('item', numero, 'hoje', 3, 'deveria', 4)) into itens from hofstede.itens;
  perform public.hof_enviar_respostas(v->>'token', itens, null, null);
  begin perform public.hof_remover_participante(pid, e1); falhas := falhas || 'removeu quem respondeu';
  exception when others then null; end;
  perform public.hof_remover_participante(pid, e2);
  if (select count(*) from hofstede.pesquisa_elegiveis where pesquisa_id = pid) <> 2 then falhas := falhas || 'remocao'; end if;

  raise exception 'RESULTADO: %', case when cardinality(falhas) = 0 then 'OK' else array_to_string(falhas, '; ') end;
end $$;
