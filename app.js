const PDF_PATH = "./newsletter.pdf";
const EDITION_VERSION = "2026-09";
const pdfUrl = `${PDF_PATH}?v=${EDITION_VERSION}`;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const PREFETCH_DISTANCE = 2;

// Videos según la numeración real del PDF exportado.
const VIDEO_PAGES = new Map([
  [30, { src: "./video1.mp4", title: "Video 1" }],
  [31, { src: "./video2.mp4", title: "Video 2" }],
]);

const elements = {
  shell: document.querySelector(".reader-shell"),
  book: document.querySelector("#book"),
  viewport: document.querySelector("#readerViewport"),
  stage: document.querySelector("#readerStage"),
  loading: document.querySelector("#loading"),
  error: document.querySelector("#readerError"),
  retry: document.querySelector("#retryButton"),
  previous: document.querySelector("#previousPage"),
  next: document.querySelector("#nextPage"),
  counter: document.querySelector("#pageCounter"),
  download: document.querySelector("#downloadPdf"),
  pageForm: document.querySelector("#pageForm"),
  pageInput: document.querySelector("#pageInput"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomValue: document.querySelector("#zoomValue"),
  fullscreen: document.querySelector("#fullscreenButton"),
  fullscreenLabel: document.querySelector("#fullscreenLabel"),
};

elements.download.href = pdfUrl;

let pageFlip = null;
let totalPages = 0;
let buildRun = 0;
let zoomLevel = 1;
let pageRecords = [];
const renderPromises = new Map();

function createVideoPlayer(pageNumber) {
  const videoConfig = VIDEO_PAGES.get(pageNumber);
  if (!videoConfig) return null;

  const player = document.createElement("div");
  const placeholder = document.createElement("p");
  const video = document.createElement("video");
  const source = document.createElement("source");

  player.className = "page-video-player video-missing";
  player.setAttribute("aria-label", `${videoConfig.title}, página ${pageNumber}`);
  placeholder.className = "video-placeholder";
  placeholder.textContent = `Agrega ${videoConfig.src.replace("./", "")} en esta carpeta`;
  video.className = "page-video";
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.setAttribute("aria-label", videoConfig.title);
  source.src = `${videoConfig.src}?v=${EDITION_VERSION}`;
  source.type = "video/mp4";
  video.append(source);
  player.append(placeholder, video);

  video.addEventListener("loadedmetadata", () => player.classList.remove("video-missing"));
  video.addEventListener("error", () => player.classList.add("video-missing"));
  ["pointerdown", "mousedown", "touchstart", "click"].forEach((eventName) => {
    player.addEventListener(eventName, (event) => event.stopPropagation());
  });

  return player;
}

function insertVideoPlayers() {
  const pages = elements.book.querySelectorAll(".page");
  VIDEO_PAGES.forEach((videoConfig, pageNumber) => {
    const pageElement = pages[pageNumber - 1];
    if (!pageElement) {
      console.warn(`No se encontró la página ${pageNumber} para insertar ${videoConfig.src}`);
      return;
    }
    if (pageElement.querySelector(".page-video-player")) return;
    const videoPlayer = createVideoPlayer(pageNumber);
    if (videoPlayer) pageElement.append(videoPlayer);
  });
}

function pauseVideos() {
  document.querySelectorAll(".page-video").forEach((video) => video.pause());
}

function updateControls(pageIndex = 0) {
  const safeIndex = Math.max(0, Math.min(pageIndex, Math.max(0, totalPages - 1)));
  const visiblePage = totalPages ? safeIndex + 1 : 0;
  elements.counter.textContent = totalPages ? `Página ${visiblePage} de ${totalPages}` : "";
  elements.previous.disabled = !pageFlip || safeIndex <= 0;
  elements.next.disabled = !pageFlip || safeIndex >= totalPages - 1;
  elements.pageInput.max = String(totalPages || 1);
  elements.pageInput.value = String(visiblePage || 1);
}

function showError(error) {
  console.error(error);
  elements.loading.hidden = true;
  elements.viewport.hidden = true;
  elements.error.hidden = false;
  elements.counter.textContent = "Edición no disponible";
  elements.previous.disabled = true;
  elements.next.disabled = true;
}

function requestIdle(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 900 });
  } else {
    window.setTimeout(callback, 80);
  }
}

function queueNearbyPages(centerIndex) {
  const indexes = [];
  for (let distance = 1; distance <= PREFETCH_DISTANCE; distance += 1) {
    indexes.push(centerIndex + distance, centerIndex - distance);
  }

  requestIdle(async () => {
    for (const index of indexes) {
      if (index < 0 || index >= pageRecords.length) continue;
      try {
        await renderPage(index);
      } catch (error) {
        console.warn(`No se pudo preparar la página ${index + 1}`, error);
      }
    }
  });
}

