import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { admin, mensagemErro, type Funcionario, type ResultadoImportacao } from "../../lib/api";

type Linha = { nome: string; email: string; departamento: string };

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}
const ALIAS: Record<keyof Linha, string[]> = {
  nome: ["nome", "nomecompleto", "funcionario", "colaborador"],
  email: ["email", "emailcorporativo", "correioeletronico"],
  departamento: ["departamento", "depto", "setor", "area", "areadiretoria", "diretoria"],
};

export function lerPlanilha(buf: ArrayBuffer, exigir: (keyof Linha)[] = ["nome", "email", "departamento"]): { linhas: Linha[]; faltando: string[] } {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const brutas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
  if (!brutas.length) return { linhas: [], faltando: [] };
  const cabecalhos = Object.keys(brutas[0]);
  const mapa: Partial<Record<keyof Linha, string>> = {};
  for (const campo of Object.keys(ALIAS) as (keyof Linha)[]) {
    mapa[campo] = cabecalhos.find((h) => ALIAS[campo].includes(normalizar(h)));
  }
  const faltando = exigir.filter((c) => !mapa[c]);
  if (faltando.length) return { linhas: [], faltando };
  const col = (r: Record<string, unknown>, c: keyof Linha) => (mapa[c] ? String(r[mapa[c]!] ?? "").trim() : "");
  const linhas = brutas
    .map((r) => ({ nome: col(r, "nome"), email: col(r, "email"), departamento: col(r, "departamento") }))
    .filter((l) => l.nome || l.email || l.departamento);
  return { linhas, faltando };
}

