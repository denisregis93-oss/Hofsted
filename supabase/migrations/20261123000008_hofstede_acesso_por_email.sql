-- Acesso simplificado: a pessoa informa só o e-mail e o sistema encontra as pesquisas dela.
-- Devolve as pesquisas em que o e-mail participa (abertas, agendadas e encerradas nos últimos 90 dias),
-- cada uma com a situação calculada pelas mesmas regras de hofstede.situacao.
create or replace function public.hof_minhas_pesquisas(p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f hofstede.funcionarios;
begin
  select * into f from hofstede.funcionarios where email = lower(trim(p_email));
  if not found then
    return jsonb_build_object('cadastrado', false, 'pesquisas', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'cadastrado', true,
    'nome', split_part(f.nome, ' ', 1),
    'pesquisas', coalesce((
      select jsonb_agg(
               (hofstede.situacao(p.codigo, f.email) - 'pesquisa_id' - 'funcionario_id')
               || jsonb_build_object('codigo', p.codigo, 'titulo', p.titulo, 'empresa_nome', p.empresa_nome)
               order by (now() between p.inicio and p.fim) desc, p.fim desc)
        from hofstede.pesquisa_elegiveis e
        join hofstede.pesquisas p on p.id = e.pesquisa_id
       where e.funcionario_id = f.id
         and p.fim > now() - interval '90 days'
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.hof_minhas_pesquisas(text) from public;
grant execute on function public.hof_minhas_pesquisas(text) to anon, authenticated;
