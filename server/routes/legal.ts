import { Router } from "express";

/**
 * Rotas públicas para Política de Privacidade e Termos de Uso.
 * Servem HTML acessível e JSON. URL canônica usada no Play Console:
 *   GET /legal/privacy
 *   GET /legal/terms
 *
 * O texto canônico fica aqui; mobile e web mantêm cópias para exibição offline,
 * mas a versão oficial publicada é esta (servida pelo backend em produção).
 */

const PRIVACY_TITLE = "Política de Privacidade — BeeEyes";
const TERMS_TITLE = "Termos de Uso — BeeEyes";
const LAST_UPDATED = "maio de 2026";

const PRIVACY_BODY = `
A BeeEyes é uma plataforma social com assistente de inteligência artificial.
Coletamos dados de conta, perfil, publicações, comunidades, depoimentos, registros
de humor, interações sociais e conversas com a IA para autenticar usuários,
personalizar respostas, gerar alertas, manter segurança, entregar notificações e
melhorar o serviço.

DADOS COLETADOS

• Conta: nome de usuário, e-mail, senha (hash bcrypt), data de cadastro, idioma,
  preferências, identificador Google quando o login social é usado.
• Perfil: nome de exibição, biografia, gênero (opcional), avatar, cidade.
• Conteúdo: mensagens com a IA, posts no feed, posts em comunidades, comentários,
  depoimentos, mensagens diretas, registros de humor, notas e itens da lista de
  desejos. Conteúdos publicados ficam visíveis conforme o contexto do recurso.
• Calendário, alarmes, finanças e notas: dados que você cria nas ferramentas
  Colmeia. Quando você conecta o Google Calendar, recebemos os eventos sincronizados
  e armazenamos tokens de acesso para a integração funcionar.
• Uso: histórico de atividade, streak, XP, conquistas, notificações lidas.
• Dispositivo: token de push (Expo), idioma do sistema, localização aproximada
  quando habilitada para o briefing diário do clima.

COMO USAMOS

• Autenticação e segurança da conta.
• Personalização da assistente Bee, gerando respostas e sugestões baseadas no seu
  perfil, memórias e contexto.
• Notificações de alarmes, mensagens, eventos do calendário e dicas.
• Análise interna agregada para melhorar o serviço.

COMPARTILHAMENTO

Não vendemos dados pessoais. Compartilhamos com:
• Provedores de hospedagem (DigitalOcean) e banco de dados (Neon Postgres).
• Provedores de IA (OpenAI, Groq, Gemini, Cerebras) para gerar respostas.
  Trechos do seu histórico recente, perfil, memórias e a mensagem atual são
  enviados ao provedor para gerar a resposta. Esses provedores podem reter os
  dados conforme suas políticas — pseudonimizamos quando possível.
• Provedor de e-mail (Resend) para recuperação de senha.
• Google (login social, Calendar, push via FCM).
• Autoridades quando houver obrigação legal.

SEUS DIREITOS (LGPD)

Você pode solicitar acesso, correção, exclusão, portabilidade, revogação de
consentimento e informações sobre compartilhamento.
A exclusão da conta pode ser feita diretamente no app (Configurações → Excluir
conta), o que apaga seus dados pessoais. Conteúdos públicos compartilhados em
comunidades de terceiros podem permanecer com a referência removida.

ARMAZENAMENTO

• No servidor: PostgreSQL gerenciado (Neon), com backup automático e HTTPS.
• No dispositivo: armazenamento local seguro (SecureStore no mobile,
  localStorage no navegador) para sessão, tema, idioma e preferências.
• Não utilizamos cookies de rastreamento publicitário de terceiros.

SEGURANÇA

HTTPS obrigatório, senhas com hash bcrypt 12 rounds, JWT para autenticação,
isolamento de dados por usuário, monitoramento técnico. Nenhum sistema é
totalmente infalível; em incidentes relevantes, notificaremos os usuários
afetados conforme a lei.

MENORES DE IDADE

O BeeEyes é destinado a usuários com 13 anos ou mais. Menores de 18 anos
devem ter autorização de responsável legal.

ATUALIZAÇÕES

Podemos atualizar esta política para refletir mudanças no produto, na legislação
ou em fornecedores. O uso continuado após aviso de alterações relevantes indica
aceitação da nova versão.

CONTATO

Para exercer seus direitos LGPD ou tirar dúvidas, escreva para:
suporte@beeeyes.net
`.trim();

