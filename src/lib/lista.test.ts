import { describe, expect, it } from "vitest";
import { interpretarLista } from "./lista";

describe("interpretarLista", () => {
  it("um e-mail por linha, ignorando linhas vazias", () => {
    expect(interpretarLista("ana@x.com\n\n  bia@x.com  \r\n")).toEqual([{ email: "ana@x.com" }, { email: "bia@x.com" }]);
  });
  it("vários e-mails na mesma linha separados por vírgula, ponto e vírgula ou espaço", () => {
    expect(interpretarLista("a@x.com, b@x.com; c@x.com d@x.com").map((l) => l.email)).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
  });
  it("nome; e-mail; departamento", () => {
    expect(interpretarLista("João Lima; joao@x.com; Comercial")).toEqual([{ email: "joao@x.com", nome: "João Lima", departamento: "Comercial" }]);
  });
  it("colado do Excel (tabulação)", () => {
    expect(interpretarLista("Maria\tmaria@x.com\tTI")).toEqual([{ email: "maria@x.com", nome: "Maria", departamento: "TI" }]);
  });
});
