import { DIMENSOES, CRUZAMENTOS, TEXTO_CONSENSO, TEXTO_GAP } from "../../lib/metodologia";

export default function Metodologia() {
  return (
    <>
      <h1>Metodologia</h1>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Natureza do instrumento</h2>
        <p>Adaptação do framework de dimensões culturais de Geert Hofstede para diagnóstico de <strong>cultura organizacional percebida</strong>.
          Não é um teste psicométrico validado para indivíduos: os resultados são descritivos e orientados à priorização, não à classificação de pessoas.
          Nunca use os resultados para avaliar desempenho, carreira, bônus ou promoção.</p>
        <h3>Cálculo</h3>
        <ol>
          <li>36 afirmações, 6 por dimensão, respondidas em duas colunas: <strong>É HOJE</strong> (cultura percebida) e <strong>DEVERIA SER</strong> (cultura desejada), escala 1–5.</li>
          <li>Itens de redação invertida são recodificados (nota = 6 − nota original) nas duas colunas. Itens invertidos: 2, 5, 6, 8, 10, 12, 14, 17, 20, 23, 24, 26, 30, 32, 34 e 36.</li>
          <li>Escore de cada respondente por dimensão = média dos 6 itens. Escore do grupo = média dos escores; consenso = desvio-padrão amostral.</li>
          <li>Gap = Deveria ser − É hoje. Gap positivo: deseja-se mais da dimensão; negativo: menos.</li>
        </ol>
        <p className="small muted">Observação: a nota metodológica do questionário lista 13 itens invertidos, sem os itens 20, 23 e 24. Esses três afirmam o polo baixo de Aversão à Incerteza, e o Guia de Resposta (Exemplo 5) trata o item 20 como invertido; por isso o sistema os recodifica.</p>
        <h3>Faixas de leitura</h3>
        <ul>
          <li>{TEXTO_CONSENSO.alto}</li><li>{TEXTO_CONSENSO.medio}</li><li>{TEXTO_CONSENSO.baixo}</li>
          <li>{TEXTO_GAP.alinhado}</li><li>{TEXTO_GAP.medio}</li><li>{TEXTO_GAP.alto}</li>
        </ul>
        <h3>Os 5 erros que invalidam um diagnóstico</h3>
        <ol>
          <li>Interpretar dimensão isolada — sempre cruze dimensões.</li>
          <li>Não recodificar itens invertidos.</li>
          <li>Tratar poucos respondentes como amostra estatística.</li>
          <li>Ignorar a dispersão e olhar só a média.</li>
          <li>Usar o resultado para avaliar pessoas.</li>
        </ol>
        <h3>Devolutiva sem defensividade</h3>
        <ul>
          <li>Apresente sempre o agregado antes de qualquer recorte.</li>
          <li>Nomeie o gap como oportunidade (energia de mudança legitimada), não como falha.</li>
          <li>Use as perguntas de aprofundamento para validar o número com evidência concreta.</li>
          <li>Feche cada dimensão com uma decisão: ação, dono, prazo ou pergunta aberta.</li>
        </ul>
      </div>
      <div className="card tabela-wrap">
        <h2 style={{ marginTop: 0 }}>As 6 dimensões</h2>
        <table><thead><tr><th>Dimensão</th><th>O que mede</th><th>Polo alto</th><th>Polo baixo</th><th>Sinal de alerta</th></tr></thead>
          <tbody>{DIMENSOES.map((d) => <tr key={d.codigo}><td><strong>{d.nome}</strong></td><td className="small">{d.mede}</td><td className="small">{d.poloAlto}</td><td className="small">{d.poloBaixo}</td><td className="small">{d.alerta}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cruzamentos</h2>
        <ul>{CRUZAMENTOS.map((c) => <li key={c.id}><strong>{c.titulo}</strong> — {c.revela}</li>)}
          <li><strong>Risco do discurso duplo</strong> — gap alto em qualquer dimensão com consenso baixo: o que se declara e o que se pratica divergem.</li>
          <li><strong>Percepção dividida</strong> — 3 ou mais dimensões com DP acima de 1,2: o grupo não compartilha um modelo mental da empresa; a intervenção é o alinhamento.</li>
        </ul>
      </div>
    </>
  );
}
