// background.js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Tidak ada tab aktif.");
  return tab;
}

async function askContent(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (res) => {
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

async function captureVisible() {
  return chrome.tabs.captureVisibleTab(undefined, { format: "png" });
}

async function startFullPageCapture() {
  const tab = await getActiveTab();

  const { metrics, url } = await askContent(tab.id, { type: "FPSHOT_GET_METRICS" });
  const {
    fullWidth, fullHeight, viewportWidth, viewportHeight, dpr
  } = metrics;

  const overlap = 50; // px
  const step = Math.max(1, viewportHeight - overlap);
  const positions = [];
  for (let y = 0; y < fullHeight; y += step) {
    positions.push(Math.min(y, fullHeight - viewportHeight));
  }
  // Pastikan posisi terakhir benar-benar mentok bawah
  if (positions[positions.length - 1] !== fullHeight - viewportHeight) {
    positions.push(Math.max(0, fullHeight - viewportHeight));
  }

  const parts = [];

  for (let i = 0; i < positions.length; i++) {
    const y = positions[i];
    await askContent(tab.id, { type: "FPSHOT_SCROLL_TO", y, delayMs: 180 });
    await sleep(80);
    const dataUrl = await captureVisible();
    parts.push({ y, dataUrl });
    chrome.runtime.sendMessage({
      type: "FPSHOT_PROGRESS",
      progress: Math.round(((i + 1) / positions.length) * 100)
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
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "FPSHOT_START") {
      try {
        await startFullPageCapture();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else {
      sendResponse({ ok: false, error: "Unknown message to background" });
    }
  })();
  return true; // async
});
