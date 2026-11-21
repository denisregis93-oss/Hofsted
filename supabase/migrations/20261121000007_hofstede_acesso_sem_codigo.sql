-- Acesso sem código por e-mail: o participante informa o e-mail e, se puder responder, recebe a sessão direto.
-- Decisão do projeto: sem verificação do e-mail, quem souber o e-mail de um colega pode responder por ele.

create or replace function public.hof_iniciar(p_codigo text, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s jsonb := hofstede.situacao(p_codigo, p_email);
  v_token text;
begin
  if s ->> 'situacao' <> 'pode_responder' then
    return s - 'pesquisa_id' - 'funcionario_id';
  end if;
  delete from hofstede.sessoes where expira_em < now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into hofstede.sessoes (token_hash, pesquisa_id, funcionario_id, expira_em)
  values (hofstede.sha(v_token), (s ->> 'pesquisa_id')::uuid, (s ->> 'funcionario_id')::uuid, now() + interval '3 hours');
  return jsonb_build_object('situacao', 'ok', 'token', v_token, 'nome', s ->> 'nome');
end $$;

revoke all on function public.hof_iniciar(text, text) from public;
grant execute on function public.hof_iniciar(text, text) to anon, authenticated;

-- Funções do fluxo com código, que deixam de ser usadas
drop function if exists public.hof_gerar_codigo(text, text);
drop function if exists public.hof_validar_codigo(text, text, text);
