// Conteúdo interpretativo extraído do "Guia de Formação do Aplicador — Diagnóstico Cultural Hofstede".
// As regras de cálculo (recodificação, médias, DP) ficam no banco; aqui ficam as faixas de leitura e os textos.

export type CodigoDimensao = "PDI" | "IDV" | "MAS" | "UAI" | "LTO" | "IVR";

export interface InfoDimensao {
  codigo: CodigoDimensao;
  nome: string;
  curto: string;
  mede: string;
  poloAlto: string;
  poloBaixo: string;
  alerta: string;
  variantes: { altoConsensoAlto: string; altoConsensoBaixo: string; baixoConsensoAlto: string; baixoConsensoBaixo: string };
  errosLeitura: string[];
  perguntas: string[];
}

export const DIMENSOES: InfoDimensao[] = [
  {
    codigo: "PDI", nome: "Distância ao Poder", curto: "Dist. Poder",
    mede: "Grau em que a desigualdade de poder é aceita e esperada: quem pode decidir o quê, e quem precisa pedir permissão.",
    poloAlto: "Hierarquia respeitada, decisão concentrada, acesso formal, subordinado espera instrução.",
    poloBaixo: "Estrutura horizontal, decisão distribuída, acesso informal, autonomia para questionar.",
    alerta: "Discursar participação e praticar concentração.",
    variantes: {
      altoConsensoAlto: "Hierarquia clara e legitimada. Pode ser eficiência, não disfunção — em setores regulados costuma ser o esperado. Só é problema se o modelo travado conflitar com a agilidade necessária.",
      altoConsensoBaixo: "O grupo diverge sobre o modelo de autoridade — parte espera hierarquia, parte horizontalidade. Risco real de conflito: expectativas opostas sobre quem decide geram atrito.",
      baixoConsensoAlto: "Cultura participativa consolidada. Requer maturidade para que a participação não vire falta de decisão.",
      baixoConsensoBaixo: "Discurso participativo com prática centralizadora (ou o contrário, por área). A acusação de discurso × prática corrói a confiança.",
    },
    errosLeitura: [
      "Confundir distância ao poder alta com autoritarismo: hierarquia clara e legitimada pode ser clareza de papéis e velocidade.",
      "Confundir nota baixa com boa cultura: sem clareza de quem decide, nota baixa pode ser ausência de liderança.",
    ],
    perguntas: [
      "Qual foi a última decisão importante de que um colaborador de nível mais baixo participou — e qual o papel dele?",
      "Descreva uma situação em que você foi contradito por um subordinado. Como se sentiu? O que aconteceu?",
      "Quantas camadas de aprovação uma proposta atravessa até virar execução? Onde trava?",
    ],
  },
  {
    codigo: "IDV", nome: "Individualismo vs. Coletivismo", curto: "Individualismo",
    mede: "Se a organização prioriza realização e reconhecimento individuais ou resultado e identidade do grupo — como o mérito é desenhado e distribuído.",
    poloAlto: "Mérito e reconhecimento individuais, metas por pessoa, especialista celebrado.",
    poloBaixo: "Metas, crédito e responsabilidade coletivos, articulador de grupo celebrado.",
    alerta: "Discurso de time com prêmio individual.",
    variantes: {
      altoConsensoAlto: "Cultura meritocrática coerente. Boa para vendas e performance. Requer cuidado para não fragmentar a cooperação.",
      altoConsensoBaixo: "Sinal clássico de atrito entre funções — áreas comerciais e de suporte leem o fenômeno de forma oposta. A média alta esconde uma disputa de modelo entre áreas.",
      baixoConsensoAlto: "Cultura de time forte. O risco é a diluição de responsabilidade — na hora do erro, ninguém é responsável, porque todos são.",
      baixoConsensoBaixo: "Discurso de time com prática de competição interna. Fala-se coletivo, mas bônus e promoção são individuais; a incoerência corrói a confiança.",
    },
    errosLeitura: [
      "Tratar individualismo como algo negativo: é o motor de performance e reconhecimento da contribuição, não egoísmo.",
      "Ignorar que a dimensão varia por área: pode ser alta em comercial e baixa em operações.",
    ],
    perguntas: [
      "Descreva a última premiação: quem foi elogiado, a pessoa ou o time? O que isso comunica?",
      "Quando um projeto dá certo, quem leva o crédito — e quando dá errado, quem assume?",
      "Se um profissional excelente sair do time, o quanto o resultado cai? Ele era insubstituível?",
    ],
  },
  {
    codigo: "MAS", nome: "Masculinidade vs. Feminilidade", curto: "Masculinidade",
    mede: "Se o ambiente valoriza assertividade, competição e resultado material, ou cooperação, modéstia e qualidade de vida. Trata de valores, não de gênero.",
    poloAlto: "Competição, conflito aberto, avaliação por entrega, franqueza mesmo quando dura.",
    poloBaixo: "Cooperação, consenso, bem-estar como métrica, gentileza no trato.",
    alerta: "Dizer-se humano e operar com pressão.",
    variantes: {
      altoConsensoAlto: "Cultura de alta performance declarada e praticada. Coerente para fases agressivas de crescimento. O custo é pressão, que precisa ser gerida.",
      altoConsensoBaixo: "Pressão percebida de forma desigual — parte vive a alta performance como estímulo, parte como sufocante. Risco real de burnout em parte do grupo.",
      baixoConsensoAlto: "Cultura cooperativa consolidada. Risco de baixa tensão competitiva — pouca cobrança de resultado.",
      baixoConsensoBaixo: "Empresa que se diz humana e opera com pressão. Combinação mais perigosa desta dimensão: discurso acolhedor, prática dura.",
    },
    errosLeitura: [
      "Ler a dimensão como gênero: é sobre valores de assertividade/competição vs. cooperação/bem-estar.",
      "Assumir que nota baixa é sempre melhor: depende do setor e do estágio da empresa.",
    ],
    perguntas: [
      "Descreva a última reunião com divergência. Como foi tratada? Saíram mais alinhados ou mais ressentidos?",
      "Quando uma meta agressiva é proposta, a reação é 'vamos tentar' ou 'vamos discutir se é realista'?",
      "O feedback é direto ou atenuado? O que acontece com quem é transparente?",
    ],
  },
  {
    codigo: "UAI", nome: "Aversão à Incerteza", curto: "Aversão Incerteza",
    mede: "Tolerância da organização à ambiguidade, ao risco e à mudança; necessidade de estruturas que reduzam a imprevisibilidade.",
    poloAlto: "Regras escritas, processo formal, desconforto com mudança, preferência por certeza.",
    poloBaixo: "Tolerância a informação incompleta, teste rápido, aceitação do erro, adaptabilidade.",
    alerta: "Dizer-se ágil e exigir três aprovações.",
    variantes: {
      altoConsensoAlto: "Organização previsível e processual. Coerente para operações reguladas. O trade-off é inovação.",
      altoConsensoBaixo: "Parte quer estrutura, parte velocidade. Gera paralisia — decisões esperam enquanto áreas ágeis avançam.",
      baixoConsensoAlto: "Cultura ágil consolidada. Risco de caos operacional — agilidade vira improviso e retrabalho.",
      baixoConsensoBaixo: "Discurso de agilidade com prática de controle. A distância entre discurso e processo corrói a confiança.",
    },
    errosLeitura: [
      "Confundir aversão à incerteza com conservadorismo político: descreve a relação com o desconhecido e o processo.",
      "Não considerar que setores regulados exigem nota alta por razão legítima — saúde, segurança e finanças.",
    ],
    perguntas: [
      "Descreva a última nova ideia. Quantos passos de validação até virar um teste?",
      "Quando o cenário mudou abruptamente, a empresa reverteu o plano em horas ou meses?",
      "Errar em uma experimentação é tratado como aprendizado ou como mancha no histórico?",
    ],
  },
  {
    codigo: "LTO", nome: "Orientação de Longo Prazo", curto: "Longo Prazo",
    mede: "Se a organização prioriza resultado imediato ou construção de futuro sustentável.",
    poloAlto: "Retorno distante aceito, compromisso mantido em cenário adverso, horizonte de anos.",
    poloBaixo: "Foco no trimestre, pressão por resultado imediato, ajuste rápido de rota.",
    alerta: "Discursar longo prazo e cortar todo trimestre.",
    variantes: {
      altoConsensoAlto: "Horizonte estratégico compartilhado. Raro e coerente. Requer disciplina para sustentar o discurso quando o trimestre aperta.",
      altoConsensoBaixo: "Discurso de longo prazo com cobrança de curto prazo. Gerador clássico de cinismo — as pessoas param de acreditar quando o comportamento contradiz o discurso.",
      baixoConsensoAlto: "Execução trimestral consolidada. Eficiente para turnaround. O custo é baixa capacidade de transformação.",
      baixoConsensoBaixo: "Grupo dividido entre sobreviver e construir. Decisões oscilam; o orçamento não mantém direção.",
    },
    errosLeitura: [
      "Ler nota baixa como falta de visão: foco no curto prazo pode ser disciplina de caixa.",
      "Ignorar o estágio da empresa: em crise precisa de curto prazo; em crescimento, de longo prazo.",
    ],
    perguntas: [
      "Quando um projeto não dá retorno no prazo, a empresa sustenta ou corta? Por quanto tempo suporta?",
      "Na última reunião de orçamento, a decisão mais difícil defendeu o trimestre ou o futuro?",
      "Descreva um investimento de longo prazo sustentado e um cortado no meio. O que os diferencia?",
    ],
  },
  {
    codigo: "IVR", nome: "Indulgência vs. Restrição", curto: "Indulgência",
    mede: "Espaço para autonomia, informalidade, satisfação e leveza no trabalho, em oposição a controle, formalidade e dever.",
    poloAlto: "Autonomia real, humor permitido, satisfação genuína, flexibilidade.",
    poloBaixo: "Ambiente formal, regras rígidas de conduta, trabalho como dever.",
    alerta: "Dizer-se flexível e operar com controle.",
    variantes: {
      altoConsensoAlto: "Ambiente de confiança e autonomia. Coerente para quem depende de criatividade e retenção.",
      altoConsensoBaixo: "Autonomia percebida de forma desigual entre áreas — alimenta a sensação de tratamento desigual.",
      baixoConsensoAlto: "Ambiente formal e controlado, coerente com operações de alta criticidade. O trade-off é retenção e inovação.",
      baixoConsensoBaixo: "Empresa que se diz flexível e opera com controle. Discurso e regras divergentes geram frustração.",
    },
    errosLeitura: [
      "Tratar indulgência como benefício: é o grau de confiança, informalidade e autonomia culturalmente permitido.",
      "Assumir que nota baixa é sempre problema: em ambientes de segurança crítica, a restrição é adequada.",
    ],
    perguntas: [
      "Descreva um dia normal: quantas decisões você toma sem pedir permissão? O processo exige aval?",
      "Quando alguém pede flexibilidade de horário, a reação é natural ou gera desconfiança?",
      "As pessoas têm prazer genuíno no trabalho ou cumprem um dever?",
    ],
  },
];