const TERMS_BODY = `
Ao criar conta ou usar o BeeEyes, você concorda com estes Termos e com a Política
de Privacidade. Se não concordar, não utilize o serviço.

O QUE É O BEEEYES

O BeeEyes oferece chat com IA, XP, medalhas, feed social, amizades, comunidades,
depoimentos, registros de humor, alertas e ferramentas de organização pessoal
(calendário, finanças, notas, alarmes). Esses recursos são motivacionais e
sociais; XP, medalhas e pontuações não possuem valor monetário.

ELEGIBILIDADE E CONTA

Você deve ter pelo menos 13 anos, manter suas credenciais em sigilo, fornecer
informações verdadeiras e usar o serviço de forma lícita.

CONDUTA PROIBIDA

É proibido publicar conteúdo ilegal, abusivo, discriminatório, enganoso, violento,
sexual explícito, que viole direitos de terceiros ou exponha dados pessoais sem
autorização. Também é proibido assediar usuários, enviar spam, manipular métricas,
usar bots, explorar falhas, tentar acessar contas alheias ou prejudicar a
infraestrutura.

SEU CONTEÚDO

Você mantém a titularidade do conteúdo que publica, mas concede ao BeeEyes
licença para hospedar, exibir, distribuir e adaptar esse conteúdo dentro da
plataforma e para operação do serviço. Podemos remover conteúdos que violem
estes Termos ou prejudiquem a comunidade.

ASSISTENTE DE IA

A assistente Bee gera respostas automaticamente e pode conter erros. Não tome
decisões importantes apenas com base na IA; procure profissionais qualificados
quando necessário (medicina, jurídico, financeiro, psicológico). Em situações
de crise emocional, procure ajuda imediata: CVV 188 (gratuito, 24h, no Brasil).

ANÚNCIOS

A BeeEyes pode exibir anúncios contextuais ("Patrocinado") no chat e em outras
áreas. Anúncios são claramente identificados. Você pode reduzir personalização
em Configurações → Anúncios.

SUSPENSÃO E ENCERRAMENTO

Podemos suspender ou encerrar contas em caso de violação destes Termos, risco a
usuários, ordem legal ou inatividade prolongada. O serviço é fornecido conforme
disponibilidade, sem garantia de funcionamento contínuo ou ausência de erros.

LIMITAÇÃO DE RESPONSABILIDADE

Na extensão permitida pela lei, o BeeEyes não se responsabiliza por danos
indiretos, perda de dados causada por terceiros, decisões tomadas com base na IA
ou conduta de outros usuários.

LEGISLAÇÃO

Estes Termos são regidos pelas leis brasileiras, incluindo Marco Civil da
Internet, Código de Defesa do Consumidor e LGPD.

CONTATO

Suporte: suporte@beeeyes.net
`.trim();

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(title: string, body: string): string {
  const escaped = escapeHtml(body)
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="robots" content="index,follow" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
    h1 { color: #c98700; }
    .meta { color: #777; font-size: 0.9rem; margin-bottom: 1.5rem; }
    p { margin: 0 0 1rem 0; }
    footer { color: #777; font-size: 0.85rem; margin-top: 3rem; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Última atualização: ${LAST_UPDATED}</p>
  ${escaped}
  <footer>BeeEyes © ${new Date().getFullYear()} · <a href="/legal/privacy">Privacidade</a> · <a href="/legal/terms">Termos</a></footer>
</body>
</html>`;
}

export function createLegalRouter() {
  const router = Router();

  router.get("/legal/privacy", (_req, res) => {
    res.type("html").send(renderHtml(PRIVACY_TITLE, PRIVACY_BODY));
  });

  router.get("/legal/privacy.json", (_req, res) => {
    res.json({ title: PRIVACY_TITLE, body: PRIVACY_BODY, lastUpdated: LAST_UPDATED });
  });

  router.get("/legal/terms", (_req, res) => {
    res.type("html").send(renderHtml(TERMS_TITLE, TERMS_BODY));
  });

  router.get("/legal/terms.json", (_req, res) => {
    res.json({ title: TERMS_TITLE, body: TERMS_BODY, lastUpdated: LAST_UPDATED });
  });

  return router;
}
