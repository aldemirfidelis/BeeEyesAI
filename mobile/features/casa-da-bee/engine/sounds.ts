import { Audio } from "expo-av";

type SoundKey = "tap" | "collect" | "levelup" | "achievement" | "buy" | "error";

// Mapas com URIs publicas (sons curtos CC0). Para producao, embarcar como assets.
// Usamos sons inline base64 de "blip" simples; placeholder.
// Por ora desativado por padrao — soundConfig.enabled controla.
const soundConfig = {
  enabled: false,
};

const cache = new Map<SoundKey, Audio.Sound>();

export async function ensureAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {
    // ignora
  }
}

export async function play(key: SoundKey) {
  if (!soundConfig.enabled) return;
  try {
    const cached = cache.get(key);
    if (cached) {
      await cached.replayAsync();
      return;
    }
    // Sem assets embarcados ainda — silencioso até decidirmos qual lib/asset usar.
  } catch {
    // ignora
  }
}

export function setSoundsEnabled(enabled: boolean) {
  soundConfig.enabled = enabled;
}

export function areSoundsEnabled(): boolean {
  return soundConfig.enabled;
}
