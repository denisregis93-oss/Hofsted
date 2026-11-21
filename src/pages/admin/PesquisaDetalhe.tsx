import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { admin, fmtData, mensagemErro, type Acompanhamento, type ItemQualidade, type Pesquisa, type Relatorio } from "../../lib/api";
import { DIM, ORIENTACAO_FLAGS, ROTULOS_FLAGS, alertas, classificarConsenso, fmt, fmtGap, principal, temGap, type EstatDimensao } from "../../lib/metodologia";
import { Cruzamentos, GraficoDimensoes, LeituraDimensoes, SeloConsenso, SeloGap, TabelaDimensoes } from "../../components/Resultados";
import { linkPesquisa, rotuloColunas } from "./Pesquisas";
import { EntradaParticipantes, ResultadoInclusao, incluir } from "../../components/Participantes";
import type { ResultadoParticipantes } from "../../lib/api";

type Aba = "acompanhamento" | "participantes" | "resultados" | "departamentos" | "qualidade" | "abertas";

export default function PesquisaDetalhe() {
  const { id = "" } = useParams();
  const [p, setP] = useState<Pesquisa | null>(null);
  const [aba, setAba] = useState<Aba>("acompanhamento");
  const [dep, setDep] = useState<string>("");
  const [acomp, setAcomp] = useState<Acompanhamento | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    admin.pesquisas().then((l) => setP(l.find((x) => x.id === id) ?? null)).catch((e) => setErro(mensagemErro(e)));
    admin.acompanhamento(id).then(setAcomp).catch((e) => setErro(mensagemErro(e)));
  }, [id]);

  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!p) return <p className="muted">Carregando…</p>;

  const departamentos = acomp?.departamentos ?? [];

  return (
    <>
      <p className="small nao-imprimir"><Link to="/admin">← Pesquisas</Link></p>
      <div className="row">
        <div>
          <h1>{p.titulo}</h1>
          <div className="small muted">{p.empresa_nome} · {fmtData(p.inicio, true)} a {fmtData(p.fim, true)} · {rotuloColunas(p)} · <span className={`selo ${p.status}`}>{p.status}</span></div>
        </div>
      </div>
      <div className="card nao-imprimir" style={{ marginTop: 12 }}>
        <div className="small muted">Link para enviar aos funcionários:</div>
        <div className="row"><code style={{ wordBreak: "break-all" }}>{linkPesquisa(p.codigo)}</code>
          <button className="sec" onClick={() => navigator.clipboard?.writeText(linkPesquisa(p.codigo))}>Copiar</button></div>
      </div>

      <div className="tabs" role="tablist">
        {([["acompanhamento", "Acompanhamento"], ["participantes", "Participantes"], ["resultados", "Resultados"], ["departamentos", "Comparar departamentos"], ["qualidade", "Qualidade"], ["abertas", "Respostas abertas"]] as [Aba, string][]).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? "ativo" : ""} onClick={() => setAba(k)}>{t}</button>
        ))}
      </div>

      {(aba === "resultados" || aba === "abertas") && (
        <div className="row nao-imprimir" style={{ marginBottom: 12 }}>
          <label htmlFor="dep" style={{ margin: 0 }}>Recorte:</label>
          <select id="dep" value={dep} onChange={(e) => setDep(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">Empresa inteira</option>
            {departamentos.map((d) => <option key={d.departamento_id} value={d.departamento_id}>{d.departamento}</option>)}
          </select>
        </div>
      )}

      {aba === "acompanhamento" && acomp && <AbaAcompanhamento p={p} a={acomp} recarregar={() => admin.acompanhamento(id).then(setAcomp)} />}
      {aba === "participantes" && acomp && <AbaParticipantes p={p} a={acomp} recarregar={() => {
        admin.acompanhamento(id).then(setAcomp);
        admin.pesquisas().then((l) => setP(l.find((x) => x.id === id) ?? null));
      }} />}
      {aba === "resultados" && <AbaResultados p={p} dep={dep || null} nomeDep={departamentos.find((d) => d.departamento_id === dep)?.departamento} />}
      {aba === "departamentos" && <AbaDepartamentos id={id} p={p} />}
      {aba === "qualidade" && <AbaQualidade id={id} />}
      {aba === "abertas" && <AbaAbertas id={id} dep={dep || null} />}
    </>
  );
}

