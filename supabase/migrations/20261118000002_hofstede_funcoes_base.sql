-- Funções auxiliares internas (esquema hofstede, não expostas)

create or replace function hofstede.sha(t text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(t, 'sha256'), 'hex')
$$;

-- Texto aleatório criptograficamente seguro a partir de um alfabeto
create or replace function hofstede.aleatorio(n int, alfabeto text default '23456789ABCDEFGHJKLMNPQRSTUVWXYZ')
returns text language plpgsql volatile set search_path = '' as $$
declare
  b bytea := extensions.gen_random_bytes(n);
  r text := '';
  i int;
begin
  for i in 0 .. n - 1 loop
    r := r || substr(alfabeto, (get_byte(b, i) % length(alfabeto)) + 1, 1);
  end loop;
  return r;
end $$;

create or replace function hofstede.email_atual()
returns text language sql stable set search_path = '' as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

create or replace function hofstede.eh_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from hofstede.admins a where a.email = hofstede.email_atual())
$$;

create or replace function hofstede.exigir_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not hofstede.eh_admin() then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
end $$;

create or replace function hofstede.status_pesquisa(p_inicio timestamptz, p_fim timestamptz)
returns text language sql stable set search_path = '' as $$
  select case when now() < p_inicio then 'agendada'
              when now() > p_fim    then 'encerrada'
              else 'aberta' end
$$;

create or replace function hofstede.auditar(p_acao text, p_detalhe jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into hofstede.auditoria (quem, acao, detalhe) values (hofstede.email_atual(), p_acao, p_detalhe)
$$;

-- Escore de cada resposta por dimensão (média dos 6 itens, após recodificação 6 − nota)
create or replace view hofstede.escores as
select r.id as resposta_id, r.pesquisa_id, r.departamento_id, r.excluida, i.dimensao,
       avg(case when i.invertido then 6 - ri.hoje    else ri.hoje    end)::numeric as hoje,
       avg(case when i.invertido then 6 - ri.deveria else ri.deveria end)::numeric as deveria
from hofstede.respostas r
join hofstede.respostas_itens ri on ri.resposta_id = r.id
join hofstede.itens i on i.numero = ri.item
group by r.id, r.pesquisa_id, r.departamento_id, r.excluida, i.dimensao;

revoke all on hofstede.escores from public, anon, authenticated;

-- Estatísticas por dimensão de um recorte (empresa inteira ou um departamento)
create or replace function hofstede.estatisticas(p_pesquisa uuid, p_departamento uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x.ordem), '[]'::jsonb)
  from (
    select d.codigo as dimensao, d.ordem, d.nome,
           count(e.resposta_id)                         as n,
           round(avg(e.hoje), 2)                        as media_hoje,
           round(stddev_samp(e.hoje), 2)                as dp_hoje,
           round(avg(e.deveria), 2)                     as media_deveria,
           round(stddev_samp(e.deveria), 2)             as dp_deveria,
           round(avg(e.deveria - e.hoje), 2)            as gap,
           round(stddev_samp(e.deveria - e.hoje), 2)    as dp_gap
    from hofstede.dimensoes d
    left join hofstede.escores e
           on e.dimensao = d.codigo
          and e.pesquisa_id = p_pesquisa
          and not e.excluida
          and (p_departamento is null or e.departamento_id = p_departamento)
    group by d.codigo, d.ordem, d.nome
  ) x
$$;

-- Médias por item (recodificadas) — útil para achar itens com leitura ambígua
create or replace function hofstede.estatisticas_itens(p_pesquisa uuid, p_departamento uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x.numero), '[]'::jsonb)
  from (
    select i.numero, i.dimensao, i.texto,
           count(ri.resposta_id) as n,
           round(avg(case when i.invertido then 6 - ri.hoje    else ri.hoje    end), 2) as media_hoje,
           round(stddev_samp(case when i.invertido then 6 - ri.hoje else ri.hoje end), 2) as dp_hoje,
           round(avg(case when i.invertido then 6 - ri.deveria else ri.deveria end), 2) as media_deveria,
           round(stddev_samp(case when i.invertido then 6 - ri.deveria else ri.deveria end), 2) as dp_deveria
    from hofstede.itens i
    left join hofstede.respostas_itens ri on ri.item = i.numero
         and exists (select 1 from hofstede.respostas r
                     where r.id = ri.resposta_id and r.pesquisa_id = p_pesquisa and not r.excluida
                       and (p_departamento is null or r.departamento_id = p_departamento))
    group by i.numero, i.dimensao, i.texto
  ) x
$$;

-- Controle de qualidade de uma resposta (Guia de Resposta, Parte 5; Guia do Aplicador, checklist)
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
    select array_agg(case when eixo = 'hoje' then ri.hoje else ri.deveria end order by ri.item)
      into v from hofstede.respostas_itens ri where ri.resposta_id = p_resposta;

    -- resposta reta: mesma nota em todos ou quase todos (>= 34 de 36) os itens do eixo
    select max(c) into moda from (select count(*) c from unnest(v) u group by u) t;
    if moda >= 34 then
      resultado := resultado || jsonb_build_object('reta_' || eixo, true);
    end if;

    -- resposta alternada: sequência mecânica 1,2,3,4,5,1,2... (ou decrescente) em >= 80% das transições
    seq_asc := 0; seq_desc := 0;
    for i in 1 .. array_length(v, 1) - 1 loop
      if v[i + 1] = (v[i] % 5) + 1 then seq_asc := seq_asc + 1; end if;
      if v[i + 1] = ((v[i] + 3) % 5) + 1 then seq_desc := seq_desc + 1; end if;
    end loop;
    if greatest(seq_asc, seq_desc) >= 28 then
      resultado := resultado || jsonb_build_object('alternada_' || eixo, true);
    end if;

    -- resposta polarizada: apenas notas 1 e 5 no eixo
    if not exists (select 1 from unnest(v) u where u not in (1, 5)) then
      resultado := resultado || jsonb_build_object('polarizada_' || eixo, true);
    end if;
  end loop;

  -- contradição real: dois itens do MESMO sentido, na MESMA dimensão, com notas opostas (1 e 5)
  with a as (
    select i.dimensao, i.invertido, ri.item, 'hoje' as eixo, ri.hoje as nota
      from hofstede.respostas_itens ri join hofstede.itens i on i.numero = ri.item where ri.resposta_id = p_resposta
    union all
    select i.dimensao, i.invertido, ri.item, 'deveria', ri.deveria
      from hofstede.respostas_itens ri join hofstede.itens i on i.numero = ri.item where ri.resposta_id = p_resposta
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

revoke all on all functions in schema hofstede from public, anon, authenticated;
