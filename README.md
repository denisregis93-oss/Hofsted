# Diagnóstico de Cultura Organizacional — modelo Hofstede

Aplicação para pesquisa de **cultura organizacional percebida** entre funcionários, baseada na adaptação do modelo de Geert Hofstede (36 afirmações, 6 dimensões, colunas **É HOJE** e **DEVERIA SER**).

## Funcionalidades

**Funcionário (link `#/p/<código>`)**
- Informa o e-mail → recebe um **código de 6 dígitos por e-mail** → responde o questionário.
- Só funcionários cadastrados e incluídos no público da pesquisa podem responder; **uma resposta por pesquisa**.
- Fora do prazo: antes do início informa a data de abertura; depois do fim informa se a pessoa **respondeu** ou **deixou de responder** e, nesse caso, recomenda **justificar ao responsável** (com link de e-mail).
- Ao concluir, recebe um **código pessoal** (XXXX-XXXX-XXXX), a única chave para o **relatório individual** (`#/p/<código>/meu-relatorio`).

**RH (`#/admin`)**
- Importação de funcionários por planilha (.xlsx/.xls/.csv: Nome, E-mail, Departamento), com prévia, validação e opção de inativar ausentes.
- Criação de quantas pesquisas quiser, com período (início/fim), responsável, nome da empresa e **colunas do questionário**: É HOJE, DEVERIA SER ou as duas. Com uma só coluna não há gap; os relatórios mostram apenas o que foi coletado. As colunas ficam travadas quando a pesquisa recebe a primeira resposta. O público é congelado na criação (com opção de incluir novos funcionários depois).
- Acompanhamento de adesão por departamento e lista de pendentes.
- Resultados da **empresa** e por **departamento**: médias, desvio-padrão (consenso), gap, leitura de cada dimensão, 6 cruzamentos em quadrantes (hoje × desejado), alertas de **discurso duplo** e **percepção dividida**, detalhe por item.
- Comparação entre departamentos, **evolução entre pesquisas**, respostas abertas (ordem aleatória), controle de qualidade (resposta reta, alternada, polarizada, contradições) com exclusão justificada.
- Exportação em Excel (resultado e base anônima) e impressão/PDF.

## Anonimato (opção "1a")

- As respostas ficam numa tabela **sem vínculo** com o funcionário e **sem data/hora**. A participação fica registrada à parte (somente a data), para garantir uma resposta por pessoa.
- O relatório individual só abre com o código pessoal, que é guardado apenas como hash: nem o RH consegue ligar uma resposta a uma pessoa.
- Respostas abertas são listadas em ordem aleatória, sem associar a 1ª e a 2ª pergunta da mesma pessoa.
- Limite conhecido: não há número mínimo de respondentes por recorte (decisão do projeto). Departamentos muito pequenos exibem um aviso, mas os números aparecem. Um administrador do banco com acesso de superusuário poderia, em tese, correlacionar registros por metadados internos do Postgres; pela aplicação isso não é possível.

## Metodologia de cálculo

1. Recodificação dos itens invertidos: `nota = 6 − nota original`, nas duas colunas.
2. Escore do respondente por dimensão = média dos 6 itens; escore do grupo = média; consenso = desvio-padrão amostral.
3. Gap = Deveria ser − É hoje.
4. Faixas de leitura: DP < 0,8 consenso alto · 0,8–1,2 médio · > 1,2 baixo. |Gap| ≤ 0,4 alinhado · 0,4–0,8 médio · > 0,8 alto.
5. Quadrantes dos cruzamentos pelo ponto médio 3.

> **Atenção — itens invertidos.** A Nota Metodológica do questionário lista 13 itens invertidos (2, 5, 6, 8, 10, 12, 14, 17, 26, 30, 32, 34, 36). Os itens **20, 23 e 24** (Aversão à Incerteza) afirmam o polo baixo da dimensão, e o Guia de Resposta (Exemplo 5) classifica o item 20 como invertido. O sistema os trata como **invertidos (16 no total)**. Para seguir a lista literal:
> ```sql
> update hofstede.itens set invertido = false where numero in (20, 23, 24);
> ```
> A mudança vale retroativamente, porque a recodificação é feita no momento do cálculo.

## Arquitetura

- **Front-end:** React + Vite + TypeScript (SPA estática com rotas `#/`, que pode ser hospedada em qualquer servidor estático).
- **Back-end:** Supabase (projeto **Tarefas**).
  - Tabelas no esquema privado `hofstede`, que **não é exposto** pela API.
  - Acesso somente via funções `public.hof_*` (`SECURITY DEFINER`). As funções de RH exigem login de um e-mail cadastrado em `hofstede.admins`.
  - Os funcionários **não** viram usuários do Supabase Auth: o acesso é por código de uso único com sessão própria de 3 horas. Isso evita que ganhem acesso autenticado às outras aplicações do mesmo projeto.
  - Edge Function `hof-enviar-codigo`: gera o código (RPC restrita ao `service_role`) e envia o e-mail via Resend.
- Migrações em `supabase/migrations/` (já aplicadas no projeto Tarefas).

## Configuração (uma vez)

1. **E-mail (obrigatório para os funcionários receberem o código).** Crie uma conta em [resend.com](https://resend.com), verifique o domínio da empresa e cadastre no Supabase (*Edge Functions → Secrets*):
   - `RESEND_API_KEY` = chave da API;
   - `EMAIL_REMETENTE` = `Pesquisa de Cultura <pesquisa@suaempresa.com.br>`.
2. **Administradores.** Já existe o administrador `denisregis93@gmail.com`, que entra com a mesma senha da conta Supabase Auth do projeto. Para incluir outro administrador, crie o usuário em *Authentication → Users* e rode:
   ```sql
   insert into hofstede.admins (email) values ('pessoa@empresa.com.br');
   ```
3. **Publicação do site.** Rode `npm install`, depois `npm run build`, e publique a pasta `dist/` (Netlify, Vercel, Cloudflare Pages, GitHub Pages…). As variáveis ficam em `.env`. A chave publicável é pública por natureza.
4. Em *Authentication → URL Configuration*, adicione a URL do site, para o link de "esqueci a senha" do RH funcionar.

## Desenvolvimento

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

O último comando roda os testes das regras de leitura da metodologia.

## Testes

- `npm test`: regras de leitura da metodologia (faixas de consenso e gap, quadrantes, alertas).
- `supabase/tests/teste_fluxo.sql`: fluxo completo no banco (importação, código de acesso, envio, resposta única, recodificação, alertas de qualidade, relatório individual, exclusão, permissões e situações de prazo). Cole no SQL Editor do Supabase e execute. Tudo é desfeito no final, e a mensagem esperada é `RESULTADO: TODOS OS TESTES PASSARAM`.
- `supabase/tests/teste_colunas.sql`: pesquisas só com É HOJE e só com DEVERIA SER (validação do envio, relatórios, alertas e trava das colunas).
- `supabase/tests/limpar_dados_teste.sql`: remove pesquisas "TESTE ..." e funcionários `@teste.invalid` criados em testes manuais.