export const DIM = Object.fromEntries(DIMENSOES.map((d) => [d.codigo, d])) as Record<CodigoDimensao, InfoDimensao>;

// ---------------------------------------------------------------------------
// Faixas de leitura
// ---------------------------------------------------------------------------

/** Ponto médio da escala 1–5: acima = polo alto, abaixo = polo baixo. */
export const PONTO_MEDIO = 3;

export type Consenso = "alto" | "medio" | "baixo" | "indefinido";

/** DP < 0,8 alto; 0,8–1,2 médio; > 1,2 baixo (Guia, Parte I §3). */
export function classificarConsenso(dp: number | null | undefined): Consenso {
  if (dp === null || dp === undefined || Number.isNaN(dp)) return "indefinido";
  if (dp < 0.8) return "alto";
  if (dp <= 1.2) return "medio";
  return "baixo";
}

export const TEXTO_CONSENSO: Record<Consenso, string> = {
  alto: "Consenso alto — cultura clara e compartilhada; a média é confiável para representar o grupo.",
  medio: "Consenso médio — variação relevante; parte do grupo percebe o fenômeno de forma distinta; investigar por área.",
  baixo: "Consenso baixo — cultura ambígua ou dividida; a média sozinha não representa ninguém; prioridade é entender a dispersão.",
  indefinido: "Consenso não calculável (é preciso pelo menos 2 respondentes).",
};

