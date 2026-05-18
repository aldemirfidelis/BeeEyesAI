import { Platform } from "react-native";

let skiaWebPromise: Promise<void> | null = null;

/**
 * No iOS/Android nativo: Skia ja vem compilado. No-op.
 * No web: carrega canvaskit.wasm (servido em /canvaskit.wasm via public/).
 *
 * Idempotente — multiplas chamadas reutilizam a mesma promise.
 */
export function ensureSkiaWeb(): Promise<void> {
  if (Platform.OS !== "web") return Promise.resolve();
  if (skiaWebPromise) return skiaWebPromise;

  skiaWebPromise = (async () => {
    try {
      // Import dinâmico pra não quebrar bundling nativo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import("@shopify/react-native-skia/lib/module/web");
      await mod.LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" });
    } catch (err) {
      // Se falhar, registra mas não bloqueia (UI ainda funciona, só Canvas quebra)
      console.warn("[Bee] Falha carregando Skia web:", err);
    }
  })();

  return skiaWebPromise;
}
