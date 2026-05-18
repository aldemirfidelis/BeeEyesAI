import { useBeePetStore } from "@mobile/stores/beePetStore";

import type { BeePetState } from "@mobile/stores/beePetStore";

interface ReactionRule {
  keywords: RegExp;
  speech: string;
  state?: BeePetState;
  durationMs?: number;
}

const RULES: ReactionRule[] = [
  // gratidao + felicidade
  {
    keywords: /\b(obrigad[ao]?|valeu|brigado|brigada|tmj|amo|love|adoro|incrivel|maneiro|otim[oa]|legal)\b/i,
    speech: "Aaaai, que fofo! 💛",
    state: "happy",
  },
  // tristeza / cansaço
  {
    keywords: /\b(triste|cansad[ao]|chate[ai]?d[ao]|deprimid[ao]|sad|exhaust|burn)\b/i,
    speech: "To aqui contigo... 🤗",
    state: "thinking",
  },
  // saudacao
  {
    keywords: /\b(oi|ola|olá|bom dia|boa tarde|boa noite|hi|hello)\b/i,
    speech: "Oi! Tava te esperando! 🐝",
    state: "happy",
  },
  // duvida
  {
    keywords: /\b(como|porque|por que|por quê|what|why|how)\b/i,
    speech: "Hmm, deixa eu pensar... 💭",
    state: "thinking",
  },
  // celebração
  {
    keywords: /\b(consegui|ganhei|win|venci|passou|aprovad[ao]|funciono|deu certo|finally|finalmente)\b/i,
    speech: "Eba! Vamos comemorar! 🎉",
    state: "celebrating",
  },
  // sono
  {
    keywords: /\b(sono|dormir|cansei|fui dormir|good night|boa noite hora)\b/i,
    speech: "Dorme bem 💤",
    state: "sleeping",
  },
];

/**
 * Reage ao texto do user no chat: dispara emocao + fala no PetStore.
 * Chamado quando user envia mensagem.
 */
export function reactToChatMessage(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  for (const rule of RULES) {
    if (rule.keywords.test(trimmed)) {
      const store = useBeePetStore.getState();
      // so reage se nao estiver ocupada com task ativa
      if (!store.isWorking) {
        if (rule.state) store.setBeeState(rule.state);
        store.speak(rule.speech, rule.durationMs ?? 4000);
      } else {
        // se estiver trabalhando, so fala
        store.speak(rule.speech, rule.durationMs ?? 3500);
      }
      return true;
    }
  }
  return false;
}