export type FaixaGap = "alinhado" | "medio" | "alto";

/** |gap| 0–0,4 alinhamento alto; 0,4–0,8 médio; > 0,8 gap alto (Guia, Parte V §2). */
export function classificarGap(gap: number | null | undefined): FaixaGap {
  const g = Math.abs(gap ?? 0);
  if (g <= 0.4) return "alinhado";
  if (g <= 0.8) return "medio";
  return "alto";
}

export const TEXTO_GAP: Record<FaixaGap, string> = {
  alinhado: "Alinhamento alto — cultura percebida próxima da desejada. Pouca energia de mudança; ajustes pontuais. Questionar se há complacência.",
  medio: "Alinhamento médio — distância produtiva entre o que é e o que deveria ser. Direção de mudança clara e legítima, adequada para priorizar ações.",
  alto: "Gap alto — grande distância entre a cultura percebida e a desejada. Insatisfação e energia de mudança forte; investigar causas e risco de cinismo antes de agir.",
};

export const ROTULO_GAP: Record<FaixaGap, string> = { alinhado: "Alinhado", medio: "Gap médio", alto: "Gap alto" };
export const ROTULO_CONSENSO: Record<Consenso, string> = { alto: "Consenso alto", medio: "Consenso médio", baixo: "Consenso baixo", indefinido: "—" };

