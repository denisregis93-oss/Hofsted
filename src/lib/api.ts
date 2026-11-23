import { supabase } from "./supabase";
import type { CodigoDimensao, EstatDimensao } from "./metodologia";

const MENSAGENS: Record<string, string> = {
  acesso_negado: "Seu usuário não tem acesso à área administrativa.",
  sessao_expirada: "Sua sessão expirou. Informe o e-mail novamente para receber um novo código.",
  ja_respondeu: "Você já respondeu esta pesquisa.",
  pesquisa_fora_do_prazo: "A pesquisa não está aberta no momento.",
  respostas_incompletas: "Responda todas as 36 afirmações nas duas colunas.",
  recibo_invalido: "Código pessoal não encontrado para esta pesquisa.",
};

export function mensagemErro(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  for (const k of Object.keys(MENSAGENS)) if (msg.includes(k)) return MENSAGENS[k];
  return msg;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------------- Participante ----------------
export type Situacao =
  | "pesquisa_inexistente" | "nao_cadastrado" | "nao_elegivel" | "nao_iniciada"
  | "encerrada_respondeu" | "encerrada_nao_respondeu" | "ja_respondeu" | "pode_responder";

export interface InfoPesquisa {
  titulo: string; descricao: string | null; empresa_nome: string; inicio: string; fim: string;
  status: "agendada" | "aberta" | "encerrada"; responsavel_nome: string; responsavel_email: string;
  coletar_hoje: boolean; coletar_deveria: boolean; cliente_logo?: string | null;
}
export interface RespostaAcesso {
  situacao: Situacao; inicio?: string; fim?: string; nome?: string; respondeu_em?: string | null;
  responsavel_nome?: string; responsavel_email?: string;
}
export interface Questionario {
  pesquisa: { titulo: string; empresa_nome: string; fim: string; responsavel_nome: string; responsavel_email: string; coletar_hoje: boolean; coletar_deveria: boolean; cliente_logo?: string | null };
  partes: { ordem: number; nome: string; descricao: string; itens: { numero: number; texto: string }[] }[];
}
export interface RelatorioIndividual {
  pesquisa: { titulo: string; empresa_nome: string; fim: string; status: string; coletar_hoje: boolean; coletar_deveria: boolean; cliente_logo?: string | null };
  departamento: string;
  meu: { dimensao: CodigoDimensao; hoje: number | null; deveria: number | null; gap: number | null }[];
  departamento_media: EstatDimensao[];
  empresa_media: EstatDimensao[];
}

export const participante = {
  info: (codigo: string) => rpc<InfoPesquisa | null>("hof_info_pesquisa", { p_codigo: codigo }),
  verificar: (codigo: string, email: string) => rpc<RespostaAcesso>("hof_verificar_acesso", { p_codigo: codigo, p_email: email }),
  minhasPesquisas: (email: string) =>
    rpc<{ cadastrado: boolean; nome?: string; pesquisas: (RespostaAcesso & { codigo: string; titulo: string; empresa_nome: string })[] }>(
      "hof_minhas_pesquisas", { p_email: email }),
  iniciar: (codigo: string, email: string) =>
    rpc<Omit<RespostaAcesso, "situacao"> & { situacao: Situacao | "ok"; token?: string }>("hof_iniciar", { p_codigo: codigo, p_email: email }),
  questionario: (token: string) => rpc<Questionario>("hof_questionario", { p_token: token }),
  enviar: (token: string, itens: { item: number; hoje?: number; deveria?: number }[], a1: string, a2: string) =>
    rpc<{ recibo: string }>("hof_enviar_respostas", { p_token: token, p_itens: itens, p_aberta_1: a1, p_aberta_2: a2 }),
  relatorio: (codigo: string, recibo: string) => rpc<RelatorioIndividual>("hof_relatorio_individual", { p_codigo: codigo, p_recibo: recibo }),
};

// ---------------- Administração ----------------
export interface Pesquisa {
  id: string; codigo: string; titulo: string; descricao: string | null; empresa_nome: string;
  inicio: string; fim: string; responsavel_nome: string; responsavel_email: string;
  status: "agendada" | "aberta" | "encerrada"; elegiveis: number; respondentes: number;
  coletar_hoje: boolean; coletar_deveria: boolean; publico: "todos" | "lista"; cliente_logo?: string | null;
}
export interface ResultadoParticipantes {
  incluidos: number; ja_estavam: number; cadastrados: number;
  erros: { linha: number; email: string | null; erro: string }[];
}
export interface Funcionario { id: string; nome: string; email: string; departamento_id: string; departamento: string; ativo: boolean }
export interface Departamento { id: string; nome: string; funcionarios_ativos: number }
export interface ResultadoImportacao {
  linhas: number; inseridos: number; atualizados: number; inativados: number;
  erros: { linha: number; email: string | null; erro: string }[];
}
export interface Relatorio {
  respondentes: number; excluidas: number; elegiveis: number;
  dimensoes: EstatDimensao[];
  itens: { numero: number; dimensao: CodigoDimensao; texto: string; n: number; media_hoje: number | null; dp_hoje: number | null; media_deveria: number | null; dp_deveria: number | null }[];
}
export interface Acompanhamento {
  departamentos: { departamento_id: string; departamento: string; elegiveis: number; respondentes: number }[];
  pendentes: { nome: string; email: string; departamento: string }[];
  participantes: { nome: string; email: string; departamento: string; respondeu: boolean }[];
}
export interface ItemQualidade {
  resposta_id: string; rotulo: string; departamento: string; excluida: boolean; motivo_exclusao: string | null;
  flags: Record<string, unknown> & { contradicoes?: { dimensao: CodigoDimensao; eixo: string }[] };
}

export const admin = {
  souAdmin: () => rpc<boolean>("hof_sou_admin"),
  importar: (linhas: { nome: string; email: string; departamento: string }[], inativarAusentes: boolean) =>
    rpc<ResultadoImportacao>("hof_importar_funcionarios", { p_linhas: linhas, p_inativar_ausentes: inativarAusentes }),
  funcionarios: () => rpc<Funcionario[]>("hof_listar_funcionarios"),
  definirAtivo: (id: string, ativo: boolean) => rpc<void>("hof_definir_funcionario_ativo", { p_id: id, p_ativo: ativo }),
  departamentos: () => rpc<Departamento[]>("hof_listar_departamentos"),
  pesquisas: () => rpc<Pesquisa[]>("hof_listar_pesquisas"),
  salvarPesquisa: (p: Partial<Pesquisa>) => rpc<string>("hof_salvar_pesquisa", { p }),
  excluirPesquisa: (id: string) => rpc<void>("hof_excluir_pesquisa", { p_pesquisa: id }),
  atualizarElegiveis: (id: string) => rpc<number>("hof_atualizar_elegiveis", { p_pesquisa: id }),
  adicionarParticipantes: (id: string, linhas: LinhaParticipante[]) =>
    rpc<ResultadoParticipantes>("hof_adicionar_participantes", { p_pesquisa: id, p_linhas: linhas }),
  removerParticipante: (id: string, email: string) => rpc<void>("hof_remover_participante", { p_pesquisa: id, p_email: email }),
  acompanhamento: (id: string) => rpc<Acompanhamento>("hof_acompanhamento", { p_pesquisa: id }),
  relatorio: (id: string, dep: string | null) => rpc<Relatorio>("hof_relatorio", { p_pesquisa: id, p_departamento: dep }),
  compararDepartamentos: (id: string) =>
    rpc<{ departamento_id: string; departamento: string; dimensoes: EstatDimensao[] }[]>("hof_comparar_departamentos", { p_pesquisa: id }),
  evolucao: (dep: string | null) =>
    rpc<{ pesquisa_id: string; titulo: string; inicio: string; coletar_hoje: boolean; coletar_deveria: boolean; dimensoes: EstatDimensao[] }[]>("hof_evolucao", { p_departamento: dep }),
  qualidade: (id: string) => rpc<ItemQualidade[]>("hof_qualidade", { p_pesquisa: id }),
  definirExclusao: (resposta: string, excluir: boolean, motivo: string | null) =>
    rpc<void>("hof_definir_exclusao", { p_resposta: resposta, p_excluir: excluir, p_motivo: motivo }),
  abertas: (id: string, dep: string | null) => rpc<{ pergunta: number; texto: string }[]>("hof_respostas_abertas", { p_pesquisa: id, p_departamento: dep }),
  exportarBase: (id: string) => rpc<Record<string, unknown>[]>("hof_exportar_base", { p_pesquisa: id }),
};

export { interpretarLista, type LinhaParticipante } from "./lista";
import type { LinhaParticipante } from "./lista";

export function fmtData(iso: string | null | undefined, comHora = false): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleString("pt-BR", comHora
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}
