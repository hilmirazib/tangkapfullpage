// popup.js
const btnStart = document.getElementById("btnStart");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const previewWrap = document.getElementById("previewWrap");
const resultCanvas = document.getElementById("resultCanvas");
const btnDownload = document.getElementById("btnDownload");
const errorEl = document.getElementById("error");

let lastCompositeBlobUrl = null;

(function guardNotWebpage() {
  // Kalau popup.html dibuka sebagai halaman biasa, chrome.runtime bisa tidak ada
  if (!window.chrome || !chrome.runtime || !chrome.runtime.id) {
    showError(
      "Ini halaman popup ekstensi. Jangan dibuka langsung di tab.\n" +
      "Gunakan ikon ekstensi di toolbar (klik ikon → popup ini muncul)."
    );
  }
})();

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function resetUI() {
  errorEl.classList.add("hidden");
  statusEl.textContent = "";
  progressWrap.classList.add("hidden");
  progressBar.style.width = "0%";
  previewWrap.classList.add("hidden");
  btnStart.disabled = false;
  if (lastCompositeBlobUrl) {
    URL.revokeObjectURL(lastCompositeBlobUrl);
    lastCompositeBlobUrl = null;
  }
}

btnStart.addEventListener("click", async () => {
  resetUI();
  statusEl.textContent = "Menyiapkan...";
  progressWrap.classList.remove("hidden");
  btnStart.disabled = true;

  try {
    const res = await chrome.runtime.sendMessage({ type: "FPSHOT_START" });
    if (!res?.ok) throw new Error(res?.error || "Gagal memulai capture");
    statusEl.textContent = "Mulai capture...";
  } catch (e) {
    btnStart.disabled = false;
    showError(e?.message || "Gagal memulai capture");
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "FPSHOT_PROGRESS") {
    const p = Math.max(0, Math.min(100, Number(msg.progress) || 0));
    progressBar.style.width = `${p}%`;
    statusEl.textContent = `Mengambil... ${p}%`;
  } else if (msg?.type === "FPSHOT_DONE") {
    statusEl.textContent = "Menjahit gambar...";
    stitchAndShow(msg.payload).catch((e) => {
      btnStart.disabled = false;
      showError(e?.message || "Gagal menjahit gambar");
    });
  }
});

async function stitchAndShow(payload) {
  const { dpr, fullWidth, fullHeight, viewportHeight, parts, url } = payload;

  const canvas = resultCanvas;
  const ctx = canvas.getContext("2d");
  canvas.width = Math.floor(fullWidth);
  canvas.height = Math.floor(fullHeight);

  for (let i = 0; i < parts.length; i++) {
    const { y, dataUrl } = parts[i];
    const img = await loadImage(dataUrl);

    const remaining = fullHeight - y;
    const sliceCssHeight = Math.min(viewportHeight, remaining);
    const imgCssHeight = img.height / dpr;
    const scaleY = sliceCssHeight / imgCssHeight;

    ctx.save();
    ctx.scale(1, scaleY);
    ctx.drawImage(img, 0, y / scaleY, canvas.width, imgCssHeight);
    ctx.restore();
  }

  previewWrap.classList.remove("hidden");
  statusEl.textContent = "Selesai. Anda bisa download.";
  btnStart.disabled = false;

  btnDownload.onclick = async () => {
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    const blobUrl = URL.createObjectURL(blob);
    lastCompositeBlobUrl = blobUrl;
    const fileName = makeSafeFileName(url) + ".png";
    await chrome.downloads.download({ url: blobUrl, filename: fileName, saveAs: true });
  };
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function makeSafeFileName(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/[^\w.-]+/g, "_");
    const path = u.pathname.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
    const base = (host + (path ? "_" + path : "")).slice(0, 120);
    return base || "screenshot";
  } catch {
    return "screenshot";
  }
}

