import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { fmtData, mensagemErro, participante, type InfoPesquisa, type Questionario, type RespostaAcesso } from "../../lib/api";
import { detectarRespostaReta } from "../../lib/metodologia";
import { CabecalhoParticipante, LogoCliente } from "../../components/Marca";

type Etapa = "email" | "orientacoes" | "questionario" | "concluido" | "situacao";
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
  const [atual, setAtual] = useState(1);
  const rolagemAuto = useRef(0);
  const location = useLocation();
  const emailRecebido = (location.state as { email?: string } | null)?.email;

  useEffect(() => {
    participante.info(codigo).then(setInfo).catch(() => setInfo(null));
    try {
      const t = sessionStorage.getItem(`hof-token-${codigo}`);
      if (t) {
        participante.questionario(t).then((qq) => {
          setToken(t); setQ(qq);
          try { setEmail(sessionStorage.getItem(`hof-email-${codigo}`) ?? ""); } catch { /* */ }
          const r = lerRascunho(codigo);
          if (r) { setResp(r.r); setA1(r.a1); setA2(r.a2); }
          setEtapa("questionario");
        }).catch(() => sessionStorage.removeItem(`hof-token-${codigo}`));
      }
    } catch { /* */ }
  }, [codigo]);

  useEffect(() => {
    if (emailRecebido) { setEmail(emailRecebido); iniciarCom(emailRecebido); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pergunta atual: a afirmação que cruza a "linha de leitura" (um terço abaixo do cabeçalho fixo).
  // Durante a rolagem automática, o destaque já foi definido e a leitura por posição é ignorada.
  useEffect(() => {
    if (etapa !== "questionario") return;
    const atualizar = () => {
      if (Date.now() - rolagemAuto.current < 900) return;
      const itens = Array.from(document.querySelectorAll<HTMLElement>(".item-q"));
      if (!itens.length) return;
      if (window.scrollY < 60) { setAtual(Number(itens[0].dataset.numero)); return; }
      const topo = document.querySelector(".cabecalho")?.getBoundingClientRect().bottom ?? 0;
      const linha = topo + (window.innerHeight - topo) / 3;
      const el = itens.find((x) => { const r = x.getBoundingClientRect(); return r.top <= linha && r.bottom >= linha; })
        ?? itens.find((x) => x.getBoundingClientRect().top > linha);
      if (el) setAtual(Number(el.dataset.numero));
    };
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
    return () => { window.removeEventListener("scroll", atualizar); window.removeEventListener("resize", atualizar); };
  }, [etapa, q]);

  useEffect(() => {
    if (etapa === "questionario") salvarRascunho(codigo, { r: resp, a1, a2 });
  }, [resp, a1, a2, etapa, codigo]);

  const todosItens = useMemo(() => q?.partes.flatMap((p) => p.itens) ?? [], [q]);
  const eixos = useMemo(() => (["hoje", "deveria"] as const).filter((e) =>
    e === "hoje" ? q?.pesquisa.coletar_hoje !== false : q?.pesquisa.coletar_deveria !== false), [q]);
  const completo = (n: number) => eixos.every((e) => resp[n]?.[e]);
  const respondidos = todosItens.filter((i) => completo(i.numero)).length;

  async function continuarEmail(e: React.FormEvent) {
    e.preventDefault();
    await iniciarCom(email);
  }

  async function iniciarCom(emailInformado: string) {
    setErro(""); setAviso(""); setOcupado(true);
    try {
      const r = await participante.iniciar(codigo, emailInformado.trim());
      if (r.situacao === "ok" && r.token) {
        setToken(r.token); setNome(r.nome ?? "");
        try { sessionStorage.setItem(`hof-token-${codigo}`, r.token); sessionStorage.setItem(`hof-email-${codigo}`, emailInformado.trim()); } catch { /* */ }
        setQ(await participante.questionario(r.token));
        setEtapa("orientacoes");
      } else { setAcesso(r as RespostaAcesso); setEtapa("situacao"); }
    } catch (err) { setErro(mensagemErro(err)); }
    finally { setOcupado(false); }
  }

  function marcar(item: number, eixo: "hoje" | "deveria", v: Nota) {
    const antes = resp[item] ?? {};
    const depois = { ...antes, [eixo]: v };
    setResp((r) => ({ ...r, [item]: { ...r[item], [eixo]: v } }));
    // Ao completar a afirmação pela primeira vez, leva a próxima ao centro da tela (ritmo sem cansar).
    const completouAgora = eixos.every((e) => depois[e]) && !eixos.every((e) => antes[e]);
    if (completouAgora) {
      const idx = todosItens.findIndex((i) => i.numero === item);
      const prox = todosItens.slice(idx + 1).find((i) => !eixos.every((e) => resp[i.numero]?.[e]));
      const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (prox) { rolagemAuto.current = Date.now() + 280; setAtual(prox.numero); }
      setTimeout(() => {
        const alvo = prox ? document.getElementById(`item-${prox.numero}`) : document.getElementById("a1");
        alvo?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "center" });
      }, 280);
    }
  }

  // Atalhos 1–5: marcam a primeira coluna vazia da afirmação em destaque.
  useEffect(() => {
    if (etapa !== "questionario") return;
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement;
      if (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT" && (alvo as HTMLInputElement).type !== "radio") return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || !/^[1-5]$/.test(ev.key)) return;
      const eixo = eixos.find((e) => !resp[atual]?.[e]);
      if (!eixo) return;
      ev.preventDefault();
      marcar(atual, eixo, Number(ev.key) as Nota);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  async function enviar() {
    setErro("");
    if (respondidos < todosItens.length) {
      setMostrarFaltando(true);
      setErro(`Faltam ${todosItens.length - respondidos} afirmação(ões). ${eixos.length > 1 ? "Os itens destacados precisam das duas notas." : "Complete os itens destacados."}`);
      const primeiro = todosItens.find((i) => !completo(i.numero));
      if (primeiro) document.getElementById(`item-${primeiro.numero}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!confirmarReta && eixos.some((e) => detectarRespostaReta(todosItens.map((i) => resp[i.numero]![e]!)))) {
      setConfirmarReta(true);
      return;
    }
    setOcupado(true);
    try {
      const itens = todosItens.map((i) => {
        const r: { item: number; hoje?: number; deveria?: number } = { item: i.numero };
        for (const e of eixos) r[e] = resp[i.numero]![e]!;
        return r;
      });
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

  const total = todosItens.length || 36;
  const abertura = (
    <div className="abertura-cliente">
      <div>
        <div className="muted small">{info.empresa_nome}</div>
        <h1 style={{ margin: "2px 0" }}>{info.titulo}</h1>
        <div className="muted small">Aberta de {fmtData(info.inicio, true)} a {fmtData(info.fim, true)}</div>
      </div>
      <LogoCliente src={info.cliente_logo} nome={info.cliente_logo ? info.empresa_nome : undefined} />
    </div>
  );

  return (
    <>
      <CabecalhoParticipante
        email={etapa === "email" ? undefined : email || undefined}
        pergunta={etapa === "questionario" ? atual : undefined}
        total={etapa === "questionario" ? total : undefined}
        progresso={etapa === "concluido" ? 1 : respondidos / total}>
        {etapa === "questionario" && (
          <ul className="legenda-escala" aria-label="Legenda das notas">
            {ESCALA.map((t, i) => <li key={t}><b>{i + 1}</b>{t}</li>)}
          </ul>
        )}
      </CabecalhoParticipante>
      <div className="container narrow">
      {etapa !== "questionario" && abertura}
      {erro && <div className="aviso erro" role="alert">{erro}</div>}
      {aviso && <div className="aviso info" role="status">{aviso}</div>}

      {etapa === "email" && (
        <form className="card" onSubmit={continuarEmail}>
          {info.descricao && <p>{info.descricao}</p>}
          <p>Para iniciar, informe o seu e-mail corporativo.</p>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="row" style={{ marginTop: 16 }}>
            <button disabled={ocupado}>{ocupado ? "Verificando…" : "Iniciar"}</button>
            <span className="spacer" />
            <Link className="small" to={`/p/${codigo}/meu-relatorio`}>Já respondi — ver meu relatório</Link>
          </div>
        </form>
      )}

      {etapa === "situacao" && acesso && <MensagemSituacao a={acesso} codigo={codigo} voltar={() => setEtapa("email")} />}

      {etapa === "orientacoes" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{nome ? `Olá, ${nome}!` : "Orientações"}</h2>
          <p>Este questionário mapeia {eixos.length > 1 ? <>como a cultura da {info.empresa_nome} é percebida hoje e como você acredita que ela deveria ser</> : eixos[0] === "hoje" ? <>como a cultura da {info.empresa_nome} é percebida hoje</> : <>como você acredita que a cultura da {info.empresa_nome} deveria ser</>}. É um <strong>diagnóstico coletivo</strong>, não uma avaliação individual.</p>
          <p>Não há resposta certa ou errada. O instrumento não avalia desempenho nem serve de base para avaliação de performance. Sua resposta espontânea é a mais valiosa.</p>
          <div className="aviso info">
            <strong>Anonimato:</strong> suas respostas são gravadas <strong>sem vínculo com o seu nome ou e-mail</strong> e consolidadas em médias de grupo. O sistema registra apenas que você participou, para garantir uma resposta por pessoa.
          </div>
          <p><strong>Como preencher:</strong> para cada uma das 36 afirmações, marque {eixos.length > 1 ? "duas notas" : "uma nota"} de 1 a 5:</p>
          <ul>
            {eixos.includes("hoje") && <li><strong style={{ color: "var(--hoje)" }}>É HOJE</strong> — como a empresa funciona na prática, no dia a dia que você observa.</li>}
            {eixos.includes("deveria") && <li><strong style={{ color: "var(--deveria)" }}>DEVERIA SER</strong> — como você acredita que seria o ideal.</li>}
          </ul>
          <p className="small">Escala: 1 = discordo totalmente · 2 = discordo · 3 = neutro · 4 = concordo · 5 = concordo totalmente.</p>
          <div className="aviso warn">
            Você vai encontrar afirmações que parecem defender ideias opostas. <strong>Isso é intencional.</strong> Não tente decidir se a frase está certa ou errada — leia a frase inteira, até o ponto final, e responda {eixos.length > 1 ? "se ela descreve o que acontece hoje na empresa e, na outra coluna, se você acredita que deveria acontecer" : eixos[0] === "hoje" ? "se ela descreve o que acontece hoje na empresa" : "se você acredita que isso deveria acontecer na empresa"}. Não tente ser coerente com a resposta anterior: cada frase é avaliada isoladamente.
          </div>
          {eixos.length > 1 && <p>As duas colunas podem ter a mesma nota — isso é um resultado válido e significa que, naquele aspecto, você está satisfeito com a empresa hoje.</p>}
          <p>Responda pela empresa como um todo (não apenas pela sua área), de forma intuitiva e sem consultar colegas. Tempo estimado: <strong>12 a 15 minutos</strong>. Suas respostas ficam salvas neste navegador até o envio, e você pode revisá-las antes de enviar.</p>
          <button onClick={() => { setEtapa("questionario"); window.scrollTo(0, 0); }}>Começar</button>
        </div>
      )}

      {etapa === "questionario" && q && (
        <>
          <p className="dica-teclado">Dica: use as teclas <kbd>1</kbd> a <kbd>5</kbd> para marcar a afirmação em destaque.</p>
          {q.partes.map((p) => (
            <section key={p.ordem} aria-labelledby={`parte-${p.ordem}`}>
              <div className="parte">
                <span className="n">Parte {p.ordem} de {q.partes.length}</span>
                <h2 id={`parte-${p.ordem}`}>{p.nome}</h2>
                <p>{p.descricao}</p>
              </div>
              {p.itens.map((i) => {
                const r = resp[i.numero] ?? {};
                const falta = mostrarFaltando && !completo(i.numero);
                const classe = ["item-q", falta ? "faltando" : "", i.numero === atual ? "foco" : "", completo(i.numero) ? "feita" : ""].join(" ");
                return (
                  <div className={classe} key={i.numero} id={`item-${i.numero}`} data-numero={i.numero}
                    onFocusCapture={() => setAtual(i.numero)} onPointerDown={() => setAtual(i.numero)}>
                    <div className="texto"><small>Afirmação {i.numero}</small>{i.texto}</div>
                    <div className={`escalas ${eixos.length === 1 ? "uma" : ""}`}>
                      {eixos.map((eixo) => (
                        <fieldset className={`escala ${eixo}`} key={eixo}>
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
                          <div className="extremos" aria-hidden><span>Discordo</span><span>Neutro</span><span>Concordo</span></div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          <section className="card" style={{ marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>Observações finais (opcional)</h2>
            <label htmlFor="a1">1. Qual é, na sua visão, o maior desalinhamento cultural da empresa hoje?</label>
            <textarea id="a1" maxLength={4000} value={a1} onChange={(e) => setA1(e.target.value)} />
            <label htmlFor="a2">2. Que mudança cultural teria o maior impacto no nosso resultado nos próximos 12 meses?</label>
            <textarea id="a2" maxLength={4000} value={a2} onChange={(e) => setA2(e.target.value)} />
            <p className="small muted">Evite escrever nomes ou detalhes que permitam identificar você ou colegas.</p>
          </section>
          {confirmarReta && (
            <div className="aviso warn" role="alert">
              Você marcou a mesma nota em quase todas as afirmações{eixos.length > 1 ? " de uma das colunas" : ""}. Cada frase descreve um aspecto diferente da cultura —
              vale revisar lendo cada uma até o fim. Se essa é mesmo a sua percepção, pode enviar assim.
            </div>
          )}
          <div className="row">
            <button onClick={enviar} disabled={ocupado}>{ocupado ? "Enviando…" : confirmarReta ? "Enviar mesmo assim" : "Enviar respostas"}</button>
            <span className="small muted">{respondidos} de {total} afirmações completas. Após o envio, não será possível alterar as respostas.</span>
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
    </>
  );
}

export function MensagemSituacao({ a, codigo, voltar }: { a: RespostaAcesso; codigo: string; voltar: () => void }) {
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