export function nivel(media: number | null | undefined): "alto" | "baixo" | "neutro" | null {
  if (media === null || media === undefined) return null;
  if (media > PONTO_MEDIO) return "alto";
  if (media < PONTO_MEDIO) return "baixo";
  return "neutro";
}

export function descreverNivel(media: number | null | undefined): string {
  if (media === null || media === undefined) return "—";
  if (media >= 4) return "Alto";
  if (media > 3.25) return "Moderadamente alto";
  if (media >= 2.75) return "Intermediário";
  if (media > 2) return "Moderadamente baixo";
  return "Baixo";
}

export function direcaoGap(gap: number | null | undefined, d: InfoDimensao): string {
  if (gap === null || gap === undefined || Math.abs(gap) <= 0.4) return "Sem movimento relevante desejado.";
  return gap > 0
    ? `Desejo de MAIS ${d.nome.split(" vs.")[0].toLowerCase()} (rumo ao polo alto: ${d.poloAlto.toLowerCase()})`
    : `Desejo de MENOS ${d.nome.split(" vs.")[0].toLowerCase()} (rumo ao polo baixo: ${d.poloBaixo.toLowerCase()})`;
}

/** Variante de resultado da dimensão: nota (alta/baixa) × consenso (alto/baixo). Consenso médio usa o texto de consenso alto com ressalva. */
export function variante(d: InfoDimensao, media: number | null, dp: number | null): string | null {
  const n = nivel(media);
  const c = classificarConsenso(dp);
  if (!n || c === "indefinido") return null;
  const alto = n !== "baixo";
  const consensoBaixo = c === "baixo";
  const t = alto
    ? consensoBaixo ? d.variantes.altoConsensoBaixo : d.variantes.altoConsensoAlto
    : consensoBaixo ? d.variantes.baixoConsensoBaixo : d.variantes.baixoConsensoAlto;
  return c === "medio" ? `${t} (Atenção: consenso apenas médio — confirmar a leitura por área.)` : t;
}

