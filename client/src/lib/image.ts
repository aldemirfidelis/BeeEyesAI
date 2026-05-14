// Accepted formats (Instagram-like rules)
export const FEED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/bmp,image/gif";
const ACCEPTED_FEED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"];

const DEFAULT_MAX_SIDE = 1080;
const DEFAULT_QUALITY = 0.80;

export function isAcceptedFeedImage(file: File): boolean {
  return ACCEPTED_FEED_IMAGE_TYPES.includes(file.type);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Não foi possível ler a imagem."));
    };
    reader.readAsDataURL(file);
  });
}

export async function fileToCompressedDataUrl(file: File, maxSide = DEFAULT_MAX_SIDE, quality = DEFAULT_QUALITY): Promise<string> {
  if (!ACCEPTED_FEED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Use JPEG, PNG, WebP, BMP ou GIF.");
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
    const scale = longerSide > maxSide ? maxSide / longerSide : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
