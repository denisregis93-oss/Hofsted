export interface LinhaParticipante { email: string; nome?: string; departamento?: string }

/**
 * Interpreta a lista colada: um participante por linha.
 * Aceita só o e-mail ("ana@empresa.com") ou "Nome; e-mail; Departamento" (também separado por tabulação,
 * como ao colar do Excel). Linhas com vários e-mails soltos também funcionam.
 */
export function interpretarLista(texto: string): LinhaParticipante[] {
  const out: LinhaParticipante[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const partes = linha.split(/[;\t]/).map((x) => x.trim()).filter(Boolean);
    if (partes.length === 3 && partes.filter((x) => x.includes("@")).length === 1) {
      const iEmail = partes.findIndex((x) => x.includes("@"));
      const resto = partes.filter((_, i) => i !== iEmail);
      out.push({ email: partes[iEmail], nome: resto[0], departamento: resto[1] });
      continue;
    }
    for (const e of linha.split(/[\s,;]+/).filter(Boolean)) out.push({ email: e });
  }
  return out;
}
