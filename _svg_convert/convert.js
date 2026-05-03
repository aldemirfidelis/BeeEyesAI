const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const BASE = path.resolve(__dirname, "..");
const VISUAL = path.join(BASE, "mobile", "visual");
const ASSETS = path.join(BASE, "mobile", "assets");
const CLIENT_PUBLIC = path.join(BASE, "client", "public");

fs.mkdirSync(CLIENT_PUBLIC, { recursive: true });

function svgToPng(svgPath, outPath, width, height) {
  const rel = path.relative(BASE, outPath);
  console.log(`  ${path.basename(svgPath)} -> ${rel} (${width}x${height})`);
  const svg = fs.readFileSync(svgPath, "utf-8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outPath, pngBuffer);
}

function solidColorPng(outPath, width, height, r, g, b) {
  const rel = path.relative(BASE, outPath);
  console.log(`  (fundo sólido #${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}) -> ${rel} (${width}x${height})`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="rgb(${r},${g},${b})"/></svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const pngBuffer = resvg.render().asPng();
  fs.writeFileSync(outPath, pngBuffer);
}

console.log("\n=== Convertendo ícones do app mobile ===\n");

// icon.png — ícone principal iOS/Android — 1024x1024
svgToPng(
  path.join(VISUAL, "bee-eyes-icon-ios-1024.svg"),
  path.join(ASSETS, "icon.png"),
  1024, 1024
);

// favicon.png — 48x48
svgToPng(
  path.join(VISUAL, "bee-eyes-icon-pwa-192.svg"),
  path.join(ASSETS, "favicon.png"),
  48, 48
);

// splash-icon.png — 512x512
svgToPng(
  path.join(VISUAL, "bee-eyes-icon-ios-1024.svg"),
  path.join(ASSETS, "splash-icon.png"),
  512, 512
);

// android foreground — abelha transparente — 1024x1024
svgToPng(
  path.join(VISUAL, "bee-eyes-logo-transparent.svg"),
  path.join(ASSETS, "android-icon-foreground.png"),
  1024, 1024
);

// android monochrome — abelha transparente — 1024x1024
svgToPng(
  path.join(VISUAL, "bee-eyes-logo-transparent.svg"),
  path.join(ASSETS, "android-icon-monochrome.png"),
  1024, 1024
);

// android background — âmbar sólido (#FFD940) — 1024x1024
solidColorPng(path.join(ASSETS, "android-icon-background.png"), 1024, 1024, 255, 217, 64);

console.log("\n=== Convertendo assets para web (client/public) ===\n");

// PWA icons
svgToPng(
  path.join(VISUAL, "bee-eyes-icon-pwa-192.svg"),
  path.join(CLIENT_PUBLIC, "bee-icon-192.png"),
  192, 192
);

svgToPng(
  path.join(VISUAL, "bee-eyes-icon-android-512.svg"),
  path.join(CLIENT_PUBLIC, "bee-icon-512.png"),
  512, 512
);

// favicon 32x32
svgToPng(
  path.join(VISUAL, "bee-eyes-icon-pwa-192.svg"),
  path.join(CLIENT_PUBLIC, "favicon.png"),
  32, 32
);

// SVG logo — cópia direta para uso no web
fs.copyFileSync(
  path.join(VISUAL, "bee-eyes-logo-transparent.svg"),
  path.join(CLIENT_PUBLIC, "bee-logo.svg")
);
console.log(`  bee-eyes-logo-transparent.svg -> client/public/bee-logo.svg (cópia direta)`);

console.log("\n✅ Todos os assets convertidos!\n");
