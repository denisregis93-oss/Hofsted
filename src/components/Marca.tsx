import { useEffect, useState } from "react";

/** Marca do produto: anel de progresso + "Pesquisa Cultural" + "by Kapsula 360". */
export function Marca({ progresso = 0.36 }: { progresso?: number }) {
  const p = Math.max(0, Math.min(1, progresso)) * 100;
  return (
    <span className="marca" aria-label="Pesquisa Cultural, by Kapsula 360">
      <span className="anel" aria-hidden
        style={{ background: `conic-gradient(var(--primary) 0 ${p}%, var(--primary-soft) ${p}% 100%)` }} />
      <span className="nome"><b>Pesquisa Cultural</b><small>by Kapsula 360</small></span>
    </span>
  );
}

/** Logotipo do cliente (empresa avaliada). Sem imagem, mostra o nome. */
export function LogoCliente({ src, nome }: { src?: string | null; nome?: string }) {
  if (src) return <img className="logo-cliente" src={src} alt={nome ? `Logotipo ${nome}` : "Logotipo do cliente"} />;
  return nome ? <span className="logo-cliente texto">{nome}</span> : null;
}

/** Data e hora atuais (atualiza a cada 30 s). */
export function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return {
    data: agora.toLocaleDateString("pt-BR"),
    hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Cabeçalho fixo do participante: marca, e-mail, data/hora e pergunta atual. */
export function CabecalhoParticipante({ email, pergunta, total, progresso, children }: {
  email?: string; pergunta?: number; total?: number; progresso?: number; children?: React.ReactNode;
}) {
  const { data, hora } = useRelogio();
  return (
    <header className="cabecalho">
      <div className="linha1">
        <Marca progresso={progresso ?? 0} />
        <div className="chips">
          {email && <span className="chip" title="E-mail de quem está respondendo">{email}</span>}
          <span className="chip">{data} · {hora}</span>
          {pergunta !== undefined && total !== undefined && (
            <span className="chip destaque" aria-live="polite"><b>Pergunta {pergunta}</b> / {total}</span>
          )}
        </div>
      </div>
      {children && <div className="linha2">{children}</div>}
    </header>
  );
}
