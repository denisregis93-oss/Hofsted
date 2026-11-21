-- Remove os dados fictícios criados nos testes manuais (pesquisas "TESTE ..." e funcionários @teste.invalid).
delete from hofstede.pesquisas where titulo like 'TESTE %';
delete from hofstede.codigos_acesso where funcionario_id in (select id from hofstede.funcionarios where email like '%@teste.invalid');
delete from hofstede.sessoes where funcionario_id in (select id from hofstede.funcionarios where email like '%@teste.invalid');
delete from hofstede.pesquisa_elegiveis where funcionario_id in (select id from hofstede.funcionarios where email like '%@teste.invalid');
delete from hofstede.funcionarios where email like '%@teste.invalid';
delete from hofstede.departamentos d where not exists (select 1 from hofstede.funcionarios f where f.departamento_id = d.id)
  and not exists (select 1 from hofstede.respostas r where r.departamento_id = d.id)
  and not exists (select 1 from hofstede.pesquisa_elegiveis e where e.departamento_id = d.id);
