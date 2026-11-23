import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { mensagemErro, participante, type RelatorioIndividual } from "../../lib/api";
import { DIM, descreverNivel, direcaoGap, fmt, fmtGap, type CodigoDimensao } from "../../lib/metodologia";
import { GraficoDimensoes } from "../../components/Resultados";
import { LogoCliente, Marca } from "../../components/Marca";

export default function MeuRelatorio() {
  const { codigo = "" } = useParams();
  const [sp] = useSearchParams();
  const [recibo, setRecibo] = useState(sp.get("r") ?? "");
  const [rel, setRel] = useState<RelatorioIndividual | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregar(r = recibo) {
    setErro(""); setOcupado(true);
    try { setRel(await participante.relatorio(codigo, r)); }
    catch (e) { setErro(mensagemErro(e)); setRel(null); }
    finally { setOcupado(false); }
  }
  useEffect(() => { if (sp.get("r")) carregar(sp.get("r")!); /* eslint-disable-line */ }, []);

  if (!rel) return (
    <div className="container narrow">
      <h1>Meu relatório individual</h1>
      <form className="card" onSubmit={(e) => { e.preventDefault(); carregar(); }}>
        <p>Informe o código pessoal que você recebeu ao concluir o questionário (formato XXXX-XXXX-XXXX).</p>
        <label htmlFor="rec">Código pessoal</label>
        <input id="rec" value={recibo} onChange={(e) => setRecibo(e.target.value.toUpperCase())} autoComplete="off" required />
        {erro && <div className="aviso erro">{erro}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button disabled={ocupado}>{ocupado ? "Buscando…" : "Ver relatório"}</button>
          <Link to={`/p/${codigo}`} className="small">Voltar à pesquisa</Link>
        </div>
      </form>
    </div>
  );

  const ordem: CodigoDimensao[] = ["PDI", "IDV", "MAS", "UAI", "LTO", "IVR"];
  const meu = Object.fromEntries(rel.meu.map((m) => [m.dimensao, m]));
  const emp = Object.fromEntries(rel.empresa_media.map((m) => [m.dimensao, m]));
  const dep = Object.fromEntries(rel.departamento_media.map((m) => [m.dimensao, m]));
  const nEmp = rel.empresa_media[0]?.n ?? 0;
  const nDep = rel.departamento_media[0]?.n ?? 0;
  const ch = rel.pesquisa.coletar_hoje !== false, cd = rel.pesquisa.coletar_deveria !== false, ambos = ch && cd;
  const base = ch ? "hoje" : "deveria";
  const media = (m: { media_hoje: number | null; media_deveria: number | null } | undefined) => (m ? (ch ? m.media_hoje : m.media_deveria) : null);

  return (
    <div className="container">
      <div className="cabecalho-impressao">
        <Marca progresso={1} />
        <LogoCliente src={rel.pesquisa.cliente_logo} nome={rel.pesquisa.empresa_nome} />
      </div>
      <div className="muted small">{rel.pesquisa.empresa_nome} · {rel.pesquisa.titulo}</div>
      <h1>Seu retrato de percepção cultural</h1>
      <div className="aviso info">
        Este relatório mostra <strong>a sua percepção</strong> sobre a cultura da empresa, comparada com a média do grupo.
        Ele <strong>não é um teste de personalidade nem uma avaliação</strong>: o modelo de Hofstede foi desenhado para descrever grupos,
        não para rotular pessoas. Use-o como reflexão pessoal.
        {rel.pesquisa.status !== "encerrada" && " As médias do grupo ainda podem mudar até o fim da pesquisa."}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{ch ? "Como você vê a empresa" : "Como você gostaria que a empresa fosse"}</h2>
        <GraficoDimensoes dims={ordem.map((d) => ({ dimensao: d, hoje: meu[d]?.hoje ?? null, deveria: meu[d]?.deveria ?? null }))} />
        <p className="small muted">Escala de 1 a 5, após o tratamento metodológico das respostas. Nota alta indica maior presença da dimensão nomeada.</p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Comparação com o grupo</h2>
        <div className="tabela-wrap">
          <table>
            <thead><tr>
              <th>Dimensão</th>
              {ch && <th className="num">Você — hoje</th>}{cd && <th className="num">Você — deveria</th>}{ambos && <th className="num">Seu gap</th>}
              <th className="num">{rel.departamento} — {base} ({nDep})</th><th className="num">Empresa — {base} ({nEmp})</th>
              {ambos && <th className="num">Empresa — gap</th>}
            </tr></thead>
            <tbody>
              {ordem.map((d) => (
                <tr key={d}>
                  <td>{DIM[d].nome}</td>
                  {ch && <td className="num">{fmt(meu[d]?.hoje)}</td>}{cd && <td className="num">{fmt(meu[d]?.deveria)}</td>}
                  {ambos && <td className="num"><strong>{fmtGap(meu[d]?.gap)}</strong></td>}
                  <td className="num">{fmt(media(dep[d]))}</td><td className="num">{fmt(media(emp[d]))}</td>
                  {ambos && <td className="num">{fmtGap(emp[d]?.gap)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid c2">
        {ordem.map((d) => {
          const m = meu[d];
          if (!m) return null;
          const meuValor = ch ? m.hoje : m.deveria;
          const empValor = media(emp[d]);
          const dif = meuValor != null && empValor != null ? meuValor - Number(empValor) : null;
          return (
            <div className="card" key={d} style={{ marginBottom: 0 }}>
              <h3 style={{ marginTop: 0 }}>{DIM[d].nome}</h3>
              <p className="small muted">{DIM[d].mede}</p>
              <p>{ch ? "Você percebe esta dimensão hoje como" : "Você gostaria que esta dimensão fosse"} <strong>{descreverNivel(meuValor).toLowerCase()}</strong> ({fmt(meuValor)}).
                {dif !== null && Math.abs(dif) >= 0.5 && <> {ch ? "Sua percepção" : "Sua preferência"} está {dif > 0 ? "acima" : "abaixo"} da média da empresa ({fmt(empValor)}).</>}
                {dif !== null && Math.abs(dif) < 0.5 && <> {ch ? "Sua percepção" : "Sua preferência"} está próxima da média da empresa.</>}
              </p>
              {ambos && <p className="small"><strong>O que você deseja:</strong> {direcaoGap(m.gap, DIM[d])}</p>}
              <p className="small muted">Polo alto: {DIM[d].poloAlto}<br />Polo baixo: {DIM[d].poloBaixo}</p>
            </div>
          );
        })}
      </div>
      <p className="nao-imprimir" style={{ marginTop: 16 }}><button className="sec" onClick={() => window.print()}>Imprimir / salvar em PDF</button></p>
    </div>
  );
}
