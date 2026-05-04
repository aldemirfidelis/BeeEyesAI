// Accepted formats (Instagram-like rules)
export const FEED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/bmp";

const MAX_SIDE = 1080;
const QUALITY = 0.80;

export async function fileToCompressedDataUrl(file: File, _maxWidth?: number, _quality?: number): Promise<string> {
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/bmp", "image/gif"];
  if (!acceptedTypes.some((t) => file.type === t || file.type.startsWith("image/"))) {
    throw new Error("Formato não suportado. Use JPEG, PNG, WebP ou HEIC.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = objectUrl;
    });

    // Resize keeping aspect ratio — max side = 1080px (Instagram rule)
    const longerSide = Math.max(img.width, img.height);
    const scale = longerSide > MAX_SIDE ? MAX_SIDE / longerSide : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
