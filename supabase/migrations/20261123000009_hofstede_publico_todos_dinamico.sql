-- Pesquisas com público "todos": quem for cadastrado (ou reativado) depois da criação entra automaticamente
-- enquanto a pesquisa não terminar. Pesquisas com público "lista" não mudam.

create or replace function hofstede.incluir_em_pesquisas_todos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.ativo then
    insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
    select p.id, new.id, new.departamento_id
      from hofstede.pesquisas p
     where p.publico = 'todos' and p.fim > now()
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function hofstede.incluir_em_pesquisas_todos() from public, anon, authenticated;

create trigger funcionarios_incluir_em_pesquisas_todos
after insert or update of ativo on hofstede.funcionarios
for each row execute function hofstede.incluir_em_pesquisas_todos();

-- Ajuste dos cadastros já existentes
insert into hofstede.pesquisa_elegiveis (pesquisa_id, funcionario_id, departamento_id)
select p.id, f.id, f.departamento_id
  from hofstede.pesquisas p cross join hofstede.funcionarios f
 where p.publico = 'todos' and p.fim > now() and f.ativo
on conflict do nothing;
