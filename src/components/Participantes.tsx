import { useState } from "react";
import { admin, interpretarLista, mensagemErro, type LinhaParticipante, type ResultadoParticipantes } from "../lib/api";
import { lerPlanilha } from "../pages/admin/Funcionarios";

/** Campo para colar e-mails ou importar planilha; devolve as linhas interpretadas. */
export function EntradaParticipantes({ valor, onChange }: { valor: string; onChange: (texto: string) => void }) {
  const [erro, setErro] = useState("");
  async function arquivo(f: File | undefined) {
    setErro("");
    if (!f) return;
    try {
      const { linhas, faltando } = lerPlanilha(await f.arrayBuffer(), ["email"]);
      if (faltando.length) { setErro("A planilha precisa de uma coluna E-mail (Nome e Departamento são opcionais)."); return; }
      const texto = linhas.map((l) => (l.nome && l.departamento ? `${l.nome}; ${l.email}; ${l.departamento}` : l.email)).join("\n");
      onChange(valor.trim() ? `${valor.trim()}\n${texto}` : texto);
    } catch (e) { setErro("Não foi possível ler o arquivo: " + mensagemErro(e)); }
  }
  const n = interpretarLista(valor).length;
  return (
    <>
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={6} aria-label="Lista de participantes"
        placeholder={"Um por linha. Só o e-mail de quem já está cadastrado:\nana.souza@empresa.com.br\n\nOu nome; e-mail; departamento para cadastrar junto:\nJoão Lima; joao.lima@empresa.com.br; Comercial"} />
      <div className="row small" style={{ marginTop: 6 }}>
        <span className="muted">{n} participante(s) na lista</span>
        <span className="spacer" />
        <label className="row" style={{ margin: 0, fontWeight: 400 }}>
          Importar planilha:
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { arquivo(e.target.files?.[0]); e.target.value = ""; }} style={{ maxWidth: 240 }} />
        </label>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
    </>
  );
}

export function ResultadoInclusao({ r }: { r: ResultadoParticipantes }) {
  return (
    <div className={`aviso ${r.erros.length ? "warn" : "ok"}`} role="status">
      <p><strong>{r.incluidos} participante(s) incluído(s)</strong>
        {r.ja_estavam ? `, ${r.ja_estavam} já estava(m) na lista` : ""}
        {r.cadastrados ? `, ${r.cadastrados} cadastro(s) criado(s) ou atualizado(s)` : ""}.</p>
      {r.erros.length > 0 && (
        <>
          <p>{r.erros.length} não incluído(s):</p>
          <ul className="small">{r.erros.map((e, i) => <li key={i}>{e.email ?? `Linha ${e.linha}`}: {e.erro}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export async function incluir(pesquisa: string, texto: string): Promise<ResultadoParticipantes | null> {
  const linhas: LinhaParticipante[] = interpretarLista(texto);
  if (!linhas.length) return null;
  return admin.adicionarParticipantes(pesquisa, linhas);
}