async function renderPage(pageIndex) {
  const record = pageRecords[pageIndex];
  if (!record || record.rendered) return;
  if (renderPromises.has(pageIndex)) return renderPromises.get(pageIndex);

  const promise = (async () => {
    const pdfPage = await record.pdf.getPage(record.number);
    const viewport = pdfPage.getViewport({ scale: record.renderScale });
    const context = record.canvas.getContext("2d", { alpha: false, desynchronized: true });
    record.canvas.width = Math.ceil(viewport.width);
    record.canvas.height = Math.ceil(viewport.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    pdfPage.cleanup();
    record.rendered = true;
  })().finally(() => renderPromises.delete(pageIndex));

  renderPromises.set(pageIndex, promise);
  return promise;
}

async function goToPage(pageNumber) {
  if (!pageFlip || !totalPages) return;
  const targetIndex = Math.max(0, Math.min(Number(pageNumber) - 1, totalPages - 1));
  elements.counter.textContent = `Preparando página ${targetIndex + 1}…`;
  await renderPage(targetIndex);
  pauseVideos();
  pageFlip.turnToPage(targetIndex);
  updateControls(targetIndex);
  queueNearbyPages(targetIndex);
}

async function movePage(direction) {
  if (!pageFlip) return;
  const currentIndex = pageFlip.getCurrentPageIndex();
  const targetIndex = Math.max(0, Math.min(currentIndex + direction, totalPages - 1));
  if (targetIndex === currentIndex) return;
  await renderPage(targetIndex);
  direction > 0 ? pageFlip.flipNext() : pageFlip.flipPrev();
  queueNearbyPages(targetIndex);
}

function updateZoom(nextZoom) {
  zoomLevel = Math.max(MIN_ZOOM, Math.min(nextZoom, MAX_ZOOM));
  elements.viewport.style.setProperty("--reader-zoom", String(zoomLevel));
  elements.stage.classList.toggle("is-zoomed", zoomLevel > 1);
  elements.zoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
  elements.zoomOut.disabled = zoomLevel <= MIN_ZOOM;
  elements.zoomIn.disabled = zoomLevel >= MAX_ZOOM;
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await elements.shell.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}

async function buildFlipbook() {
  const run = ++buildRun;
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.viewport.hidden = false;
  elements.book.replaceChildren();
  pageRecords = [];
  renderPromises.clear();

  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }

  try {
    const [{ getDocument, GlobalWorkerOptions }, { PageFlip }] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"),
      import("https://cdn.jsdelivr.net/npm/page-flip@2.0.7/+esm"),
    ]);
    GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

    const loadingTask = getDocument({ url: pdfUrl });
    let downloadComplete = false;
    loadingTask.onProgress = ({ loaded, total }) => {
      if (!downloadComplete && total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        elements.counter.textContent = `Descargando edición ${percent}%`;
      }
    };

    const pdf = await loadingTask.promise;
    downloadComplete = true;
    loadingTask.onProgress = null;
    if (run !== buildRun) return;
    totalPages = pdf.numPages;
    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const pageRatio = baseViewport.height / baseViewport.width;
    const maxRenderWidth = Math.min(1120, Math.max(520, window.innerWidth * 0.74));
    const renderScale = Math.min(1.5, maxRenderWidth / baseViewport.width);

    for (let number = 1; number <= totalPages; number += 1) {
      const pageElement = document.createElement("div");
      const canvas = document.createElement("canvas");
      pageElement.className = "page";
      pageElement.dataset.density = "soft";
      pageElement.dataset.pageNumber = String(number);
      pageElement.setAttribute("aria-label", `Página ${number}`);
      pageElement.append(canvas);
      elements.book.append(pageElement);
      pageRecords.push({ number, canvas, pdf, renderScale, rendered: false });
    }

    elements.counter.textContent = `Preparando portada de ${totalPages} páginas`;
    await renderPage(0);
    if (totalPages > 1) await renderPage(1);
    if (totalPages > 2) await renderPage(2);
    firstPage.cleanup();

    const availableHeight = Math.max(380, elements.stage.clientHeight - 46);
    const pageHeight = Math.min(760, availableHeight);
    const pageWidth = Math.round(pageHeight / pageRatio);
    const minimumPageWidth = Math.min(360, Math.max(270, window.innerWidth - 52));

    pageFlip = new PageFlip(elements.book, {
      width: pageWidth,
      height: pageHeight,
      size: "stretch",
      minWidth: minimumPageWidth,
      maxWidth: pageWidth,
      minHeight: Math.round(minimumPageWidth * pageRatio),
      maxHeight: pageHeight,
      maxShadowOpacity: 0.2,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: true,
      flippingTime: 700,
      drawShadow: true,
      autoSize: true,
      swipeDistance: 20,
      showPageCorners: true,
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    pageFlip.loadFromHTML(elements.book.querySelectorAll(".page"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    insertVideoPlayers();

    pageFlip.on("flip", (event) => {
      pauseVideos();
      updateControls(event.data);
      queueNearbyPages(event.data);
    });
    pageFlip.on("changeOrientation", () => updateControls(pageFlip.getCurrentPageIndex()));

    elements.loading.hidden = true;
    updateControls(0);
    queueNearbyPages(0);
  } catch (error) {
    showError(error);
  }
}

elements.previous.addEventListener("click", () => movePage(-1));
elements.next.addEventListener("click", () => movePage(1));
elements.retry.addEventListener("click", buildFlipbook);
elements.pageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  goToPage(elements.pageInput.value);
});
elements.zoomOut.addEventListener("click", () => updateZoom(zoomLevel - ZOOM_STEP));
elements.zoomIn.addEventListener("click", () => updateZoom(zoomLevel + ZOOM_STEP));
elements.fullscreen.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  elements.fullscreen.setAttribute("aria-pressed", String(isFullscreen));
  elements.fullscreenLabel.textContent = isFullscreen ? "Salir de pantalla completa" : "Pantalla completa";
});

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLMediaElement || event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowLeft") movePage(-1);
  if (event.key === "ArrowRight") movePage(1);
  if (event.key === "+" || event.key === "=") updateZoom(zoomLevel + ZOOM_STEP);
  if (event.key === "-") updateZoom(zoomLevel - ZOOM_STEP);
});

updateZoom(1);
buildFlipbook();
