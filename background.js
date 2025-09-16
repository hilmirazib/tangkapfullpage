// background.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRestrictedUrl(url = "") {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("https://chromewebstore.google.com/") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("chrome://extensions") ||
    url.startsWith("chrome://newtab")
  );
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Tidak ada tab aktif.");
  return tab;
}

async function askContent(tabId, message, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("Timeout komunikasi dengan content script."));
      }
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (res) => {
      if (done) return;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!res?.ok) {
        reject(new Error(res?.error || "Content script error"));
      } else {
        resolve(res);
      }
    });
  });
}

async function ensureContent(tab) {
  try {
    await askContent(tab.id, { type: "FPSHOT_PING" }, 800);
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: ["content.js"],
    });
    await askContent(tab.id, { type: "FPSHOT_PING" }, 1200);
  }
}

/** ===== Rate limit handling ===== **/
let lastCaptureAt = 0;
let MIN_CAPTURE_INTERVAL = 1200; // ms
const MAX_MIN_INTERVAL = 3000;   // backoff maksimum

async function throttledCapture(windowId, attempt = 0) {
  const now = Date.now();
  const wait = Math.max(0, lastCaptureAt + MIN_CAPTURE_INTERVAL - now);
  if (wait > 0) await sleep(wait);

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastCaptureAt = Date.now();
    return dataUrl;
  } catch (e) {
    const msg = String(e?.message || "");
    if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/i.test(msg) || /throttle|rate/i.test(msg)) {
      MIN_CAPTURE_INTERVAL = Math.min(
        MAX_MIN_INTERVAL,
        Math.round(MIN_CAPTURE_INTERVAL * 1.5)
      );
      chrome.runtime.sendMessage({
        type: "FPSHOT_PROGRESS",
        progressNote: `Rate limit, slow mode (${MIN_CAPTURE_INTERVAL}ms)`,
      }).catch(() => {});
      await sleep(MIN_CAPTURE_INTERVAL);
      if (attempt < 4) return throttledCapture(windowId, attempt + 1);
    }
    throw e;
  }
}

/** ====== Optional zoom-out to reduce number of slices ====== */
async function withTempZoom(tabId, fn) {
  let original;
  try {
    original = await chrome.tabs.getZoom(tabId);
  } catch {
    original = 1;
  }
  const target = Math.min(original, 1); 
  if (target < original) {
    try { await chrome.tabs.setZoom(tabId, target); } catch {}
  }
  try {
    return await fn();
  } finally {
    if (target < original) {
      try { await chrome.tabs.setZoom(tabId, original); } catch {}
    }
  }
}

async function startFullPageCapture() {
  const tab = await getActiveTab();
  if (isRestrictedUrl(tab.url || "")) {
    throw new Error("Halaman ini dibatasi oleh Chrome (tidak bisa di-capture). Coba situs lain.");
  }

  await ensureContent(tab);

  return withTempZoom(tab.id, async () => {
    const { metrics, url } = await askContent(tab.id, { type: "FPSHOT_GET_METRICS" });
    const { fullWidth, fullHeight, viewportWidth, viewportHeight, dpr } = metrics;

    const overlap = 30;
    const step = Math.max(1, Math.floor(viewportHeight * 0.95) - overlap);

    const positions = [];
    for (let y = 0; y < fullHeight; y += step) {
      positions.push(Math.min(y, fullHeight - viewportHeight));
    }
    if (positions.at(-1) !== fullHeight - viewportHeight) {
      positions.push(Math.max(0, fullHeight - viewportHeight));
    }

    MIN_CAPTURE_INTERVAL = 1200;
    lastCaptureAt = 0;

    const parts = [];
    for (let i = 0; i < positions.length; i++) {
      const y = positions[i];
      await askContent(tab.id, { type: "FPSHOT_SCROLL_TO", y, delayMs: 260 });
      await sleep(140);

      const dataUrl = await throttledCapture(tab.windowId);
      parts.push({ y, dataUrl });

      const pct = Math.round(((i + 1) / positions.length) * 100);
      chrome.runtime.sendMessage({
        type: "FPSHOT_PROGRESS",
        progress: pct,
      }).catch(() => {});
    }

    await askContent(tab.id, { type: "FPSHOT_CLEANUP" }).catch(() => {});

    chrome.runtime.sendMessage({
      type: "FPSHOT_DONE",
      payload: {
        url,
        dpr,
        fullWidth,
        fullHeight,
        viewportWidth,
        viewportHeight,
        overlap,
        parts
      }
    }).catch(() => {});
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "FPSHOT_START") {
      try {
        await startFullPageCapture();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    } else {
      sendResponse({ ok: false, error: "Unknown message to background" });
    }
  })();
  return true;
});
