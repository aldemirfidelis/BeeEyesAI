// Boot debugger + nuke button — mata SWs antigos e limpa todas as caches.
(function () {
  if (typeof window === "undefined") return;
  var startTs = Date.now();

  function ts() { return ((Date.now() - startTs) / 1000).toFixed(2) + "s"; }

  function makeBox() {
    var box = document.createElement("div");
    box.id = "bee-boot-debug";
    box.style.cssText = [
      "position:fixed",
      "left:8px","right:8px","bottom:8px",
      "max-height:70vh","overflow:auto","z-index:99999",
      "background:#22150b","color:#fff","font:11px/1.35 monospace",
      "padding:10px","border-radius:10px","border:2px solid #ec5c5c",
      "box-shadow:0 6px 24px rgba(0,0,0,0.5)",
    ].join(";");
    var title = document.createElement("div");
    title.style.cssText = "color:#fbcb45;font-weight:900;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;display:flex;justify-content:space-between;align-items:center";
    title.innerHTML = "🐝 BEE DEBUG";

    var nukeBtn = document.createElement("button");
    nukeBtn.textContent = "🔥 LIMPAR TUDO + RECARREGAR";
    nukeBtn.style.cssText = "background:#ec5c5c;color:#fff;border:none;padding:8px 12px;border-radius:8px;font-weight:900;font-size:11px;margin-bottom:8px;width:100%;cursor:pointer";
    nukeBtn.onclick = nukeEverything;

    box.appendChild(title);
    box.appendChild(nukeBtn);

    var log = document.createElement("div");
    log.id = "bee-boot-debug-log";
    box.appendChild(log);
    return box;
  }

  function append(text, color) {
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

  async function nukeEverything() {
    append("🔥 INICIANDO LIMPEZA TOTAL...", "#fbcb45");
    try {
      // 1. Unregister TODOS os SWs
      if ("serviceWorker" in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        append("SWs ativos: " + regs.length, "#fbcb45");
        for (var i = 0; i < regs.length; i++) {
          var ok = await regs[i].unregister();
          append("Unregister " + regs[i].scope + ": " + (ok ? "OK" : "FAIL"));
        }
      }
      // 2. Apaga TODAS as caches
      if ("caches" in window) {
        var keys = await caches.keys();
        append("Caches: " + keys.join(", "), "#fbcb45");
        for (var k of keys) {
          await caches.delete(k);
          append("Delete cache " + k + ": OK");
        }
      }
      // 3. Limpa localStorage + sessionStorage
      try { localStorage.clear(); append("localStorage clear: OK"); } catch (e) {}
      try { sessionStorage.clear(); append("sessionStorage clear: OK"); } catch (e) {}
      append("✓ Limpeza completa. Recarregando em 1s...", "#5fc775");
      setTimeout(function () { location.reload(); }, 1000);
    } catch (err) {
      append("ERRO na limpeza: " + (err && err.message || err), "#ff5a5a");
    }
  }

  // Intercepta console
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
        try { return typeof a === "string" ? a : JSON.stringify(a).slice(0, 200); } catch (_) { return String(a); }
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

  // Boot
  append("Boot ativo. " + navigator.userAgent.split(") ")[1] || navigator.userAgent.slice(0, 50), "#9ccaff");

  // Lista SWs ja registrados (provavel suspeito)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      if (regs.length === 0) {
        append("✓ Nenhum SW registrado.", "#5fc775");
      } else {
        regs.forEach(function (r) {
          append("⚠ SW ativo: " + r.scope + " (state: " + (r.active && r.active.state || "?") + ")", "#ff8a4a");
        });
      }
      // Tambem lista caches
      if ("caches" in window) {
        caches.keys().then(function (keys) {
          if (keys.length) append("⚠ Caches: " + keys.join(", "), "#ff8a4a");
          else append("✓ Sem caches.", "#5fc775");
        });
      }
    });
  }

  // Verifica entry script
  setTimeout(function () {
    var entryScript = document.querySelector('script[src*="entry-"]');
    if (entryScript) {
      append("entry tag: " + entryScript.src.split("/").pop().slice(0, 50), "#9ccaff");
    } else {
      append("⚠ entry script TAG AUSENTE no HTML!", "#ff5a5a");
    }
  }, 300);

  // Monitor periodico
  var lastReport = 0;
  var interval = setInterval(function () {
    var root = document.getElementById("root");
    var mounted = root && root.children.length > 0;
    var bundleStarted = typeof __BUNDLE_START_TIME__ !== "undefined";
    if (mounted) {
      append("✓ React montou (" + ts() + ")", "#5fc775");
      clearInterval(interval);
      setTimeout(function () {
        var box = document.getElementById("bee-boot-debug");
        if (box) box.style.display = "none";
      }, 2500);
    } else if (Date.now() - startTs - lastReport > 3500) {
      lastReport = Date.now() - startTs;
      append("status: bundle=" + (bundleStarted ? "EXEC" : "NAO RODOU") + " root.children=" + (root ? root.children.length : "0"));
      if (Date.now() - startTs > 15000) {
        if (!bundleStarted) {
          append("⚠ BUNDLE NUNCA EXECUTOU. Toca em 🔥 LIMPAR TUDO acima.", "#ff5a5a");
        } else {
          append("⚠ Bundle exec mas React nao montou. Algum erro silencioso.", "#ff5a5a");
        }
        clearInterval(interval);
      }
    }
  }, 1000);
})();