function AbaAcompanhamento({ p, a, recarregar }: { p: Pesquisa; a: Acompanhamento; recarregar: () => void }) {
  const [msg, setMsg] = useState("");
  const total = a.departamentos.reduce((s, d) => s + d.elegiveis, 0);
  const resp = a.departamentos.reduce((s, d) => s + d.respondentes, 0);
  async function incluirNovos() {
    try { const n = await admin.atualizarElegiveis(p.id); setMsg(`${n} funcionário(s) incluído(s) no público da pesquisa.`); recarregar(); }
    catch (e) { setMsg(mensagemErro(e)); }
  }
  function exportarPendentes() {
    const ws = XLSX.utils.json_to_sheet(a.pendentes.map((x) => ({ Nome: x.nome, "E-mail": x.email, Departamento: x.departamento })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pendentes");
    XLSX.writeFile(wb, `pendentes_${p.codigo}.xlsx`);
  }
  return (
    <>
      <div className="grid c3">
        <div className="card"><div className="muted small">Público</div><div className="kpi">{total}</div></div>
        <div className="card"><div className="muted small">Responderam</div><div className="kpi">{resp}</div></div>
        <div className="card"><div className="muted small">Adesão</div><div className="kpi">{total ? Math.round((resp / total) * 100) : 0}%</div></div>
      </div>
      <div className="card tabela-wrap">
        <h2 style={{ marginTop: 0 }}>Adesão por departamento</h2>
        <table>
          <thead><tr><th>Departamento</th><th className="num">Público</th><th className="num">Responderam</th><th className="num">Adesão</th></tr></thead>
          <tbody>{a.departamentos.map((d) => (
            <tr key={d.departamento_id}><td>{d.departamento}</td><td className="num">{d.elegiveis}</td><td className="num">{d.respondentes}</td>
              <td className="num">{d.elegiveis ? Math.round((d.respondentes / d.elegiveis) * 100) : 0}%</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Pendentes ({a.pendentes.length})</h2><span className="spacer" />
          {p.status !== "encerrada" && p.publico !== "lista" && <button className="sec" onClick={incluirNovos}>Incluir novos funcionários</button>}
          {a.pendentes.length > 0 && <button className="sec" onClick={exportarPendentes}>Exportar lista</button>}
        </div>
        {msg && <div className="aviso info">{msg}</div>}
        <p className="small muted">Mostra apenas quem ainda não participou (controle de participação). O conteúdo das respostas nunca é ligado às pessoas.</p>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Departamento</th></tr></thead>
          <tbody>{a.pendentes.map((x) => <tr key={x.email}><td>{x.nome}</td><td>{x.email}</td><td>{x.departamento}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}

function AbaParticipantes({ p, a, recarregar }: { p: Pesquisa; a: Acompanhamento; recarregar: () => void }) {
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<ResultadoParticipantes | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const encerrada = p.status === "encerrada";

  async function adicionar() {
    setErro(""); setR(null); setOcupado(true);
    try { const res = await incluir(p.id, texto); setR(res); if (res && !res.erros.length) setTexto(""); recarregar(); }
    catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }
  async function remover(email: string, nome: string) {
    if (!confirm(`Remover ${nome} (${email}) desta pesquisa?`)) return;
    setErro("");
    try { await admin.removerParticipante(p.id, email); recarregar(); } catch (e) { setErro(mensagemErro(e)); }
  }
  function exportar() {
    const ws = XLSX.utils.json_to_sheet(a.participantes.map((x) => ({ Nome: x.nome, "E-mail": x.email, Departamento: x.departamento, Respondeu: x.respondeu ? "Sim" : "Não" })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(wb, `participantes_${p.codigo}.xlsx`);
  }
  const t = filtro.toLowerCase();
  const lista = a.participantes.filter((x) => !t || x.nome.toLowerCase().includes(t) || x.email.includes(t) || x.departamento.toLowerCase().includes(t));

  return (
    <>
      {erro && <div className="aviso erro">{erro}</div>}
      {!encerrada && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Incluir participantes</h2>
          <p className="small">Cole os e-mails (um por linha) ou importe uma planilha com a coluna E-mail. Para quem ainda não está no cadastro, informe também nome e departamento — o cadastro é criado automaticamente.</p>
          <EntradaParticipantes valor={texto} onChange={setTexto} />
          <div className="row" style={{ marginTop: 10 }}><button onClick={adicionar} disabled={ocupado || !texto.trim()}>{ocupado ? "Incluindo…" : "Incluir na pesquisa"}</button></div>
          {r && <ResultadoInclusao r={r} />}
        </div>
      )}
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Participantes ({a.participantes.length})</h2>
          <span className="small muted">{a.participantes.filter((x) => x.respondeu).length} responderam</span>
          <span className="spacer" />
          <input placeholder="Buscar" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 240 }} aria-label="Buscar participante" />
          {a.participantes.length > 0 && <button className="sec" onClick={exportar}>Exportar</button>}
        </div>
        <p className="small muted">{p.publico === "lista" ? "Público definido por lista de e-mails." : "Público: todos os funcionários ativos no momento da criação (mais os incluídos depois)."} A situação mostra apenas se a pessoa participou; o conteúdo das respostas nunca é ligado a ela.</p>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Departamento</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.email}>
                <td>{x.nome}</td><td>{x.email}</td><td>{x.departamento}</td>
                <td><span className={`selo ${x.respondeu ? "aberta" : "encerrada"}`}>{x.respondeu ? "Respondeu" : "Pendente"}</span></td>
                <td>{!x.respondeu && !encerrada && <button className="link" onClick={() => remover(x.email, x.nome)}>Remover</button>}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="muted">Nenhum participante.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

function AbaResultados({ p, dep, nomeDep }: { p: Pesquisa; dep: string | null; nomeDep?: string }) {
  const [r, setR] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { setR(null); admin.relatorio(p.id, dep).then(setR).catch((e) => setErro(mensagemErro(e))); }, [p.id, dep]);
  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!r) return <p className="muted">Calculando…</p>;
  if (!r.respondentes) return <div className="card"><p>Ainda não há respostas válidas neste recorte.</p></div>;

  const als = alertas(r.dimensoes, r.respondentes);
  function exportar() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r!.dimensoes.map((d) => ({
      Dimensão: d.nome, n: d.n, "É hoje": d.media_hoje, "DP hoje": d.dp_hoje, "Deveria ser": d.media_deveria, "DP deveria": d.dp_deveria, Gap: d.gap,
    }))), "Dimensões");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r!.itens.map((i) => ({
      Item: i.numero, Dimensão: DIM[i.dimensao].nome, Afirmação: i.texto, n: i.n, "É hoje (recod.)": i.media_hoje, "DP hoje": i.dp_hoje, "Deveria (recod.)": i.media_deveria, "DP deveria": i.dp_deveria,
    }))), "Itens");
    XLSX.writeFile(wb, `resultado_${p.codigo}${nomeDep ? "_" + nomeDep : ""}.xlsx`);
  }
  async function exportarBase() {
    const base = await admin.exportarBase(p.id);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(base), "Base anônima");
    XLSX.writeFile(wb, `base_anonima_${p.codigo}.xlsx`);
  }

  return (
    <>
      <div className="so-impressao"><h2>{nomeDep ?? "Empresa inteira"}</h2></div>
      <div className="grid c3">
        <div className="card"><div className="muted small">Respondentes válidos</div><div className="kpi">{r.respondentes}</div>
          <div className="small muted">de {r.elegiveis} no público{r.excluidas ? ` · ${r.excluidas} excluída(s)` : ""}</div></div>
        {temGap(r.dimensoes) && <div className="card"><div className="muted small">Maior gap</div>
          {(() => { const m = [...r.dimensoes].sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0))[0]; return <><div className="kpi">{fmtGap(m.gap)}</div><div className="small">{m.nome}</div></>; })()}</div>}
        <div className="card"><div className="muted small">Dimensões com consenso baixo</div>
          <div className="kpi">{r.dimensoes.filter((d) => classificarConsenso(principal(d).dp) === "baixo").length}</div><div className="small muted">DP &gt; 1,2 em {p.coletar_hoje ? "É hoje" : "Deveria ser"}</div></div>
      </div>

      {als.map((a) => <div key={a.titulo} className={`aviso ${a.tipo === "amostra" ? "info" : "warn"}`}><strong>{a.titulo}.</strong> {a.texto}</div>)}

      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Perfil cultural — {nomeDep ?? "empresa inteira"}</h2><span className="spacer" />
          <span className="nao-imprimir row">
            <button className="sec" onClick={exportar}>Exportar Excel</button>
            <button className="sec" onClick={exportarBase}>Base anônima</button>
            <button className="sec" onClick={() => window.print()}>Imprimir / PDF</button>
          </span></div>
        <GraficoDimensoes dims={r.dimensoes.map((d) => ({ dimensao: d.dimensao, hoje: d.media_hoje, deveria: d.media_deveria }))} />
        <TabelaDimensoes dims={r.dimensoes} />
        <p className="small muted">Médias após recodificação dos itens invertidos (nota alta = maior presença da dimensão).
          Consenso pelo desvio-padrão de {p.coletar_hoje ? "É hoje" : "Deveria ser"}: &lt; 0,8 alto · 0,8–1,2 médio · &gt; 1,2 baixo.
          {p.coletar_hoje && p.coletar_deveria ? " Gap = Deveria ser − É hoje: até 0,4 alinhado · 0,4–0,8 médio · acima de 0,8 alto." : " Esta pesquisa coletou só uma coluna, por isso não há gap."}</p>
      </div>

      <h2>Leitura por dimensão</h2>
      <LeituraDimensoes dims={r.dimensoes} />

      <h2>Cruzamentos entre dimensões</h2>
      <p className="small muted">Nenhuma dimensão isolada explica uma cultura: o valor analítico está na combinação. Quadrante pelo ponto médio 3 da escala.</p>
      <Cruzamentos dims={r.dimensoes} />

      <h2>Detalhe por item</h2>
      <div className="card tabela-wrap">
        <p className="small muted">Itens com DP alto em vários respondentes podem indicar redação ambígua.</p>
        <table>
          <thead><tr><th>#</th><th>Afirmação</th><th>Dimensão</th>
            {p.coletar_hoje && <><th className="num">É hoje</th><th className="num">DP</th></>}
            {p.coletar_deveria && <><th className="num">Deveria</th><th className="num">DP</th></>}</tr></thead>
          <tbody>{r.itens.map((i) => (
            <tr key={i.numero}><td>{i.numero}</td><td className="small">{i.texto}</td><td className="small">{DIM[i.dimensao].curto}</td>
              {p.coletar_hoje && <><td className="num">{fmt(i.media_hoje)}</td><td className="num">{fmt(i.dp_hoje)}</td></>}
              {p.coletar_deveria && <><td className="num">{fmt(i.media_deveria)}</td><td className="num">{fmt(i.dp_deveria)}</td></>}</tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

function AbaDepartamentos({ id, p }: { id: string; p: Pesquisa }) {
  const [dados, setDados] = useState<{ departamento: string; dimensoes: EstatDimensao[] }[] | null>(null);
  const [erro, setErro] = useState("");
  const [eixo, setEixo] = useState<"hoje" | "deveria" | "gap">(p.coletar_hoje ? "hoje" : "deveria");
  useEffect(() => { admin.compararDepartamentos(id).then(setDados).catch((e) => setErro(mensagemErro(e))); }, [id]);
  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!dados) return <p className="muted">Calculando…</p>;
  if (!dados.length) return <div className="card"><p>Ainda não há respostas.</p></div>;
  const dims = dados[0].dimensoes;
  const val = (d: EstatDimensao) => (eixo === "hoje" ? d.media_hoje : eixo === "deveria" ? d.media_deveria : d.gap);
  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Comparação entre departamentos</h2><span className="spacer" />
        <select value={eixo} onChange={(e) => setEixo(e.target.value as typeof eixo)} style={{ maxWidth: 200 }} aria-label="Indicador">
          {p.coletar_hoje && <option value="hoje">É hoje</option>}
          {p.coletar_deveria && <option value="deveria">Deveria ser</option>}
          {p.coletar_hoje && p.coletar_deveria && <option value="gap">Gap</option>}
        </select>
      </div>
      <div className="tabela-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Departamento</th><th className="num">n</th>{dims.map((d) => <th key={d.dimensao} className="num">{DIM[d.dimensao].curto}</th>)}</tr></thead>
          <tbody>{dados.map((dep) => (
            <tr key={dep.departamento}>
              <td>{dep.departamento}</td><td className="num">{dep.dimensoes[0]?.n}</td>
              {dep.dimensoes.map((d) => (
                <td key={d.dimensao} className="num" title={`DP ${fmt(eixo === "deveria" ? d.dp_deveria : d.dp_hoje)}`}>
                  {eixo === "gap" ? fmtGap(val(d)) : fmt(val(d))}
                  <div>{eixo === "gap" ? <SeloGap gap={d.gap} /> : <SeloConsenso dp={eixo === "hoje" ? d.dp_hoje : d.dp_deveria} />}</div>
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="small muted">Diferenças marcantes entre áreas na mesma dimensão explicam consenso baixo na média da empresa (Guia: “investigar por área”). Departamentos com poucos respondentes devem ser lidos com cautela.</p>
    </div>
  );
}

function AbaQualidade({ id }: { id: string }) {
  const [itens, setItens] = useState<ItemQualidade[] | null>(null);
  const [erro, setErro] = useState("");
  const carregar = () => admin.qualidade(id).then(setItens).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, [id]); // eslint-disable-line
  async function alternar(i: ItemQualidade) {
    let motivo: string | null = null;
    if (!i.excluida) { motivo = prompt(`Motivo para excluir ${i.rotulo} da análise:`); if (!motivo) return; }
    try { await admin.definirExclusao(i.resposta_id, !i.excluida, motivo); carregar(); } catch (e) { setErro(mensagemErro(e)); }
  }
  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!itens) return <p className="muted">Carregando…</p>;
  const comAlerta = itens.filter((i) => Object.keys(i.flags).length);
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Controle de qualidade das respostas</h2>
      <p className="small">{ORIENTACAO_FLAGS}</p>
      <p className="small muted">As respostas são identificadas apenas por um rótulo anônimo. {comAlerta.length} de {itens.length} com algum alerta.</p>
      <div className="tabela-wrap"><table>
        <thead><tr><th>Rótulo</th><th>Departamento</th><th>Alertas</th><th>Situação</th><th></th></tr></thead>
        <tbody>{itens.map((i) => {
          const f = Object.keys(i.flags).filter((k) => k !== "contradicoes").map((k) => ROTULOS_FLAGS[k] ?? k);
          const c = i.flags.contradicoes ?? [];
          return (
            <tr key={i.resposta_id}>
              <td><code>{i.rotulo}</code></td><td>{i.departamento}</td>
              <td className="small">{f.join(" · ")}{c.length > 0 && <div>Contradição (itens do mesmo sentido com 1 e 5): {c.map((x) => `${DIM[x.dimensao].curto} (${x.eixo === "hoje" ? "hoje" : "deveria"})`).join(", ")}</div>}
                {!f.length && !c.length && <span className="muted">—</span>}</td>
              <td>{i.excluida ? <><span className="selo baixo">Excluída</span><div className="small muted">{i.motivo_exclusao}</div></> : <span className="selo aberta">Na análise</span>}</td>
              <td><button className="link" onClick={() => alternar(i)}>{i.excluida ? "Reincluir" : "Excluir da análise"}</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </div>
  );
}

function AbaAbertas({ id, dep }: { id: string; dep: string | null }) {
  const [dados, setDados] = useState<{ pergunta: number; texto: string }[] | null>(null);
  useEffect(() => { setDados(null); admin.abertas(id, dep).then(setDados).catch(() => setDados([])); }, [id, dep]);
  if (!dados) return <p className="muted">Carregando…</p>;
  const perguntas = ["Qual é, na sua visão, o maior desalinhamento cultural da empresa hoje?", "Que mudança cultural teria o maior impacto no nosso resultado nos próximos 12 meses?"];
  return (
    <>
      {perguntas.map((t, i) => {
        const lista = dados.filter((d) => d.pergunta === i + 1);
        return (
          <div className="card" key={i}>
            <h2 style={{ marginTop: 0 }}>{i + 1}. {t}</h2>
            <p className="small muted">{lista.length} resposta(s), em ordem aleatória.</p>
            {lista.length ? <ul>{lista.map((d, j) => <li key={j} style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{d.texto}</li>)}</ul> : <p className="muted">Sem respostas.</p>}
          </div>
        );
      })}
    </>
  );
}
