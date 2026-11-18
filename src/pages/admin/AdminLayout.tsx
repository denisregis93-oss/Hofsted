import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { admin, mensagemErro } from "../../lib/api";

export default function AdminLayout() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [ehAdmin, setEhAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setEhAdmin(null);
    if (sessao) admin.souAdmin().then(setEhAdmin).catch(() => setEhAdmin(false));
  }, [sessao]);

  if (sessao === undefined) return <div className="container"><p className="muted">Carregando…</p></div>;
  if (!sessao) return <Login />;
  if (ehAdmin === null) return <div className="container"><p className="muted">Verificando permissões…</p></div>;
  if (!ehAdmin) return (
    <div className="container narrow">
      <div className="aviso erro"><h2 style={{ marginTop: 0 }}>Acesso negado</h2>
        <p>A conta <strong>{sessao.user.email}</strong> não está cadastrada como administradora da pesquisa.</p>
        <button className="sec" onClick={() => supabase.auth.signOut()}>Sair</button></div>
    </div>
  );

  return (
    <>
      <header className="topbar">
        <NavLink to="/admin" end className="marca">Diagnóstico Cultural · RH</NavLink>
        <nav>
          <NavLink to="/admin" end>Pesquisas</NavLink>
          <NavLink to="/admin/funcionarios">Funcionários</NavLink>
          <NavLink to="/admin/evolucao">Evolução</NavLink>
          <NavLink to="/admin/metodologia">Metodologia</NavLink>
        </nav>
        <span className="small muted">{sessao.user.email}</span>
        <button className="sec" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main className="container"><Outlet /></main>
    </>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : mensagemErro(error));
    setOcupado(false);
  }
  async function esqueci() {
    setErro(""); setMsg("");
    if (!email) { setErro("Informe o e-mail para redefinir a senha."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] + "#/admin" });
    if (error) setErro(mensagemErro(error)); else setMsg("Se o e-mail existir, você receberá um link para redefinir a senha.");
  }

  return (
    <div className="container narrow" style={{ maxWidth: 420 }}>
      <h1>Área do RH</h1>
      <form className="card" onSubmit={entrar}>
        <label htmlFor="em">E-mail</label>
        <input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <label htmlFor="se">Senha</label>
        <input id="se" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        {erro && <div className="aviso erro">{erro}</div>}
        {msg && <div className="aviso ok">{msg}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button disabled={ocupado}>{ocupado ? "Entrando…" : "Entrar"}</button>
          <button type="button" className="link" onClick={esqueci}>Esqueci a senha</button>
        </div>
      </form>
    </div>
  );
}
