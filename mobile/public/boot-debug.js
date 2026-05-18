// Boot debugger agressivo — captura tudo que possa indicar por que o React não monta.
(function () {
  if (typeof window === "undefined") return;
  var startTs = Date.now();
  var logs = [];

  function ts() { return ((Date.now() - startTs) / 1000).toFixed(2) + "s"; }

  function makeBox() {
    var box = document.createElement("div");
    box.id = "bee-boot-debug";
    box.style.cssText = [
      "position:fixed",
      "left:8px","right:8px","bottom:8px",
      "max-height:65vh","overflow:auto","z-index:99999",
      "background:#22150b","color:#fff","font:11px/1.35 monospace",
      "padding:10px","border-radius:10px","border:2px solid #ec5c5c",
      "box-shadow:0 6px 24px rgba(0,0,0,0.5)",
    ].join(";");
    var title = document.createElement("div");
    title.style.cssText = "color:#fbcb45;font-weight:900;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;display:flex;justify-content:space-between";
    title.innerHTML = "🐝 BEE DEBUG <span style='color:#fff;font-size:10px;font-weight:600'>tap pra fechar</span>";
    box.appendChild(title);
    var log = document.createElement("div");
    log.id = "bee-boot-debug-log";
    box.appendChild(log);
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target === title) box.style.display = "none";
    });
    return box;
  }

  function append(text, color) {
    logs.push(text);
    var box = document.getElementById("bee-boot-debug");
    if (!box) { box = makeBox(); (document.body || document.documentElement).appendChild(box); }
    box.style.display = "block";
    var log = document.getElementById("bee-boot-debug-log");
    var line = document.createElement("div");
    line.style.cssText = "margin:3px 0;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:pre-wrap;word-break:break-word";
    if (color) line.style.color = color;
    line.textContent = "[" + ts() + "] " + text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // Intercepta console.error/warn/log para registrar no overlay também
  var origErr = console.error.bind(console);
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        try { return typeof a === "string" ? a : JSON.stringify(a).slice(0, 300); } catch (_) { return String(a); }
      }).join(" ");
      append("console.error: " + args, "#ff8a8a");
    } catch (_) {}
    return origErr.apply(console, arguments);
  };

  var origWarn = console.warn.bind(console);
  console.warn = function () {
    try {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        try { return typeof a === "string" ? a : JSON.stringify(a).slice(0, 300); } catch (_) { return String(a); }
      }).join(" ");
      append("console.warn: " + args, "#ffd95b");
    } catch (_) {}
    return origWarn.apply(console, arguments);
  };

  window.addEventListener("error", function (e) {
    var src = e.filename || "";
    var line = e.lineno ? ":" + e.lineno : "";
    append("ERROR: " + (e.message || "?") + (src ? "\n  em " + src + line : ""), "#ff5a5a");
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var msg = "?";
    try { msg = (e.reason && (e.reason.stack || e.reason.message || String(e.reason))) || "?"; } catch (_) {}
    append("PROMISE REJEITADA: " + String(msg).slice(0, 400), "#ff8a4a");
  });

  // Detecta start do bundle JS
  append("Boot debug ativo. UA: " + navigator.userAgent.slice(0, 80), "#9ccaff");
  append("Aguardando bundle entry... (ate 12s)", "#9ccaff");

  // Verifica se entry script carregou
  setTimeout(function () {
    var entryScript = document.querySelector('script[src*="entry-"]');
    if (entryScript) {
      append("entry script TAG presente: " + entryScript.src.split("/").pop().slice(0, 60), "#9ccaff");
    } else {
      append("entry script TAG ausente!", "#ff5a5a");
    }
  }, 500);

  // Estado periodico
  var lastReport = 0;
  var interval = setInterval(function () {
    var root = document.getElementById("root");
    var mounted = root && root.children.length > 0;
    if (mounted) {
      append("✓ React montou! (" + ts() + ")", "#5fc775");
      clearInterval(interval);
      // App OK — esconde overlay 2s depois
      setTimeout(function () {
        var box = document.getElementById("bee-boot-debug");
        if (box) box.style.display = "none";
      }, 2000);
    } else {
      // Reporta status a cada 4s ate 16s
      if (Date.now() - startTs - lastReport > 4000) {
        lastReport = Date.now() - startTs;
        append("Aguardando... root.children=" + (root ? root.children.length : "0") + " bundle=" + (typeof __BUNDLE_START_TIME__ !== "undefined" ? "exec" : "?"));
        if (Date.now() - startTs > 16000) {
          append("Timeout 16s. Bundle nao executou ou travou.", "#ff5a5a");
          clearInterval(interval);
        }
      }
    }
  }, 1000);
})();
