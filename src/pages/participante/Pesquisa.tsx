import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fmtData, mensagemErro, participante, type InfoPesquisa, type Questionario, type RespostaAcesso } from "../../lib/api";
import { detectarRespostaReta } from "../../lib/metodologia";

type Etapa = "email" | "codigo" | "orientacoes" | "questionario" | "concluido" | "situacao";
type Nota = 1 | 2 | 3 | 4 | 5;
type Respostas = Record<number, { hoje?: Nota; deveria?: Nota }>;

const ESCALA = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];

function lerRascunho(codigo: string): { r: Respostas; a1: string; a2: string } | null {
  try {
    const s = sessionStorage.getItem(`hof-rascunho-${codigo}`);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function salvarRascunho(codigo: string, v: { r: Respostas; a1: string; a2: string }) {
  try { sessionStorage.setItem(`hof-rascunho-${codigo}`, JSON.stringify(v)); } catch { /* sem armazenamento */ }
}
function limparRascunho(codigo: string) {
  try { sessionStorage.removeItem(`hof-rascunho-${codigo}`); sessionStorage.removeItem(`hof-token-${codigo}`); } catch { /* */ }
}

export default function Pesquisa() {
  const { codigo = "" } = useParams();
  const [info, setInfo] = useState<InfoPesquisa | null | undefined>(undefined);
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [acesso, setAcesso] = useState<RespostaAcesso | null>(null);
  const [token, setToken] = useState<string>("");
  const [nome, setNome] = useState("");
  const [q, setQ] = useState<Questionario | null>(null);
  const [resp, setResp] = useState<Respostas>({});
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [recibo, setRecibo] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mostrarFaltando, setMostrarFaltando] = useState(false);
  const [confirmarReta, setConfirmarReta] = useState(false);

  useEffect(() => {
    participante.info(codigo).then(setInfo).catch(() => setInfo(null));
    try {
      const t = sessionStorage.getItem(`hof-token-${codigo}`);
      if (t) {
        participante.questionario(t).then((qq) => {
          setToken(t); setQ(qq);
          const r = lerRascunho(codigo);
          if (r) { setResp(r.r); setA1(r.a1); setA2(r.a2); }
          setEtapa("questionario");
        }).catch(() => sessionStorage.removeItem(`hof-token-${codigo}`));
      }
    } catch { /* */ }
  }, [codigo]);

  useEffect(() => {
    if (etapa === "questionario") salvarRascunho(codigo, { r: resp, a1, a2 });
  }, [resp, a1, a2, etapa, codigo]);

  const todosItens = useMemo(() => q?.partes.flatMap((p) => p.itens) ?? [], [q]);
  const respondidos = todosItens.filter((i) => resp[i.numero]?.hoje && resp[i.numero]?.deveria).length;

  async function continuarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setAviso(""); setOcupado(true);
    try {
      const a = await participante.verificar(codigo, email.trim());
      setAcesso(a);
      if (a.situacao !== "pode_responder") { setEtapa("situacao"); return; }
      const envio = await participante.enviarCodigo(codigo, email.trim());
      if (envio.situacao === "codigo_enviado") { setEtapa("codigo"); setAviso(`Enviamos um código de 6 dígitos para ${email.trim()}.`); }
      else if (envio.situacao === "aguarde") { setEtapa("codigo"); setAviso(envio.mensagem ?? "Aguarde para pedir um novo código."); }
      else if (envio.situacao === "email_nao_configurado") setErro("O envio de e-mails ainda não foi configurado. Avise o responsável pela pesquisa.");
      else setErro("Não foi possível enviar o código. Tente novamente em instantes.");
    } catch (err) { setErro(mensagemErro(err)); }
    finally { setOcupado(false); }
  }

  async function validarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOcupado(true);
    try {
      const r = await participante.validar(codigo, email.trim(), codigoAcesso);
      if (r.situacao === "ok" && r.token) {
        setToken(r.token); setNome(r.nome ?? "");
        try { sessionStorage.setItem(`hof-token-${codigo}`, r.token); } catch { /* */ }
        setQ(await participante.questionario(r.token));
        setEtapa("orientacoes");
      } else if (r.situacao === "codigo_invalido") setErro(r.mensagem ?? "Código inválido.");
      else { setAcesso(r as RespostaAcesso); setEtapa("situacao"); }
    } catch (err) { setErro(mensagemErro(err)); }
    finally { setOcupado(false); }
  }

  async function reenviar() {
    setErro(""); setAviso("");
    try {
      const envio = await participante.enviarCodigo(codigo, email.trim());
      setAviso(envio.situacao === "codigo_enviado" ? "Novo código enviado." : envio.mensagem ?? "Não foi possível reenviar agora.");
    } catch (err) { setErro(mensagemErro(err)); }
  }

  function marcar(item: number, eixo: "hoje" | "deveria", v: Nota) {
    setResp((r) => ({ ...r, [item]: { ...r[item], [eixo]: v } }));
  }

  async function enviar() {
    setErro("");
    if (respondidos < todosItens.length) {
      setMostrarFaltando(true);
      setErro(`Faltam ${todosItens.length - respondidos} afirmação(ões). Os itens destacados precisam das duas notas.`);
      const primeiro = todosItens.find((i) => !(resp[i.numero]?.hoje && resp[i.numero]?.deveria));
      if (primeiro) document.getElementById(`item-${primeiro.numero}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const hoje = todosItens.map((i) => resp[i.numero]!.hoje!);
    const dev = todosItens.map((i) => resp[i.numero]!.deveria!);
    if (!confirmarReta && (detectarRespostaReta(hoje) || detectarRespostaReta(dev))) {
      setConfirmarReta(true);
      return;
    }
    setOcupado(true);
    try {
      const itens = todosItens.map((i) => ({ item: i.numero, hoje: resp[i.numero]!.hoje!, deveria: resp[i.numero]!.deveria! }));
      const r = await participante.enviar(token, itens, a1, a2);
      limparRascunho(codigo);
      setRecibo(r.recibo);
      setEtapa("concluido");
      window.scrollTo(0, 0);
    } catch (err) { setErro(mensagemErro(err)); }
    finally { setOcupado(false); }
  }

  if (info === undefined) return <div className="container narrow"><p className="muted">Carregando…</p></div>;
  if (info === null) return (
    <div className="container narrow"><div className="card"><h1>Pesquisa não encontrada</h1>
      <p>Confira o link recebido. Se o problema continuar, fale com o RH.</p></div></div>
  );

  const cabecalho = (
    <header style={{ marginBottom: 16 }}>
      <div className="muted small">{info.empresa_nome}</div>
      <h1>{info.titulo}</h1>
      <div className="muted small">Período: {fmtData(info.inicio, true)} a {fmtData(info.fim, true)}</div>
    </header>
  );

  return (
    <div className="container narrow">
      {cabecalho}
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      {aviso && <div className="aviso info" role="status">{aviso}</div>}

      {etapa === "email" && (
        <form className="card" onSubmit={continuarEmail}>
          {info.descricao && <p>{info.descricao}</p>}
          <p>Para iniciar, informe o seu e-mail corporativo. Enviaremos um código de acesso para confirmar que é você.</p>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={ocupado}>{ocupado ? "Verificando…" : "Continuar"}</button>
            <span className="spacer" />
            <Link className="small" to={`/p/${codigo}/meu-relatorio`}>Já respondi — ver meu relatório</Link>
          </div>
        </form>
      )}

      {etapa === "codigo" && (
        <form className="card" onSubmit={validarCodigo}>
          <p>Digite o código de 6 dígitos enviado para <strong>{email}</strong>. Ele vale por 15 minutos.</p>
          <label htmlFor="cod">Código de acesso</label>
          <input id="cod" className="codigo-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={codigoAcesso} onChange={(e) => setCodigoAcesso(e.target.value.replace(/\D/g, ""))} required />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={ocupado || codigoAcesso.length !== 6}>{ocupado ? "Validando…" : "Entrar"}</button>
            <button type="button" className="sec" onClick={reenviar}>Reenviar código</button>
            <button type="button" className="link" onClick={() => { setEtapa("email"); setCodigoAcesso(""); setAviso(""); }}>Trocar e-mail</button>
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Não recebeu? Verifique a caixa de spam ou lixo eletrônico.</p>
        </form>
      )}

      {etapa === "situacao" && acesso && <MensagemSituacao a={acesso} codigo={codigo} voltar={() => setEtapa("email")} />}

      {etapa === "orientacoes" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{nome ? `Olá, ${nome}!` : "Orientações"}</h2>
          <p>Este questionário mapeia como a cultura da {info.empresa_nome} é percebida hoje e como você acredita que ela deveria ser. É um <strong>diagnóstico coletivo</strong>, não uma avaliação individual.</p>
          <p>Não há resposta certa ou errada. O instrumento não avalia desempenho nem serve de base para avaliação de performance. Sua resposta espontânea é a mais valiosa.</p>
          <div className="aviso info">
            <strong>Anonimato:</strong> suas respostas são gravadas <strong>sem vínculo com o seu nome ou e-mail</strong> e consolidadas em médias de grupo. O sistema registra apenas que você participou, para garantir uma resposta por pessoa.
          </div>
          <p><strong>Como preencher:</strong> para cada uma das 36 afirmações, marque duas notas de 1 a 5:</p>
          <ul>
            <li><strong style={{ color: "var(--hoje)" }}>É HOJE</strong> — como a empresa funciona na prática, no dia a dia que você observa.</li>
            <li><strong style={{ color: "var(--deveria)" }}>DEVERIA SER</strong> — como você acredita que seria o ideal.</li>
          </ul>
          <p className="small">Escala: 1 = discordo totalmente · 2 = discordo · 3 = neutro · 4 = concordo · 5 = concordo totalmente.</p>
          <div className="aviso warn">
            Você vai encontrar afirmações que parecem defender ideias opostas. <strong>Isso é intencional.</strong> Não tente decidir se a frase está certa ou errada — leia a frase inteira, até o ponto final, e responda se ela descreve o que acontece hoje na empresa e, na outra coluna, se você acredita que deveria acontecer. Não tente ser coerente com a resposta anterior: cada frase é avaliada isoladamente.
          </div>
          <p>As duas colunas podem ter a mesma nota — isso é um resultado válido e significa que, naquele aspecto, você está satisfeito com a empresa hoje.</p>
          <p>Responda pela empresa como um todo (não apenas pela sua área), de forma intuitiva e sem consultar colegas. Tempo estimado: <strong>12 a 15 minutos</strong>. Suas respostas ficam salvas neste navegador até o envio, e você pode revisá-las antes de enviar.</p>
          <button onClick={() => { setEtapa("questionario"); window.scrollTo(0, 0); }}>Começar</button>
        </div>
      )}

      {etapa === "questionario" && q && (
        <>
          <div className="progresso nao-imprimir">
            <div className="row small"><span>{respondidos} de {todosItens.length} afirmações respondidas</span></div>
            <div className="barra" aria-hidden><div style={{ width: `${(respondidos / todosItens.length) * 100}%` }} /></div>
          </div>
          {q.partes.map((p) => (
            <section className="card" key={p.ordem}>
              <h2 style={{ marginTop: 0 }}>Parte {p.ordem} — {p.nome}</h2>
              <p className="muted small">{p.descricao}</p>
              {p.itens.map((i) => {
                const r = resp[i.numero] ?? {};
                const falta = mostrarFaltando && !(r.hoje && r.deveria);
                return (
                  <div className={`item-q ${falta ? "faltando" : ""}`} key={i.numero} id={`item-${i.numero}`}>
                    <div className="texto"><span className="num">{i.numero}.</span>{i.texto}</div>
                    <div className="escalas">
                      {(["hoje", "deveria"] as const).map((eixo) => (
                        <fieldset className={`escala ${eixo}`} key={eixo} style={{ border: "none", padding: 0, margin: 0 }}>
                          <legend className="rot">{eixo === "hoje" ? "É HOJE" : "DEVERIA SER"}</legend>
                          <div className="opcoes">
                            {([1, 2, 3, 4, 5] as Nota[]).map((v) => (
                              <label key={v} className={r[eixo] === v ? "sel" : ""} title={ESCALA[v - 1]}>
                                <input type="radio" name={`i${i.numero}-${eixo}`} value={v} checked={r[eixo] === v}
                                  onChange={() => marcar(i.numero, eixo, v)} aria-label={`${eixo === "hoje" ? "É hoje" : "Deveria ser"}: ${v} — ${ESCALA[v - 1]}`} />
                                {v}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Observações finais (opcional)</h2>
            <label htmlFor="a1">1. Qual é, na sua visão, o maior desalinhamento cultural da empresa hoje?</label>
            <textarea id="a1" maxLength={4000} value={a1} onChange={(e) => setA1(e.target.value)} />
            <label htmlFor="a2">2. Que mudança cultural teria o maior impacto no nosso resultado nos próximos 12 meses?</label>
            <textarea id="a2" maxLength={4000} value={a2} onChange={(e) => setA2(e.target.value)} />
            <p className="small muted">Evite escrever nomes ou detalhes que permitam identificar você ou colegas.</p>
          </section>
          {confirmarReta && (
            <div className="aviso warn" role="alert">
              Você marcou a mesma nota em quase todas as afirmações de uma das colunas. Cada frase descreve um aspecto diferente da cultura —
              vale revisar lendo cada uma até o fim. Se essa é mesmo a sua percepção, pode enviar assim.
            </div>
          )}
          <div className="row">
            <button onClick={enviar} disabled={ocupado}>{ocupado ? "Enviando…" : confirmarReta ? "Enviar mesmo assim" : "Enviar respostas"}</button>
            <span className="small muted">Após o envio, não será possível alterar as respostas.</span>
          </div>
        </>
      )}

      {etapa === "concluido" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Obrigado pela sua participação!</h2>
          <p>Suas respostas foram registradas de forma anônima.</p>
          <p><strong>Seu código pessoal</strong> — anote ou guarde em local seguro:</p>
          <p><span className="recibo">{recibo}</span></p>
          <div className="aviso warn">
            Este código é a <strong>única forma</strong> de acessar o seu relatório individual. Ele não fica ligado ao seu nome e não pode ser recuperado: nem o RH tem acesso a ele.
          </div>
          <div className="row">
            <button className="sec" onClick={() => navigator.clipboard?.writeText(recibo)}>Copiar código</button>
            <Link className="btn" to={`/p/${codigo}/meu-relatorio?r=${encodeURIComponent(recibo)}`}>Ver meu relatório</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MensagemSituacao({ a, codigo, voltar }: { a: RespostaAcesso; codigo: string; voltar: () => void }) {
  const resp = a.responsavel_nome ? <><strong>{a.responsavel_nome}</strong> ({a.responsavel_email && <a href={`mailto:${a.responsavel_email}`}>{a.responsavel_email}</a>})</> : "o responsável pela pesquisa";
  let tipo = "info", titulo = "", corpo: React.ReactNode = null;
  switch (a.situacao) {
    case "nao_cadastrado":
      tipo = "erro"; titulo = "E-mail não cadastrado";
      corpo = <p>Somente funcionários cadastrados podem responder esta pesquisa. Confira se digitou o e-mail corporativo correto. Se o problema continuar, fale com {resp}.</p>;
      break;
    case "nao_elegivel":
      tipo = "erro"; titulo = "Você não está na lista desta pesquisa";
      corpo = <p>Seu cadastro não faz parte do público desta pesquisa. Em caso de dúvida, fale com {resp}.</p>;
      break;
    case "nao_iniciada":
      tipo = "info"; titulo = "A pesquisa ainda não começou";
      corpo = <p>A pesquisa estará aberta a partir de <strong>{fmtData(a.inicio, true)}</strong> até {fmtData(a.fim, true)}. Volte a acessar este link nesse período.</p>;
      break;
    case "ja_respondeu":
      tipo = "ok"; titulo = "Você já respondeu esta pesquisa";
      corpo = <><p>Sua participação foi registrada em <strong>{fmtData(a.respondeu_em)}</strong>. Cada pessoa responde uma única vez. Obrigado!</p>
        <p><Link to={`/p/${codigo}/meu-relatorio`}>Ver meu relatório individual</Link> (é preciso o código pessoal recebido ao final).</p></>;
      break;
    case "encerrada_respondeu":
      tipo = "ok"; titulo = "Pesquisa encerrada — sua participação está registrada";
      corpo = <><p>Você respondeu em <strong>{fmtData(a.respondeu_em)}</strong>. O prazo terminou em {fmtData(a.fim, true)}. Obrigado pela contribuição!</p>
        <p><Link to={`/p/${codigo}/meu-relatorio`}>Ver meu relatório individual</Link></p></>;
      break;
    case "encerrada_nao_respondeu":
      tipo = "warn"; titulo = "Pesquisa encerrada — você não respondeu no prazo";
      corpo = <><p>O prazo terminou em <strong>{fmtData(a.fim, true)}</strong> e não há registro da sua participação.</p>
        <p>Recomendamos que você <strong>envie uma justificativa</strong> a {resp}.</p>
        {a.responsavel_email && <p><a className="btn sec" href={`mailto:${a.responsavel_email}?subject=${encodeURIComponent("Justificativa — pesquisa de cultura organizacional")}`}>Escrever justificativa</a></p>}</>;
      break;
    default:
      tipo = "erro"; titulo = "Pesquisa não encontrada"; corpo = <p>Confira o link recebido.</p>;
  }
  return (
    <div className={`aviso ${tipo}`} role="status">
      <h2 style={{ marginTop: 0 }}>{titulo}</h2>
      {corpo}
      <button className="link" onClick={voltar}>Voltar</button>
    </div>
  );
}
