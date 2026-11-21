import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CRUZAMENTOS, DIM, chaveQuadrante, classificarConsenso, classificarGap, descreverNivel, direcaoGap, fmt, fmtGap, principal,
  ROTULO_CONSENSO, ROTULO_GAP, TEXTO_CONSENSO, TEXTO_GAP, variante, type EstatDimensao, type CodigoDimensao,
} from "../lib/metodologia";

const COR_HOJE = "var(--hoje)";
const COR_DEV = "var(--deveria)";

type Ponto = { dimensao: CodigoDimensao; hoje: number | null; deveria: number | null };

export function GraficoDimensoes({ dims }: { dims: Ponto[] }) {
  const temHoje = dims.some((d) => d.hoje !== null && d.hoje !== undefined);
  const temDev = dims.some((d) => d.deveria !== null && d.deveria !== undefined);
  const dados = dims.map((d) => ({ nome: DIM[d.dimensao].curto, "É hoje": d.hoje, "Deveria ser": d.deveria }));
  const desc = dims.map((d) => `${DIM[d.dimensao].nome}${temHoje ? ` hoje ${fmt(d.hoje)}` : ""}${temDev ? ` deveria ${fmt(d.deveria)}` : ""}`).join("; ");
  return (
    <div style={{ width: "100%", height: 300 }} role="img" aria-label={"Gráfico: " + desc}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: "var(--muted)", fontSize: 12 }} interval={0} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <ReferenceLine y={3} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
          <Legend />
          {temHoje && <Bar dataKey="É hoje" fill={COR_HOJE} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
          {temDev && <Bar dataKey="Deveria ser" fill={COR_DEV} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeloConsenso({ dp }: { dp: number | null }) {
  const c = classificarConsenso(dp);
  return <span className={`selo ${c}`} title={TEXTO_CONSENSO[c]}>{ROTULO_CONSENSO[c]}</span>;
}
export function SeloGap({ gap }: { gap: number | null }) {
  if (gap === null || gap === undefined) return null;
  const g = classificarGap(gap);
  return <span className={`selo ${g === "alto" ? "gap-alto" : g}`} title={TEXTO_GAP[g]}>{ROTULO_GAP[g]}</span>;
}

function colunas(dims: EstatDimensao[]) {
  return {
    hoje: dims.some((d) => d.media_hoje !== null && d.media_hoje !== undefined),
    dev: dims.some((d) => d.media_deveria !== null && d.media_deveria !== undefined),
  };
}

export function TabelaDimensoes({ dims }: { dims: EstatDimensao[] }) {
  const c = colunas(dims);
  const ambos = c.hoje && c.dev;
  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>Dimensão</th><th className="num">n</th>
            {c.hoje && <><th className="num">É hoje</th><th className="num">DP</th></>}
            {c.dev && <><th className="num">Deveria ser</th><th className="num">DP</th></>}
            {ambos && <th className="num">Gap</th>}
            <th>Consenso{ambos ? " (hoje)" : ""}</th>
            {ambos && <th>Alinhamento</th>}
          </tr>
        </thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d.dimensao}>
              <td>{d.nome}</td><td className="num">{d.n}</td>
              {c.hoje && <><td className="num">{fmt(d.media_hoje)}</td><td className="num">{fmt(d.dp_hoje)}</td></>}
              {c.dev && <><td className="num">{fmt(d.media_deveria)}</td><td className="num">{fmt(d.dp_deveria)}</td></>}
              {ambos && <td className="num"><strong>{fmtGap(d.gap)}</strong></td>}
              <td><SeloConsenso dp={principal(d).dp} /></td>
              {ambos && <td><SeloGap gap={d.gap} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeituraDimensoes({ dims }: { dims: EstatDimensao[] }) {
  const c = colunas(dims);
  return (
    <div className="grid c2">
      {dims.map((d) => {
        const info = DIM[d.dimensao];
        const pr = principal(d);
        const v = variante(info, pr.media, pr.dp);
        return (
          <div className="card" key={d.dimensao} style={{ marginBottom: 0 }}>
            <h3 style={{ marginTop: 0 }}>{info.nome}</h3>
            <p className="small muted">{info.mede}</p>
            <p>
              {c.hoje && <><strong>É hoje:</strong> {fmt(d.media_hoje)} ({descreverNivel(d.media_hoje)})</>}
              {c.hoje && c.dev && " · "}
              {c.dev && <><strong>Deveria ser:</strong> {fmt(d.media_deveria)}{!c.hoje && ` (${descreverNivel(d.media_deveria)})`}</>}
              {c.hoje && c.dev && <> · <strong>Gap:</strong> {fmtGap(d.gap)}</>}
            </p>
            <p className="row"><SeloConsenso dp={pr.dp} /><SeloGap gap={d.gap} /></p>
            {v && <p><strong>Leitura{pr.eixo === "deveria" ? " (cultura desejada)" : ""}:</strong> {v}</p>}
            {c.hoje && c.dev && <p className="small"><strong>Direção desejada:</strong> {direcaoGap(d.gap, info)}</p>}
            <details className="small">
              <summary>Polos, erros de leitura e perguntas de aprofundamento</summary>
              <p><strong>Polo alto:</strong> {info.poloAlto}</p>
              <p><strong>Polo baixo:</strong> {info.poloBaixo}</p>
              <p><strong>Sinal de alerta:</strong> {info.alerta}</p>
              <ul>{info.errosLeitura.map((e) => <li key={e}>{e}</li>)}</ul>
              <p><strong>Perguntas para a devolutiva:</strong></p>
              <ul>{info.perguntas.map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          </div>
        );
      })}
    </div>
  );
}

export function Cruzamentos({ dims }: { dims: EstatDimensao[] }) {
  const por = Object.fromEntries(dims.map((d) => [d.dimensao, d])) as Record<CodigoDimensao, EstatDimensao>;
  const c = colunas(dims);
  return (
    <>
      <div className="legenda">
        {c.hoje && <span><i style={{ border: "2px solid var(--hoje)" }} />É hoje</span>}
        {c.dev && <span><i style={{ border: "2px dashed var(--deveria)" }} />Deveria ser</span>}
      </div>
      <div className="grid c2" style={{ marginTop: 12 }}>
        {CRUZAMENTOS.map((cz) => {
          const x = por[cz.eixoX], y = por[cz.eixoY];
          const kh = chaveQuadrante(x?.media_hoje ?? null, y?.media_hoje ?? null);
          const kd = chaveQuadrante(x?.media_deveria ?? null, y?.media_deveria ?? null);
          const ordem: ("AA" | "AB" | "BA" | "BB")[] = ["AA", "AB", "BA", "BB"];
          return (
            <div className="card" key={cz.id} style={{ marginBottom: 0 }}>
              <h3 style={{ marginTop: 0 }}>{cz.id}. {cz.titulo}</h3>
              <p className="small muted">{DIM[cz.eixoX].nome} × {DIM[cz.eixoY].nome} — {cz.revela}</p>
              <div className="quad">
                {ordem.map((k) => (
                  <div key={k} className={`${kh === k ? "hoje-aqui" : ""} ${kd === k ? "dev-aqui" : ""}`}>
                    <strong>{cz.quadrantes[k].nome}</strong>
                    <div className="muted" style={{ fontSize: ".75rem" }}>
                      {DIM[cz.eixoX].curto} {k[0] === "A" ? "alto" : "baixo"} · {DIM[cz.eixoY].curto} {k[1] === "A" ? "alto" : "baixo"}
                    </div>
                  </div>
                ))}
              </div>
              <p className="small" style={{ marginTop: 10 }}>
                {kh && <><strong>Hoje — {cz.quadrantes[kh].nome}:</strong> {cz.quadrantes[kh].descricao} <em>Risco típico: {cz.quadrantes[kh].risco}</em></>}
                {kh && kd && kd !== kh && <br />}
                {kd && kd !== kh && <><strong>Desejado — {cz.quadrantes[kd].nome}:</strong> {cz.quadrantes[kd].descricao}{!kh && <em> Risco típico: {cz.quadrantes[kd].risco}</em>}</>}
                {kh && kd === kh && <><br />O cenário desejado está no mesmo quadrante.</>}
              </p>
              <p className="small muted"><strong>Pergunta de validação:</strong> {cz.pergunta}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
