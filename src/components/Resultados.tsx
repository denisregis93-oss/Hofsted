import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CRUZAMENTOS, DIM, chaveQuadrante, classificarConsenso, classificarGap, descreverNivel, direcaoGap, fmt, fmtGap,
  ROTULO_CONSENSO, ROTULO_GAP, TEXTO_CONSENSO, TEXTO_GAP, variante, type EstatDimensao, type CodigoDimensao,
} from "../lib/metodologia";

const COR_HOJE = "var(--hoje)";
const COR_DEV = "var(--deveria)";

export function GraficoDimensoes({ dims }: { dims: { dimensao: CodigoDimensao; hoje: number | null; deveria: number | null }[] }) {
  const dados = dims.map((d) => ({ nome: DIM[d.dimensao].curto, "É hoje": d.hoje, "Deveria ser": d.deveria }));
  return (
    <div style={{ width: "100%", height: 300 }} role="img"
      aria-label={"Gráfico: " + dims.map((d) => `${DIM[d.dimensao].nome} hoje ${fmt(d.hoje)}, deveria ${fmt(d.deveria)}`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: "var(--muted)", fontSize: 12 }} interval={0} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <ReferenceLine y={3} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
          <Legend />
          <Bar dataKey="É hoje" fill={COR_HOJE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Deveria ser" fill={COR_DEV} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
  const g = classificarGap(gap);
  return <span className={`selo ${g === "alto" ? "gap-alto" : g}`} title={TEXTO_GAP[g]}>{ROTULO_GAP[g]}</span>;
}

export function TabelaDimensoes({ dims }: { dims: EstatDimensao[] }) {
  return (
    <div className="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>Dimensão</th><th className="num">n</th>
            <th className="num">É hoje</th><th className="num">DP</th>
            <th className="num">Deveria ser</th><th className="num">DP</th>
            <th className="num">Gap</th><th>Consenso (hoje)</th><th>Alinhamento</th>
          </tr>
        </thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d.dimensao}>
              <td>{d.nome}</td><td className="num">{d.n}</td>
              <td className="num">{fmt(d.media_hoje)}</td><td className="num">{fmt(d.dp_hoje)}</td>
              <td className="num">{fmt(d.media_deveria)}</td><td className="num">{fmt(d.dp_deveria)}</td>
              <td className="num"><strong>{fmtGap(d.gap)}</strong></td>
              <td><SeloConsenso dp={d.dp_hoje} /></td>
              <td><SeloGap gap={d.gap} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeituraDimensoes({ dims }: { dims: EstatDimensao[] }) {
  return (
    <div className="grid c2">
      {dims.map((d) => {
        const info = DIM[d.dimensao];
        const v = variante(info, d.media_hoje, d.dp_hoje);
        return (
          <div className="card" key={d.dimensao} style={{ marginBottom: 0 }}>
            <h3 style={{ marginTop: 0 }}>{info.nome}</h3>
            <p className="small muted">{info.mede}</p>
            <p><strong>É hoje:</strong> {fmt(d.media_hoje)} ({descreverNivel(d.media_hoje)}) · <strong>Deveria ser:</strong> {fmt(d.media_deveria)} · <strong>Gap:</strong> {fmtGap(d.gap)}</p>
            <p className="row"><SeloConsenso dp={d.dp_hoje} /><SeloGap gap={d.gap} /></p>
            {v && <p><strong>Leitura:</strong> {v}</p>}
            <p className="small"><strong>Direção desejada:</strong> {direcaoGap(d.gap, info)}</p>
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
  return (
    <>
      <div className="legenda">
        <span><i style={{ border: "2px solid var(--hoje)" }} />É hoje</span>
        <span><i style={{ border: "2px dashed var(--deveria)" }} />Deveria ser</span>
      </div>
      <div className="grid c2" style={{ marginTop: 12 }}>
        {CRUZAMENTOS.map((c) => {
          const x = por[c.eixoX], y = por[c.eixoY];
          const kh = chaveQuadrante(x?.media_hoje ?? null, y?.media_hoje ?? null);
          const kd = chaveQuadrante(x?.media_deveria ?? null, y?.media_deveria ?? null);
          const ordem: ("AA" | "AB" | "BA" | "BB")[] = ["AA", "AB", "BA", "BB"];
          return (
            <div className="card" key={c.id} style={{ marginBottom: 0 }}>
              <h3 style={{ marginTop: 0 }}>{c.id}. {c.titulo}</h3>
              <p className="small muted">{DIM[c.eixoX].nome} × {DIM[c.eixoY].nome} — {c.revela}</p>
              <div className="quad">
                {ordem.map((k) => (
                  <div key={k} className={`${kh === k ? "hoje-aqui" : ""} ${kd === k ? "dev-aqui" : ""}`}>
                    <strong>{c.quadrantes[k].nome}</strong>
                    <div className="muted" style={{ fontSize: ".75rem" }}>
                      {DIM[c.eixoX].curto} {k[0] === "A" ? "alto" : "baixo"} · {DIM[c.eixoY].curto} {k[1] === "A" ? "alto" : "baixo"}
                    </div>
                  </div>
                ))}
              </div>
              {kh && (
                <p className="small" style={{ marginTop: 10 }}>
                  <strong>Hoje — {c.quadrantes[kh].nome}:</strong> {c.quadrantes[kh].descricao} <em>Risco típico: {c.quadrantes[kh].risco}</em>
                  {kd && kd !== kh && <><br /><strong>Desejado — {c.quadrantes[kd].nome}:</strong> {c.quadrantes[kd].descricao}</>}
                  {kd === kh && <><br />O cenário desejado está no mesmo quadrante.</>}
                </p>
              )}
              <p className="small muted"><strong>Pergunta de validação:</strong> {c.pergunta}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
