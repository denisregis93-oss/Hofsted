import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin, fmtData, mensagemErro, type Pesquisa } from "../../lib/api";

export function linkPesquisa(codigo: string) {
  return `${window.location.origin}${window.location.pathname}#/p/${codigo}`;
}

/** Converte ISO para o valor de <input type="datetime-local"> no horário local. */
function paraInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const VAZIA: Partial<Pesquisa> = { titulo: "", descricao: "", empresa_nome: "", inicio: "", fim: "", responsavel_nome: "", responsavel_email: "", coletar_hoje: true, coletar_deveria: true };

export function rotuloColunas(p: { coletar_hoje: boolean; coletar_deveria: boolean }) {
  return p.coletar_hoje && p.coletar_deveria ? "É hoje + Deveria ser" : p.coletar_hoje ? "Só É hoje" : "Só Deveria ser";
}

export default function Pesquisas() {
  const [lista, setLista] = useState<Pesquisa[] | null>(null);
  const [edit, setEdit] = useState<Partial<Pesquisa> | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  const carregar = () => admin.pesquisas().then(setLista).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (!edit!.coletar_hoje && !edit!.coletar_deveria) { setErro("Selecione pelo menos uma coluna do questionário."); return; }
    try {
      const p = { ...edit, inicio: new Date(edit!.inicio!).toISOString(), fim: new Date(edit!.fim!).toISOString() };
      await admin.salvarPesquisa(p);
      setEdit(null); carregar();
    } catch (err) { setErro(mensagemErro(err)); }
  }

  async function excluir(p: Pesquisa) {
    if (!confirm(`Excluir a pesquisa "${p.titulo}"? Só é possível se ainda não houver respostas.`)) return;
    try { await admin.excluirPesquisa(p.id); carregar(); } catch (err) { setErro(mensagemErro(err)); }
  }

  function copiar(p: Pesquisa) {
    navigator.clipboard?.writeText(linkPesquisa(p.codigo));
    setCopiado(p.id); setTimeout(() => setCopiado(""), 2000);
  }

  return (
    <>
      <div className="row">
        <h1>Pesquisas</h1><span className="spacer" />
        {!edit && <button onClick={() => setEdit({ ...VAZIA, empresa_nome: lista?.[0]?.empresa_nome ?? "", responsavel_nome: lista?.[0]?.responsavel_nome ?? "", responsavel_email: lista?.[0]?.responsavel_email ?? "" })}>Nova pesquisa</button>}
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      {edit && (
        <form className="card" onSubmit={salvar}>
          <h2 style={{ marginTop: 0 }}>{edit.id ? "Editar pesquisa" : "Nova pesquisa"}</h2>
          <div className="grid c2">
            <div><label htmlFor="t">Título</label><input id="t" required value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="Ex.: Diagnóstico Cultural 2027" /></div>
            <div><label htmlFor="emp">Nome da empresa (aparece no questionário)</label><input id="emp" required value={edit.empresa_nome} onChange={(e) => setEdit({ ...edit, empresa_nome: e.target.value })} /></div>
            <div><label htmlFor="ini">Início</label><input id="ini" type="datetime-local" required value={paraInput(edit.inicio) || edit.inicio} onChange={(e) => setEdit({ ...edit, inicio: e.target.value })} /></div>
            <div><label htmlFor="fim">Fim</label><input id="fim" type="datetime-local" required value={paraInput(edit.fim) || edit.fim} onChange={(e) => setEdit({ ...edit, fim: e.target.value })} /></div>
            <div><label htmlFor="rn">Responsável pela pesquisa</label><input id="rn" required value={edit.responsavel_nome} onChange={(e) => setEdit({ ...edit, responsavel_nome: e.target.value })} /></div>
            <div><label htmlFor="re">E-mail do responsável (para justificativas)</label><input id="re" type="email" required value={edit.responsavel_email} onChange={(e) => setEdit({ ...edit, responsavel_email: e.target.value })} /></div>
          </div>
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", marginTop: 14 }}>
            <legend style={{ fontWeight: 600, fontSize: ".9rem", padding: "0 4px" }}>Colunas do questionário</legend>
            <label className="row" style={{ fontWeight: 400, margin: "6px 0" }}>
              <input type="checkbox" checked={!!edit.coletar_hoje} disabled={!!edit.id && (edit.respondentes ?? 0) > 0}
                onChange={(e) => setEdit({ ...edit, coletar_hoje: e.target.checked })} />
              <span><strong>É hoje</strong> — cultura percebida na prática</span>
            </label>
            <label className="row" style={{ fontWeight: 400, margin: "6px 0" }}>
              <input type="checkbox" checked={!!edit.coletar_deveria} disabled={!!edit.id && (edit.respondentes ?? 0) > 0}
                onChange={(e) => setEdit({ ...edit, coletar_deveria: e.target.checked })} />
              <span><strong>Deveria ser</strong> — cultura desejada</span>
            </label>
            <p className="small muted">O gap (Deveria ser − É hoje) e a comparação entre cultura atual e desejada só existem quando as duas colunas são coletadas.
              {!!edit.id && (edit.respondentes ?? 0) > 0 && " As colunas não podem ser alteradas porque a pesquisa já tem respostas."}</p>
          </fieldset>
          <label htmlFor="d">Mensagem de abertura (opcional)</label>
          <textarea id="d" value={edit.descricao ?? ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} placeholder="Texto exibido ao funcionário antes de informar o e-mail." />
          {!edit.id && <p className="small muted">Ao criar, todos os funcionários <strong>ativos</strong> passam a ser o público da pesquisa. Funcionários importados depois podem ser incluídos pelo botão "Incluir novos funcionários".</p>}
          <div className="row" style={{ marginTop: 12 }}>
            <button>Salvar</button><button type="button" className="sec" onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {lista === null ? <p className="muted">Carregando…</p> : lista.length === 0 ? (
        <div className="card"><p>Nenhuma pesquisa criada ainda.</p><p className="small muted">Comece importando os funcionários em <Link to="/admin/funcionarios">Funcionários</Link> e depois crie a pesquisa.</p></div>
      ) : (
        <div className="card tabela-wrap">
          <table>
            <thead><tr><th>Pesquisa</th><th>Período</th><th>Situação</th><th className="num">Adesão</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/admin/pesquisa/${p.id}`}><strong>{p.titulo}</strong></Link><div className="small muted">{p.empresa_nome} · {rotuloColunas(p)}</div></td>
                  <td className="small">{fmtData(p.inicio, true)}<br />a {fmtData(p.fim, true)}</td>
                  <td><span className={`selo ${p.status}`}>{p.status}</span></td>
                  <td className="num">{p.respondentes}/{p.elegiveis}<div className="small muted">{p.elegiveis ? Math.round((p.respondentes / p.elegiveis) * 100) : 0}%</div></td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="sec" onClick={() => copiar(p)}>{copiado === p.id ? "Copiado!" : "Copiar link"}</button>
                      <button className="sec" onClick={() => setEdit({ ...p })}>Editar</button>
                      {p.respondentes === 0 && <button className="perigo" onClick={() => excluir(p)}>Excluir</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
