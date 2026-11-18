import { describe, expect, it } from "vitest";
import { alertas, chaveQuadrante, classificarConsenso, classificarGap, detectarRespostaReta, variante, DIM, type EstatDimensao } from "./metodologia";

describe("faixas do Guia do Aplicador", () => {
  it("consenso pelo desvio-padrão", () => {
    expect(classificarConsenso(0.79)).toBe("alto");
    expect(classificarConsenso(0.8)).toBe("medio");
    expect(classificarConsenso(1.2)).toBe("medio");
    expect(classificarConsenso(1.21)).toBe("baixo");
    expect(classificarConsenso(null)).toBe("indefinido");
  });
  it("gap em valor absoluto", () => {
    expect(classificarGap(0.4)).toBe("alinhado");
    expect(classificarGap(-0.41)).toBe("medio");
    expect(classificarGap(0.8)).toBe("medio");
    expect(classificarGap(-0.81)).toBe("alto");
  });
  it("quadrantes usam o ponto médio 3", () => {
    expect(chaveQuadrante(4, 2)).toBe("AB");
    expect(chaveQuadrante(2.9, 3)).toBe("BA");
    expect(chaveQuadrante(null, 3)).toBeNull();
  });
  it("variante: nota alta com consenso baixo", () => {
    expect(variante(DIM.PDI, 4, 1.5)).toBe(DIM.PDI.variantes.altoConsensoBaixo);
    expect(variante(DIM.PDI, 2, 0.5)).toBe(DIM.PDI.variantes.baixoConsensoAlto);
  });
});

describe("alertas (cruzamentos 7 e 8)", () => {
  const base = (d: string, gap: number, dp: number): EstatDimensao =>
    ({ dimensao: d as EstatDimensao["dimensao"], nome: d, ordem: 1, n: 10, media_hoje: 3, dp_hoje: dp, media_deveria: 3 + gap, dp_deveria: 0.5, gap, dp_gap: 0.5 });
  it("discurso duplo = gap alto + consenso baixo", () => {
    const a = alertas([base("PDI", 1.0, 1.3), base("IDV", 1.0, 0.5)], 10);
    expect(a.filter((x) => x.tipo === "discurso_duplo")).toHaveLength(1);
  });
  it("percepção dividida = 3+ dimensões com DP > 1,2", () => {
    const a = alertas([base("PDI", 0, 1.3), base("IDV", 0, 1.3), base("MAS", 0, 1.25)], 10);
    expect(a.some((x) => x.tipo === "lideranca_dividida")).toBe(true);
  });
});

describe("aviso de resposta reta", () => {
  it("detecta 34+ notas iguais", () => {
    expect(detectarRespostaReta(Array(36).fill(4))).toBe(true);
    expect(detectarRespostaReta([...Array(33).fill(4), 1, 2, 3])).toBe(false);
  });
});
