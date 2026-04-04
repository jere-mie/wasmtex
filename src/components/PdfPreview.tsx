import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { AlertTriangle, FileText, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;
const PAGE_VISIBILITY_OFFSET = 8;

interface ScrollSnapshot {
  pageIndex: number;
  pageProgress: number;
  scrollRatio: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface PdfPreviewProps {
  pdfData: Uint8Array | null;
  isStale: boolean;
  pdfName?: string;
}

export function PdfPreview({ pdfData, isStale, pdfName = "document.pdf" }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pendingScrollRestoreRef = useRef<ScrollSnapshot | null>(null);
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const restoreFrameRef = useRef<number | null>(null);
  const numPagesRef = useRef(0);
  const previousPdfRef = useRef<Uint8Array | null>(null);

  // Keep a raw-bytes ref purely for download - never passed to PDF.js
  const downloadBytesRef = useRef<Uint8Array | null>(null);

  const pdfFile = useMemo(
    () => (pdfData ? { data: pdfData.slice() } : null),
    [pdfData]
  );

  function captureScrollSnapshot(): ScrollSnapshot | null {
    const container = containerRef.current;
    if (!container) return null;

    const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
    const scrollRatio = maxScrollTop === 0 ? 0 : container.scrollTop / maxScrollTop;
    const pages = pageRefs.current.filter((page): page is HTMLDivElement => page !== null);

    if (pages.length === 0) {
      return {
        pageIndex: 0,
        pageProgress: 0,
        scrollRatio,
      };
    }

    let safePageIndex = 0;
    for (let index = 0; index < pages.length; index += 1) {
      if (pages[index].offsetTop <= container.scrollTop + PAGE_VISIBILITY_OFFSET) {
        safePageIndex = index;
      } else {
        break;
      }
    }

    const page = pages[safePageIndex];
    const pageProgress = page.offsetHeight === 0
      ? 0
      : clamp((container.scrollTop - page.offsetTop) / page.offsetHeight, 0, 1);

    return {
      pageIndex: safePageIndex,
      pageProgress,
      scrollRatio,
    };
  }

  function restoreScrollSnapshot(snapshot: ScrollSnapshot) {
    const container = containerRef.current;
    if (!container) return false;

    const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);
    const targetPageIndex = Math.min(snapshot.pageIndex, pageRefs.current.length - 1);
    const targetPage = targetPageIndex >= 0 ? pageRefs.current[targetPageIndex] : null;

    if (targetPage && targetPage.offsetHeight > 0) {
      // If the snapshot indicates the very top of the document, restore to 0
      const isTopSnapshot = snapshot.scrollRatio === 0 || (snapshot.pageIndex === 0 && snapshot.pageProgress === 0);
      if (isTopSnapshot) {
        container.scrollTop = 0;
        return true;
      }

      const targetScrollTop = clamp(
        targetPage.offsetTop + targetPage.offsetHeight * snapshot.pageProgress,
        0,
        maxScrollTop
      );
      container.scrollTop = targetScrollTop;
      return true;
    }

    if (pageRefs.current.length === 0) {
      return false;
    }

    container.scrollTop = snapshot.scrollRatio * maxScrollTop;
    return true;
  }

  function tryRestoreScrollPosition() {
    const snapshot = pendingScrollRestoreRef.current;
    if (!snapshot) return;

    const totalPages = numPagesRef.current;
    const requiredPage = Math.min(snapshot.pageIndex + 1, totalPages);
    if (requiredPage <= 0) return;

    for (let pageNumber = 1; pageNumber <= requiredPage; pageNumber += 1) {
      if (!renderedPagesRef.current.has(pageNumber)) {
        return;
      }
    }

    if (restoreFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFrameRef.current);
    }

    restoreFrameRef.current = window.requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      const pendingSnapshot = pendingScrollRestoreRef.current;
      if (!pendingSnapshot) return;

      if (restoreScrollSnapshot(pendingSnapshot)) {
        pendingScrollRestoreRef.current = null;
      }
    });
  }

  useLayoutEffect(() => {
    if (!pdfData) {
      previousPdfRef.current = null;
      downloadBytesRef.current = null;
      pendingScrollRestoreRef.current = null;
      renderedPagesRef.current = new Set();
      numPagesRef.current = 0;
      return;
    }

    if (previousPdfRef.current && previousPdfRef.current !== pdfData) {
      pendingScrollRestoreRef.current = captureScrollSnapshot();
      renderedPagesRef.current = new Set();
      numPagesRef.current = 0;
    }

    previousPdfRef.current = pdfData;
    downloadBytesRef.current = pdfData;
  }, [pdfData]);

  useEffect(() => {
    return () => {
      if (restoreFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    pageRefs.current.length = numPages;
  }, [numPages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdfData]);

  function handleDownload() {
    const bytes = downloadBytesRef.current;
    if (!bytes) return;
    const blob = new Blob([bytes.slice()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  if (pdfData) {
    const pageWidth = containerWidth > 0 ? (containerWidth - 32) * zoom : undefined;
    // For rotated pages (90/270) swap the axis so we fill width correctly
    const isRotated90 = rotation === 90 || rotation === 270;

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-ink-950">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-1 border-b border-ink-800 bg-ink-900 px-2 py-1">
          <button
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
            disabled={zoom <= ZOOM_MIN}
            className="flex items-center justify-center rounded p-1.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3.5rem] text-center text-[11px] text-ink-400 select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
            disabled={zoom >= ZOOM_MAX}
            className="flex items-center justify-center rounded p-1.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="mx-2 h-4 w-px bg-ink-700 shrink-0" />
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="flex items-center justify-center rounded p-1.5 text-ink-400 hover:bg-ink-700 hover:text-ink-100 transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 rounded px-2.5 py-1 text-[11px] text-ink-400 hover:bg-ink-700 hover:text-ink-100 transition-colors"
            title={`Download ${pdfName}`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{pdfName}</span>
          </button>
        </div>

        {isStale && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-950/60 border-b border-amber-800/50 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span className="text-[11px] text-amber-300/70">
              Preview is outdated - showing last successful build.
            </span>
          </div>
        )}
        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-auto">
          <div style={{ minWidth: "fit-content" }}>
            <Document
              file={pdfFile}
              onLoadSuccess={({ numPages }) => {
                numPagesRef.current = numPages;
                renderedPagesRef.current = new Set();
                setNumPages(numPages);
              }}
              className="py-4"
            >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={`page_${i + 1}_r${rotation}`}
                ref={(element) => {
                  pageRefs.current[i] = element;
                }}
                data-page-number={i + 1}
                style={{ width: "fit-content", margin: "0 auto 1rem" }}
              >
                <Page
                  pageNumber={i + 1}
                  width={isRotated90 ? undefined : pageWidth}
                  height={isRotated90 ? pageWidth : undefined}
                  rotate={rotation}
                  onRenderSuccess={() => {
                    renderedPagesRef.current.add(i + 1);
                    tryRestoreScrollPosition();
                  }}
                  renderAnnotationLayer
                  renderTextLayer
                  className="shadow-lg"
                />
              </div>
            ))}
            </Document>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no successful compilation yet
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-ink-950">
      <div className="text-center space-y-4 px-8 max-w-xs">
        {/* Decorative element */}
        <div className="mx-auto w-16 h-20 rounded-sm border-2 border-ink-700 border-dashed flex items-center justify-center relative">
          <FileText className="h-7 w-7 text-ink-600" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-ink-700 rounded-full" />
        </div>
        <div>
          <h3 className="font-display text-lg text-ink-400 mb-1">No Preview</h3>
          <p className="text-ink-500 text-xs leading-relaxed">
            Click <span className="text-amber-glow font-mono">Compile</span> to build your document.
            The PDF will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
