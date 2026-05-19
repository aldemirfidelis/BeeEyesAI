// Declaração de tipo pra TypeScript reconhecer o módulo. Metro resolve em runtime
// entre setupSkiaWeb.native.ts (no-op no iOS/Android) e setupSkiaWeb.web.ts
// (carrega canvaskit.wasm). Esse .d.ts só serve pra tsc não reclamar.

export function ensureSkiaWeb(): Promise<void>;
