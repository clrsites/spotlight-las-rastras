const PDF_PATH = "./newsletter.pdf";
const cacheVersion = Date.now();
const pdfUrl = `${PDF_PATH}?v=${cacheVersion}`;

const VIDEO_PAGES = new Map([
  [30, { src: "./video1.mp4", title: "Video 1" }],
  [31, { src: "./video2.mp4", title: "Video 2" }],
]);

const elements = {
  book: document.querySelector("#book"),
  stage: document.querySelector("#readerStage"),
  loading: document.querySelector("#loading"),
  error: document.querySelector("#readerError"),
  retry: document.querySelector("#retryButton"),
  previous: document.querySelector("#previousPage"),
  next: document.querySelector("#nextPage"),
  counter: document.querySelector("#pageCounter"),
  download: document.querySelector("#downloadPdf"),
};

elements.download.href = pdfUrl;

let pageFlip = null;
let totalPages = 0;
let buildRun = 0;

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

  source.src = `${videoConfig.src}?v=${cacheVersion}`;
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

function pauseVideos() {
  document.querySelectorAll(".page-video").forEach((video) => video.pause());
}

function updateControls(pageIndex = 0) {
  const visiblePage = Math.min(pageIndex + 1, totalPages);
  elements.counter.textContent = totalPages ? `Página ${visiblePage} de ${totalPages}` : "";
  elements.previous.disabled = pageIndex <= 0;
  elements.next.disabled = pageIndex >= totalPages - 1;
}

function showError(error) {
  console.error(error);
  elements.loading.hidden = true;
  elements.book.hidden = true;
  elements.error.hidden = false;
  elements.counter.textContent = "Edición no disponible";
  elements.previous.disabled = true;
  elements.next.disabled = true;
}

async function buildFlipbook() {
  const run = ++buildRun;
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.book.hidden = false;
  elements.book.replaceChildren();

  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }

  try {
    const [{ getDocument, GlobalWorkerOptions }, { PageFlip }] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"),
      import("https://cdn.jsdelivr.net/npm/page-flip@2.0.7/+esm"),
    ]);

    GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const loadingTask = getDocument({ url: pdfUrl });
    loadingTask.onProgress = ({ loaded, total }) => {
      if (total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        elements.counter.textContent = `Cargando ${percent}%`;
      }
    };
    const pdf = await loadingTask.promise;
    totalPages = pdf.numPages;

    const firstPage = await pdf.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    const pageRatio = baseViewport.height / baseViewport.width;
    const maxRenderWidth = Math.min(1120, Math.max(680, window.innerWidth * 0.74));
    const renderScale = Math.min(1.6, maxRenderWidth / baseViewport.width);

    const pageRecords = [];
    for (let number = 1; number <= totalPages; number += 1) {
      const pageElement = document.createElement("div");
      const canvas = document.createElement("canvas");

      pageElement.className = "page";
      pageElement.dataset.density = "soft";
      pageElement.setAttribute("aria-label", `Página ${number}`);
      pageElement.append(canvas);
      const videoPlayer = createVideoPlayer(number);
      if (videoPlayer) pageElement.append(videoPlayer);
      elements.book.append(pageElement);
      pageRecords.push({ number, canvas });
    }

    const renderPage = async ({ number, canvas }) => {
      if (run !== buildRun) return;
      const pdfPage = number === 1 ? firstPage : await pdf.getPage(number);
      const viewport = pdfPage.getViewport({ scale: renderScale });
      const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      pdfPage.cleanup();
    };

    const initialPages = Math.min(3, totalPages);
    for (let index = 0; index < initialPages; index += 1) {
      await renderPage(pageRecords[index]);
      elements.counter.textContent = `Preparando página ${index + 1} de ${totalPages}`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

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
      flippingTime: 1050,
      drawShadow: true,
      autoSize: true,
      swipeDistance: 20,
      showPageCorners: true,
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    pageFlip.loadFromHTML(elements.book.querySelectorAll(".page"));
    pageFlip.on("flip", (event) => {
      pauseVideos();
      updateControls(event.data);
    });
    pageFlip.on("changeOrientation", () => updateControls(pageFlip.getCurrentPageIndex()));
    elements.loading.hidden = true;
    elements.previous.disabled = false;
    elements.next.disabled = false;
    updateControls(0);

    const waitForIdle = () => new Promise((resolve) => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(resolve, { timeout: 450 });
      } else {
        window.setTimeout(resolve, 60);
      }
    });

    for (let index = initialPages; index < pageRecords.length; index += 1) {
      if (run !== buildRun) return;
      await waitForIdle();
      try {
        await renderPage(pageRecords[index]);
      } catch (error) {
        console.warn(`No se pudo preparar la página ${index + 1}`, error);
      }
    }
  } catch (error) {
    showError(error);
  }
}

elements.previous.addEventListener("click", () => pageFlip?.flipPrev());
elements.next.addEventListener("click", () => pageFlip?.flipNext());
elements.retry.addEventListener("click", buildFlipbook);

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLMediaElement) return;
  if (event.key === "ArrowLeft") pageFlip?.flipPrev();
  if (event.key === "ArrowRight") pageFlip?.flipNext();
});

buildFlipbook();