// ---------------------------------------------------------------------------
// Cruzamentos entre dimensões (Guia, Parte III)
// ---------------------------------------------------------------------------

export interface Quadrante { nome: string; descricao: string; risco: string }
export interface Cruzamento {
  id: number;
  titulo: string;
  eixoX: CodigoDimensao; // primeira dimensão citada no Guia
  eixoY: CodigoDimensao; // segunda dimensão citada no Guia
  revela: string;
  /** chaves: "AA" (x alto, y alto), "AB" (x alto, y baixo), "BA", "BB" */
  quadrantes: Record<"AA" | "AB" | "BA" | "BB", Quadrante>;
  pergunta: string;
}

export const CRUZAMENTOS: Cruzamento[] = [
  {
    id: 1, titulo: "Como a empresa decide", eixoX: "PDI", eixoY: "UAI",
    revela: "O modelo de decisão: quem decide e com quanto processo.",
    quadrantes: {
      AA: { nome: "Burocracia hierárquica", descricao: "Decisão lenta, muitas aprovações, previsível e consistente. Segura, mas cara em tempo.", risco: "Lentidão extrema; desengajamento de quem espera aprovação." },
      AB: { nome: "Líder visionário", descricao: "Decisão rápida e concentrada no topo, pouca formalização.", risco: "Dependência de uma pessoa; paralisia se ela sai ou erra." },
      BA: { nome: "Processo participativo", descricao: "Decisão distribuída com método. Lenta, mas robusta e legitimada.", risco: "Robustez demais vira lentidão; decisões morrem." },
      BB: { nome: "Ágil improvisado", descricao: "Decisão rápida e espalhada, sem método. Veloz e adaptável.", risco: "Inconsistência; cada área decide de um jeito." },
    },
    pergunta: "As decisões são tomadas com processo e rapidez coerentes, ou a empresa vive o dilema entre lentidão burocrática e improviso acelerado?",
  },
  {
    id: 2, titulo: "Como a empresa reconhece", eixoX: "IDV", eixoY: "MAS",
    revela: "O sistema de reconhecimento e mérito: quem recebe crédito e com que intensidade competitiva.",
    quadrantes: {
      AA: { nome: "Meritocracia competitiva", descricao: "Estrelas individuais premiadas em alta competição. Alta performance.", risco: "Alta rotatividade; cooperação sacrificada; burnout." },
      AB: { nome: "Mérito cooperativo", descricao: "Reconhecimento individual em ambiente gentil.", risco: "Ambiguidade de critério; ninguém sabe o que gera reconhecimento." },
      BA: { nome: "Time competitivo", descricao: "Competição entre grupos; cada área briga pelo seu.", risco: "Silos fortes; rivalidade; perda do resultado consolidado." },
      BB: { nome: "Time cooperativo", descricao: "Alta coesão; crédito e metas coletivos.", risco: "Baixa tensão por resultado; acomodação." },
    },
    pergunta: "Quando alguém é reconhecido aqui, é pela entrega individual ou pelo resultado do time, e em ambiente competitivo ou cooperativo?",
  },
  {
    id: 3, titulo: "Como a empresa inova", eixoX: "UAI", eixoY: "LTO",
    revela: "O motor de inovação: quanto risco se tolera e com que horizonte.",
    quadrantes: {
      AA: { nome: "Inovação planejada", descricao: "P&D estruturado, ciclo longo, método. Boa para inovação incremental e regulada.", risco: "Lenta demais para o mercado; pouca disrupção." },
      AB: { nome: "Execução controlada", descricao: "Foco em entregar o trimestre com processo.", risco: "Quase nenhuma inovação; competitividade futura comprometida." },
      BA: { nome: "Aposta estratégica", descricao: "Tolerância a risco com horizonte longo.", risco: "Perfil de venture: aposta alto, exige paciência de caixa." },
      BB: { nome: "Reação tática", descricao: "Improviso de curto prazo, resposta rápida ao mercado.", risco: "Apagar incêndio permanente; nenhuma base de inovação." },
    },
    pergunta: "Qual perfil melhor descreve como a empresa inova hoje — e como deveria inovar? O que separa os dois?",
  },
  {
    id: 4, titulo: "Como a empresa trata pessoas", eixoX: "MAS", eixoY: "IVR",
    revela: "O trato das pessoas: quanto exigimos e quanto liberamos.",
    quadrantes: {
      AA: { nome: "Alta performance com autonomia", descricao: "Exigência alta e liberdade alta; ambiente de elite.", risco: "Ambiente de elite pode excluir; exigência gera pressão." },
      AB: { nome: "Pressão controlada", descricao: "Exigência alta com controle alto; cobra e vigia.", risco: "Risco alto de burnout e turnover; clima sufocante." },
      BA: { nome: "Ambiente acolhedor e leve", descricao: "Bem-estar e autonomia; clima bom e liberdade real.", risco: "Baixa accountability; resultado sacrificado pelo conforto." },
      BB: { nome: "Paternalista-controlador", descricao: "Cuidado com controle; protege, mas limita.", risco: "Baixa autonomia; retenção difícil." },
    },
    pergunta: "Na prática, a empresa cobra muito ou pouco, e confia muito ou pouco?",
  },
  {
    id: 5, titulo: "Como a empresa se comunica", eixoX: "PDI", eixoY: "IDV",
    revela: "O fluxo de comunicação: como a informação desce e como o mérito se distribui na fala.",
    quadrantes: {
      AA: { nome: "Descendente e personalista", descricao: "Informação desce e é retida como poder; quem a tem comanda.", risco: "Retenção como poder; comunicação filtrada." },
      AB: { nome: "Descendente e coletiva", descricao: "Informação desce, mas o mérito é do time.", risco: "Comunicação controlada pelo topo; pouca escuta." },
      BA: { nome: "Aberta e personalista", descricao: "Todos falam, mas cada um puxa para si.", risco: "Ruído; disputa de crédito; mensagens conflitantes." },
      BB: { nome: "Aberta e coletiva", descricao: "Fluxo livre com forte senso de time.", risco: "Cara de manter; vulnerável à informalidade sem cuidado." },
    },
    pergunta: "A informação flui livremente ou é retida por quem está acima? Quando flui, o crédito é do time ou de quem fala mais alto?",
  },
  {
    id: 6, titulo: "Como a empresa lida com mudança", eixoX: "UAI", eixoY: "PDI",
    revela: "Como a mudança é conduzida: quem anuncia e com quanto método.",
    quadrantes: {
      AA: { nome: "Por decreto estruturado", descricao: "O topo decide e cascateia com processo.", risco: "Funciona, mas lenta; pouca participação." },
      AB: { nome: "Participativa com método", descricao: "Consulta ampla e planejamento.", risco: "Lenta; canseira de reunião; decisão diluída." },
      BA: { nome: "Por decreto ágil", descricao: "Decisão rápida do topo, execução imediata.", risco: "Execução errática; mudanças não se sustentam." },
      BB: { nome: "Emergente", descricao: "Mudança surge de baixo, adapta-se.", risco: "Difícil de escalar; não vira prática da empresa." },
    },
    pergunta: "Quando a empresa muda algo importante, como anuncia e conduz? Por decreto, por processo, ou emergente? E isso funciona?",
  },
];

