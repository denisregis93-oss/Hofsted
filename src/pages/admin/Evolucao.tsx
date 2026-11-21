import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { admin, fmtData, mensagemErro, type Departamento } from "../../lib/api";
import { DIMENSOES, fmt, fmtGap, type EstatDimensao } from "../../lib/metodologia";

const CORES = ["#2f6fb5", "#d9822b", "#2e7d4f", "#8a4fb5", "#b54f6f", "#4f9fb5"];

export default function Evolucao() {
  const [deps, setDeps] = useState<Departamento[]>([]);
  const [dep, setDep] = useState("");
  const [eixo, setEixo] = useState<"media_hoje" | "media_deveria" | "gap">("media_hoje");
  const [dados, setDados] = useState<{ pesquisa_id: string; titulo: string; inicio: string; dimensoes: EstatDimensao[] }[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { admin.departamentos().then(setDeps).catch(() => {}); }, []);
  useEffect(() => { setDados(null); admin.evolucao(dep || null).then(setDados).catch((e) => setErro(mensagemErro(e))); }, [dep]);

  const serie = (dados ?? []).map((p) => ({
    nome: `${p.titulo} (${fmtData(p.inicio)})`,
    ...Object.fromEntries(p.dimensoes.map((d) => [d.dimensao, d[eixo] === null ? null : Number(d[eixo])])),
  }));

  return (
    <>
      <h1>Evolução entre pesquisas</h1>
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="card">
        <div className="row">
          <select value={dep} onChange={(e) => setDep(e.target.value)} style={{ maxWidth: 280 }} aria-label="Recorte">
            <option value="">Empresa inteira</option>
            {deps.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select value={eixo} onChange={(e) => setEixo(e.target.value as typeof eixo)} style={{ maxWidth: 200 }} aria-label="Indicador">
            <option value="media_hoje">É hoje</option><option value="media_deveria">Deveria ser</option><option value="gap">Gap</option>
          </select>
        </div>
        {!dados ? <p className="muted">Carregando…</p> : dados.length < 2 ? (
          <p className="muted" style={{ marginTop: 12 }}>A evolução aparece quando houver pelo menos duas pesquisas com respostas{dep ? " neste departamento" : ""}.</p>
        ) : (
          <div style={{ width: "100%", height: 340, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={serie} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nome" tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis domain={eixo === "gap" ? [-4, 4] : [1, 5]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                <Legend />
                {DIMENSOES.map((d, i) => <Line key={d.codigo} dataKey={d.codigo} name={d.curto} stroke={CORES[i]} strokeWidth={2} dot isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {dados && dados.length > 0 && (
        <div className="card tabela-wrap">
          <table>
            <thead><tr><th>Pesquisa</th><th className="num">n</th>{DIMENSOES.map((d) => <th key={d.codigo} className="num">{d.curto}</th>)}</tr></thead>
            <tbody>{dados.map((p) => (
              <tr key={p.pesquisa_id}><td>{p.titulo}<div className="small muted">{fmtData(p.inicio)}</div></td><td className="num">{p.dimensoes[0]?.n}</td>
                {p.dimensoes.map((d) => <td key={d.dimensao} className="num">{eixo === "gap" ? fmtGap(d.gap) : fmt(d[eixo])}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
