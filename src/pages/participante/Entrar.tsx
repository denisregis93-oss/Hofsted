import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fmtData, mensagemErro, participante, type RespostaAcesso } from "../../lib/api";
import { MensagemSituacao } from "./Pesquisa";

type Item = RespostaAcesso & { codigo: string; titulo: string; empresa_nome: string };

/** Porta de entrada do funcionário: informa o e-mail; o sistema confere a lista e abre a pesquisa. */
export default function Entrar() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [opcoes, setOpcoes] = useState<Item[] | null>(null);
  const [situacao, setSituacao] = useState<Item | null>(null);
  const [semPesquisa, setSemPesquisa] = useState(false);

  function limpar() { setErro(""); setOpcoes(null); setSituacao(null); setSemPesquisa(false); }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    limpar(); setOcupado(true);
    try {
      const r = await participante.minhasPesquisas(email.trim());
      if (!r.cadastrado) { setSituacao({ situacao: "nao_cadastrado", codigo: "", titulo: "", empresa_nome: "" }); return; }
      const abertas = r.pesquisas.filter((p) => p.situacao === "pode_responder");
      if (abertas.length === 1) { navigate(`/p/${abertas[0].codigo}`, { state: { email: email.trim() } }); return; }
      if (abertas.length > 1) { setOpcoes(abertas); return; }
      if (r.pesquisas.length) { setSituacao(r.pesquisas[0]); return; }
      setSemPesquisa(true);
    } catch (err) { setErro(mensagemErro(err)); }
    finally { setOcupado(false); }
  }

  return (
    <div className="container narrow">
      <h1>Pesquisa de Cultura Organizacional</h1>
      {!situacao && !opcoes && (
        <form className="card" onSubmit={entrar}>
          <p>Informe o seu e-mail corporativo para começar.</p>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          {erro && <div className="aviso erro" role="alert">{erro}</div>}
          {semPesquisa && (
            <div className="aviso info" role="status">
              Seu e-mail está cadastrado, mas não está na lista de nenhuma pesquisa aberta no momento. Confira se digitou o e-mail certo ou fale com o RH.
            </div>
          )}
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={ocupado}>{ocupado ? "Verificando…" : "Entrar"}</button>
          </div>
        </form>
      )}

      {opcoes && (
        <div className="card">
          <p>Há mais de uma pesquisa aberta para você. Escolha qual responder:</p>
          {opcoes.map((o) => (
            <div key={o.codigo} className="row" style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
              <div><strong>{o.titulo}</strong><div className="small muted">{o.empresa_nome} · até {fmtData(o.fim, true)}</div></div>
              <span className="spacer" />
              <button onClick={() => navigate(`/p/${o.codigo}`, { state: { email: email.trim() } })}>Responder</button>
            </div>
          ))}
          <button className="link" onClick={limpar}>Voltar</button>
        </div>
      )}

      {situacao && (
        <>
          {situacao.titulo && <p className="muted">{situacao.titulo}</p>}
          <MensagemSituacao a={situacao} codigo={situacao.codigo} voltar={limpar} />
        </>
      )}

      <p className="small muted" style={{ marginTop: 32 }}><Link to="/admin">Área do RH</Link></p>
    </div>
  );
}
