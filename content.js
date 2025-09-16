// content.js
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const injectTempCSS = () => {
    const id = "__fpshot_css__";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      * { scroll-behavior: auto !important; }
      html, body { overflow-anchor: none !important; }
    `;
    document.documentElement.appendChild(style);
  };

  const removeTempCSS = () => {
    const el = document.getElementById("__fpshot_css__");
    if (el) el.remove();
  };

  const getMetrics = () => {
    const body = document.body;
    const html = document.documentElement;

    const fullWidth = Math.max(
      body.scrollWidth, html.scrollWidth,
      body.offsetWidth, html.offsetWidth,
      body.clientWidth, html.clientWidth
    );

    const fullHeight = Math.max(
      body.scrollHeight, html.scrollHeight,
      body.offsetHeight, html.offsetHeight,
      body.clientHeight, html.clientHeight
    );

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    return { fullWidth, fullHeight, viewportWidth, viewportHeight, dpr };
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === "FPSHOT_GET_METRICS") {
        injectTempCSS();
        sendResponse({ ok: true, metrics: getMetrics(), url: location.href });
      } else if (msg?.type === "FPSHOT_SCROLL_TO") {
        const y = Number(msg.y) || 0;
        window.scrollTo(0, y);
        await sleep(msg.delayMs ?? 150);
        sendResponse({ ok: true, y: window.scrollY });
      } else if (msg?.type === "FPSHOT_CLEANUP") {
        removeTempCSS();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Unknown message type" });
      }
    })();
    return true; 
  });
})();