function baixarModelo() {
  const ws = XLSX.utils.aoa_to_sheet([["Nome", "E-mail", "Departamento"], ["Maria da Silva", "maria.silva@empresa.com.br", "Financeiro"], ["João Souza", "joao.souza@empresa.com.br", "Comercial"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
  XLSX.writeFile(wb, "modelo_funcionarios.xlsx");
}

export default function Funcionarios() {
  const [lista, setLista] = useState<Funcionario[] | null>(null);
  const [previa, setPrevia] = useState<Linha[] | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [inativar, setInativar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState<Linha>({ nome: "", email: "", departamento: "" });
  const [msgNovo, setMsgNovo] = useState("");

  const carregar = () => admin.funcionarios().then(setLista).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, []);

  async function escolher(f: File | undefined) {
    setErro(""); setResultado(null); setPrevia(null);
    if (!f) return;
    setArquivo(f.name);
    try {
      const { linhas, faltando } = lerPlanilha(await f.arrayBuffer());
      if (faltando.length) { setErro(`Coluna(s) não encontrada(s): ${faltando.join(", ")}. A planilha precisa das colunas Nome, E-mail e Departamento.`); return; }
      if (!linhas.length) { setErro("A planilha está vazia."); return; }
      setPrevia(linhas);
    } catch (e) { setErro("Não foi possível ler o arquivo: " + mensagemErro(e)); }
  }

  async function importar() {
    if (!previa) return;
    if (inativar && !confirm("Funcionários que não estão nesta planilha serão marcados como inativos e não entrarão em novas pesquisas. Continuar?")) return;
    setOcupado(true); setErro("");
    try {
      setResultado(await admin.importar(previa, inativar));
      setPrevia(null); carregar();
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setMsgNovo("");
    try {
      const r = await admin.importar([novo], false);
      if (r.erros.length) { setErro(r.erros[0].erro); return; }
      setMsgNovo(r.inseridos ? `${novo.nome} cadastrado(a).` : `${novo.nome} já existia e foi atualizado(a).`);
      setNovo({ nome: "", email: "", departamento: novo.departamento });
      carregar();
    } catch (err) { setErro(mensagemErro(err)); }
  }

  async function alternar(f: Funcionario) {
    try { await admin.definirAtivo(f.id, !f.ativo); carregar(); } catch (e) { setErro(mensagemErro(e)); }
  }

  const filtrados = useMemo(() => {
    const t = filtro.toLowerCase();
    return (lista ?? []).filter((f) => !t || f.nome.toLowerCase().includes(t) || f.email.includes(t) || f.departamento.toLowerCase().includes(t));
  }, [lista, filtro]);
  const ativos = lista?.filter((f) => f.ativo).length ?? 0;
  const deps = new Set(lista?.map((f) => f.departamento)).size;

  return (
    <>
      <h1>Funcionários</h1>
      {erro && <div className="aviso erro">{erro}</div>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Importar planilha</h2>
        <p className="small">Arquivo .xlsx, .xls ou .csv com as colunas <strong>Nome</strong>, <strong>E-mail</strong> e <strong>Departamento</strong> na primeira aba.
          Funcionários já cadastrados (mesmo e-mail) têm nome e departamento atualizados.</p>
        <div className="row">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => escolher(e.target.files?.[0])} aria-label="Planilha de funcionários" style={{ maxWidth: 360 }} />
          <button className="link" type="button" onClick={baixarModelo}>Baixar planilha modelo</button>
        </div>
        {previa && (
          <>
            <p style={{ marginTop: 12 }}><strong>{arquivo}</strong>: {previa.length} linha(s). Prévia das primeiras 10:</p>
            <div className="tabela-wrap"><table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Departamento</th></tr></thead>
              <tbody>{previa.slice(0, 10).map((l, i) => <tr key={i}><td>{l.nome}</td><td>{l.email}</td><td>{l.departamento}</td></tr>)}</tbody>
            </table></div>
            <label className="row" style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={inativar} onChange={(e) => setInativar(e.target.checked)} />
              Inativar funcionários que não estão nesta planilha (use quando a planilha for a lista completa e atual)
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={importar} disabled={ocupado}>{ocupado ? "Importando…" : `Importar ${previa.length} funcionário(s)`}</button>
              <button className="sec" onClick={() => setPrevia(null)}>Cancelar</button>
            </div>
          </>
        )}
        {resultado && (
          <div className={`aviso ${resultado.erros.length ? "warn" : "ok"}`}>
            <p><strong>Importação concluída:</strong> {resultado.inseridos} novo(s), {resultado.atualizados} atualizado(s){resultado.inativados ? `, ${resultado.inativados} inativado(s)` : ""}.</p>
            {resultado.erros.length > 0 && (
              <>
                <p>{resultado.erros.length} linha(s) não importada(s):</p>
                <ul className="small">{resultado.erros.map((e, i) => <li key={i}>Linha {e.linha + 1}{e.email ? ` (${e.email})` : ""}: {e.erro}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>

      <form className="card" onSubmit={cadastrar}>
        <h2 style={{ marginTop: 0 }}>Cadastrar manualmente</h2>
        <div className="grid c3">
          <div><label htmlFor="nn">Nome</label><input id="nn" required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
          <div><label htmlFor="ne">E-mail</label><input id="ne" type="email" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></div>
          <div><label htmlFor="nd">Departamento</label><input id="nd" required list="lista-deps" value={novo.departamento} onChange={(e) => setNovo({ ...novo, departamento: e.target.value })} />
            <datalist id="lista-deps">{[...new Set(lista?.map((f) => f.departamento))].map((d) => <option key={d} value={d} />)}</datalist></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}><button>Cadastrar</button>{msgNovo && <span className="small" role="status">{msgNovo}</span>}</div>
      </form>

      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Cadastro</h2>
          <span className="small muted">{ativos} ativo(s) · {deps} departamento(s)</span>
          <span className="spacer" />
          <input placeholder="Buscar por nome, e-mail ou departamento" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 320 }} aria-label="Buscar" />
        </div>
        {lista === null ? <p className="muted">Carregando…</p> : (
          <div className="tabela-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Departamento</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nome}</td><td>{f.email}</td><td>{f.departamento}</td>
                    <td><span className={`selo ${f.ativo ? "aberta" : "encerrada"}`}>{f.ativo ? "Ativo" : "Inativo"}</span></td>
                    <td><button className="link" onClick={() => alternar(f)}>{f.ativo ? "Inativar" : "Reativar"}</button></td>
                  </tr>
                ))}
                {!filtrados.length && <tr><td colSpan={5} className="muted">Nenhum funcionário.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
