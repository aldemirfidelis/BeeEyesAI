// Versão nativa: Skia já vem compilado no iOS/Android. No-op total.
// Metro resolve este arquivo automaticamente em vez de setupSkiaWeb.ts
// quando builda pra iOS ou Android, evitando que o caminho
// `@shopify/react-native-skia/lib/module/web` seja incluído no bundle.

export function ensureSkiaWeb(): Promise<void> {
  return Promise.resolve();
}
