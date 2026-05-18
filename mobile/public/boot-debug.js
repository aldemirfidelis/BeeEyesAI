// Boot debugger — captura erros de JS e mostra direto na tela quando o React
// nao consegue montar. Roda antes do bundle principal. Auto-some se a app
// renderizar dentro de 8s (assume sucesso).
(function () {
  if (typeof window === "undefined") return;

  // Cria container visivel
  function makeBox() {
    var box = document.createElement("div");
    box.id = "bee-boot-debug";
    box.style.cssText = [
      "position:fixed",
      "left:8px",
      "right:8px",
      "bottom:8px",
      "max-height:60vh",
      "overflow:auto",
      "z-index:99999",
      "background:#22150b",
      "color:#fff",
      "font:11px/1.4 monospace",
      "padding:10px",
      "border-radius:10px",
      "border:2px solid #ec5c5c",
      "box-shadow:0 6px 24px rgba(0,0,0,0.4)",
      "display:none",
    ].join(";");
    var title = document.createElement("div");
    title.style.cssText = "color:#fbcb45;font-weight:900;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px";
    title.textContent = "🐝 Bee debug — capturas (toque pra ocultar)";
    box.appendChild(title);
    var log = document.createElement("div");
    log.id = "bee-boot-debug-log";
    box.appendChild(log);
    box.addEventListener("click", function () { box.style.display = "none"; });
    return box;
  }

  function append(text) {
    var box = document.getElementById("bee-boot-debug");
    if (!box) {
      box = makeBox();
      (document.body || document.documentElement).appendChild(box);
    }
    box.style.display = "block";
    var log = document.getElementById("bee-boot-debug-log");
    var line = document.createElement("div");
    line.style.cssText = "margin:4px 0;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.1);white-space:pre-wrap;word-break:break-word";
    line.textContent = "[" + new Date().toLocaleTimeString() + "] " + text;
    log.appendChild(line);
  }

  window.addEventListener("error", function (e) {
    var msg = e.message || "Erro sem mensagem";
    var src = e.filename || "";
    var line = e.lineno ? ":" + e.lineno : "";
    append("ERRO: " + msg + "\n  em " + src + line);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var msg = "";
    try {
      msg = e.reason && (e.reason.stack || e.reason.message || String(e.reason));
    } catch (_) { msg = "Promise rejection sem mensagem"; }
    append("PROMISE REJEITADA: " + msg);
  });

  // Detecta se o React montou: depois de 8s, se o #root ainda estiver vazio,
  // mostra mensagem visivel.
  setTimeout(function () {
    var root = document.getElementById("root");
    if (!root || root.children.length === 0) {
      append("React nao montou em 8s — #root vazio. Possivel erro acima OU bundle JS travado.");
    } else {
      // App montou, remove o debug visualmente se nao houve erro
      var box = document.getElementById("bee-boot-debug");
      if (box && (!document.getElementById("bee-boot-debug-log").children.length)) {
        box.remove();
      }
    }
  }, 8000);
})();