export function chaveQuadrante(x: number | null, y: number | null): "AA" | "AB" | "BA" | "BB" | null {
  if (x === null || y === null || x === undefined || y === undefined) return null;
  return `${x >= PONTO_MEDIO ? "A" : "B"}${y >= PONTO_MEDIO ? "A" : "B"}` as "AA" | "AB" | "BA" | "BB";
}

// ---------------------------------------------------------------------------
// Estruturas vindas do banco
// ---------------------------------------------------------------------------

export interface EstatDimensao {
  dimensao: CodigoDimensao;
  nome: string;
  ordem: number;
  n: number;
  media_hoje: number | null;
  dp_hoje: number | null;
  media_deveria: number | null;
  dp_deveria: number | null;
  gap: number | null;
  dp_gap: number | null;
}

export interface Alerta { tipo: "discurso_duplo" | "lideranca_dividida" | "amostra"; titulo: string; texto: string }

/** Cruzamentos 7 e 8 + alerta de amostra pequena. */
export function alertas(dims: EstatDimensao[], respondentes: number): Alerta[] {
  const out: Alerta[] = [];
  if (respondentes > 0 && respondentes < 5) {
    out.push({
      tipo: "amostra", titulo: "Poucos respondentes",
      texto: `Com ${respondentes} respondente(s), os resultados são apenas descritivos e o anonimato fica frágil. Evite apresentar este recorte isoladamente.`,
    });
  }
  const duplo = dims.filter((d) => classificarGap(d.gap) === "alto" && classificarConsenso(d.dp_hoje) === "baixo");
  for (const d of duplo) {
    out.push({
      tipo: "discurso_duplo", titulo: `Risco de discurso duplo — ${d.nome}`,
      texto: `Gap alto (${fmt(d.gap)}) com consenso baixo (DP ${fmt(d.dp_hoje)}). O que se declara e o que se pratica divergem, e o grupo não concorda sobre qual é a prática real — terreno de cinismo organizacional. Antes de qualquer ação, reconciliar discurso e prática. Pergunte: o que a empresa declara sobre essa dimensão e o que pratica de fato? ${DIM[d.dimensao].alerta}`,
    });
  }
  const dispersas = dims.filter((d) => classificarConsenso(d.dp_hoje) === "baixo");
  if (dispersas.length >= 3) {
    out.push({
      tipo: "lideranca_dividida", titulo: "Perfil de percepção dividida",
      texto: `${dispersas.length} dimensões com DP acima de 1,2 (${dispersas.map((d) => d.nome).join(", ")}). O grupo não compartilha um modelo mental da empresa. A prioridade não é agir sobre as dimensões, e sim conduzir sessões de ALINHAMENTO para construir um entendimento comum de como a empresa é hoje — apresente como convite ao consenso, não como veredito.`,
    });
  }
  return out;
}

