// Registra o service worker da Bee PWA.
// Servido como arquivo separado pra passar pelo CSP (script-src 'self').
(function () {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function (err) {
      console.warn("[Bee] sw register fail", err);
    });
  });
})();
