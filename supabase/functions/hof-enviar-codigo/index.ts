// Edge Function: gera o código de acesso (via RPC restrita ao service_role) e envia por e-mail (Resend).
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   — chave da API do Resend (https://resend.com)
//   EMAIL_REMETENTE  — ex.: "Pesquisa de Cultura <pesquisa@suaempresa.com.br>" (domínio verificado no Resend)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente pela plataforma.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "metodo_nao_permitido" }, 405);

  let codigo = "", email = "";
  try {
    const b = await req.json();
    codigo = String(b.codigo ?? "").trim();
    email = String(b.email ?? "").trim().toLowerCase();
  } catch {
    return json({ erro: "requisicao_invalida" }, 400);
  }
  if (!codigo || !email || email.length > 254) return json({ erro: "requisicao_invalida" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const remetente = Deno.env.get("EMAIL_REMETENTE");
  if (!resendKey || !remetente) return json({ situacao: "email_nao_configurado" }, 503);

  const rpc = await fetch(`${url}/rest/v1/rpc/hof_gerar_codigo`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_codigo: codigo, p_email: email }),
  });
  if (!rpc.ok) {
    console.error("rpc", rpc.status, await rpc.text());
    return json({ erro: "falha_interna" }, 500);
  }
  const r = await rpc.json();
  if (r.situacao !== "codigo_gerado") return json(r);

  const nome = escapar(r.nome ?? "");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <p>Olá${nome ? ", " + nome : ""}!</p>
      <p>Seu código para acessar a Pesquisa de Cultura Organizacional é:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:24px 0">${r.codigo}</p>
      <p>O código vale por 15 minutos e só pode ser usado uma vez.</p>
      <p style="color:#6b7280;font-size:13px">Se você não pediu este código, ignore esta mensagem.</p>
    </div>`;

  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [r.email],
      subject: `Seu código de acesso: ${r.codigo}`,
      html,
      text: `Seu código de acesso à Pesquisa de Cultura Organizacional: ${r.codigo} (válido por 15 minutos).`,
    }),
  });
  if (!envio.ok) {
    console.error("resend", envio.status, await envio.text());
    return json({ situacao: "falha_envio" }, 502);
  }
  return json({ situacao: "codigo_enviado" });
});