export function fmt(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function fmtGap(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return (n > 0 ? "+" : "") + fmt(n);
}

/** Aviso antes do envio: mesma nota em (quase) todos os itens de uma coluna. Não revela nada sobre itens invertidos. */
export function detectarRespostaReta(valores: number[]): boolean {
  if (valores.length < 36) return false;
  const cont = new Map<number, number>();
  valores.forEach((v) => cont.set(v, (cont.get(v) ?? 0) + 1));
  return Math.max(...cont.values()) >= 34;
}

export const ROTULOS_FLAGS: Record<string, string> = {
  reta_hoje: "Resposta reta (É HOJE)",
  reta_deveria: "Resposta reta (DEVERIA SER)",
  alternada_hoje: "Resposta alternada (É HOJE)",
  alternada_deveria: "Resposta alternada (DEVERIA SER)",
  polarizada_hoje: "Polarizada (É HOJE)",
  polarizada_deveria: "Polarizada (DEVERIA SER)",
};

export const ORIENTACAO_FLAGS =
  "Resposta reta e alternada comprometem o dado: considere excluir o respondente e registrar o motivo. " +
  "Polarização pode ser um traço genuíno: registre e só exclua se o padrão se estender a todas as dimensões. " +
  "Contradição em 1 ou 2 itens é ruído normal; contradição em vários respondentes, sempre nos mesmos itens, sugere revisar a redação do item.";
