import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { CompileResponse } from "@/workers/tex.worker";
import { AlertTriangle, FileText, ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;

interface PdfPreviewProps {
  compileResult: CompileResponse | null;
  pdfName?: string;
}

export function PdfPreview({ compileResult, pdfName = "document.pdf" }: PdfPreviewProps) {
  const [displayPdf, setDisplayPdf] = useState<Uint8Array | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep a raw-bytes ref purely for download — never passed to PDF.js
  const downloadBytesRef = useRef<Uint8Array | null>(null);

  const pdfFile = useMemo(
    () => (displayPdf ? { data: displayPdf.slice() } : null),
    [displayPdf]
  );

  useEffect(() => {
    if (!compileResult) return;

    if (compileResult.success && compileResult.pdf) {
      const bytes = compileResult.pdf as Uint8Array;
      downloadBytesRef.current = bytes;
      setDisplayPdf(bytes);
      setIsStale(false);
    } else if (!compileResult.success) {
      setIsStale(true);
    }
  }, [compileResult]);

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
  }, [displayPdf]);

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

  if (displayPdf) {
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
              Preview is outdated — showing last successful build.
            </span>
          </div>
        )}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-auto"
        >
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            className="py-4"
            style={{ minWidth: "fit-content" }}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={`page_${i + 1}_r${rotation}`} style={{ width: "fit-content", margin: "0 auto 1rem" }}>
                <Page
                  pageNumber={i + 1}
                  width={isRotated90 ? undefined : pageWidth}
                  height={isRotated90 ? pageWidth : undefined}
                  rotate={rotation}
                  renderAnnotationLayer
                  renderTextLayer
                  className="shadow-lg"
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    );
  }

  // Empty state — no successful compilation yet
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
