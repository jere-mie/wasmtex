import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Toaster, toast } from "sonner";
import { Toolbar } from "@/components/Toolbar";
import { FileExplorer } from "@/components/FileExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { MonacoEditor } from "@/components/MonacoEditor";
import { PdfPreview } from "@/components/PdfPreview";
import { CompileConsole } from "@/components/CompileConsole";
import { useFiles } from "@/context/FileContext";
import { useTheme } from "@/context/ThemeContext";
import type { CompileResponse, CompileStatusMessage } from "@/workers/tex.worker";
import { compileMarkdownToPdf } from "@/lib/markdown-pdf";
import { cn } from "@/lib/utils";
import {
  collectProjectImportFromDataTransfer,
  getFileExtension,
  hasFileDrag,
} from "@/lib/project-files";
import type { VFSFile } from "@/lib/project-files";
import { FolderOpen, FileText, Eye } from "lucide-react";
import type { CompileEngine } from "@/workers/tex.worker";

const HANDLE_SIZE = 4;
const MIN_SIDEBAR_WIDTH = 88;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_EDITOR_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 320;
const MIN_PREVIEW_HEIGHT = 180;
const MIN_CONSOLE_HEIGHT = 120;
const DEFAULT_SIDEBAR_WIDTH = 240;
const DEFAULT_PREVIEW_WIDTH = 540;
const DEFAULT_CONSOLE_HEIGHT = 210;
const AUTO_COMPILE_STORAGE_KEY = "wasmtex:auto-compile";
const MARKDOWN_STYLES_STORAGE_KEY = "wasmtex:markdown-stylesheets";
const DEFAULT_MARKDOWN_STYLESHEET = "markdown-print.css";
const AUTO_COMPILE_DELAY_MS = 700;

interface StoredMarkdownStylesheetSelection {
  paths: string[];
  hasStoredValue: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCompileEngineForFile(fileName: string): CompileEngine | null {
  const extension = getFileExtension(fileName);

  if (extension === "tex") {
    return "latex";
  }

  if (extension === "typ") {
    return "typst";
  }

  if (extension === "md") {
    return "markdown";
  }

  return null;
}

function getCompiledPdfName(fileName: string) {
  return fileName.replace(/\.(tex|typ|md)$/i, ".pdf");
}

function readStoredMarkdownStylesheetSelection(): StoredMarkdownStylesheetSelection {
  if (typeof window === "undefined") {
    return {
      paths: [],
      hasStoredValue: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(MARKDOWN_STYLES_STORAGE_KEY);
    if (raw === null) {
      return {
        paths: [],
        hasStoredValue: false,
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    return {
      paths: Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [],
      hasStoredValue: true,
    };
  } catch {
    return {
      paths: [],
      hasStoredValue: false,
    };
  }
}

function pickCompileTarget(
  files: Array<Pick<VFSFile, "name">>,
  activeFile: string | null
) {
  const activeEngine = activeFile ? getCompileEngineForFile(activeFile) : null;
  if (activeFile && activeEngine) {
    return {
      engine: activeEngine,
      mainFile: activeFile,
      pdfName: getCompiledPdfName(activeFile),
    };
  }

  for (const candidate of ["main.tex", "main.typ", "main.md"]) {
    const engine = getCompileEngineForFile(candidate);
    if (engine && files.some((file) => file.name === candidate)) {
      return {
        engine,
        mainFile: candidate,
        pdfName: getCompiledPdfName(candidate),
      };
    }
  }

  const fallback = files.find((file) => getCompileEngineForFile(file.name));
  if (!fallback) {
    return null;
  }

  return {
    engine: getCompileEngineForFile(fallback.name) as CompileEngine,
    mainFile: fallback.name,
    pdfName: getCompiledPdfName(fallback.name),
  };
}

function ResizeHandle({
  orientation,
  onPointerDown,
}: {
  orientation: "horizontal" | "vertical";
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      className={cn(
        "group relative z-10 shrink-0 touch-none select-none",
        orientation === "horizontal"
          ? "h-full cursor-col-resize"
          : "w-full cursor-row-resize"
      )}
      style={{
        width: orientation === "horizontal" ? `${HANDLE_SIZE}px` : "100%",
        height: orientation === "vertical" ? `${HANDLE_SIZE}px` : "100%",
      }}
    >
      <div
        className={cn(
          "absolute bg-ink-700/90 transition-colors group-hover:bg-amber-glow/50",
          orientation === "horizontal"
            ? "left-1/2 top-0 h-full w-px -translate-x-1/2"
            : "top-1/2 left-0 h-px w-full -translate-y-1/2"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border border-ink-600 bg-ink-800 shadow-[0_0_0_1px_rgba(8,6,10,0.55)] transition-colors group-hover:border-amber-glow/60 group-hover:bg-ink-750",
          orientation === "horizontal" ? "h-5 w-3" : "h-3 w-5"
        )}
      >
        <div
          className={cn(
            "grid gap-[2px]",
            orientation === "horizontal" ? "grid-cols-1" : "grid-flow-col"
          )}
        >
          <span className="h-[2px] w-[2px] rounded-full bg-ink-400" />
          <span className="h-[2px] w-[2px] rounded-full bg-ink-400" />
          <span className="h-[2px] w-[2px] rounded-full bg-ink-400" />
        </div>
      </div>
    </div>
  );
}

function App() {
  const { files, activeFile, importFiles } = useFiles();
  const { activeTheme } = useTheme();
  const [storedMarkdownStylesheetSelection] = useState(readStoredMarkdownStylesheetSelection);
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [previewPdf, setPreviewPdf] = useState<Uint8Array | null>(null);
  const [isPreviewStale, setIsPreviewStale] = useState(false);
  const [compiledPdfName, setCompiledPdfName] = useState<string>("document.pdf");
  const [compileEngine, setCompileEngine] = useState<CompileEngine | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoCompile, setAutoCompile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTO_COMPILE_STORAGE_KEY) === "true";
  });
  const [markdownStylesheetPaths, setMarkdownStylesheetPaths] = useState<string[]>(
    storedMarkdownStylesheetSelection.paths
  );
  const [compilePhase, setCompilePhase] = useState<CompileStatusMessage["phase"] | null>(null);
  const [compileStartTime, setCompileStartTime] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [consoleHeight, setConsoleHeight] = useState(DEFAULT_CONSOLE_HEIGHT);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "preview">("editor");
  const [isImportDragActive, setIsImportDragActive] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const rightColumnRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragDepthRef = useRef(0);
  const lastCompileVersionRef = useRef<string | null>(null);
  const previewPdfRef = useRef<Uint8Array | null>(null);

  const projectVersion = files
    .map((file) => {
      const contentToken = typeof file.content === "string"
        ? file.content
        : `${file.mimeType ?? "application/octet-stream"}:${file.content.byteLength}`;
      return `${file.name}:${contentToken}`;
    })
    .join("\u001f");

  const markdownStylesheets = useMemo(
    () => files
      .filter((file) => file.kind === "text" && getFileExtension(file.name) === "css")
      .map((file) => file.name)
      .sort((left, right) => left.localeCompare(right)),
    [files]
  );

  const selectedMarkdownStylesheetPaths = useMemo(() => {
    const availablePaths = new Set(markdownStylesheets);
    const filtered = markdownStylesheetPaths.filter((path) => availablePaths.has(path));

    if (
      !storedMarkdownStylesheetSelection.hasStoredValue &&
      filtered.length === 0 &&
      availablePaths.has(DEFAULT_MARKDOWN_STYLESHEET)
    ) {
      return [DEFAULT_MARKDOWN_STYLESHEET];
    }

    return filtered;
  }, [markdownStylesheetPaths, markdownStylesheets, storedMarkdownStylesheetSelection.hasStoredValue]);

  const compileVersion = `${projectVersion}\u001e${selectedMarkdownStylesheetPaths.join("\u001d")}`;

  const toggleMarkdownStylesheet = useCallback((path: string) => {
    const nextSelection = selectedMarkdownStylesheetPaths.includes(path)
      ? selectedMarkdownStylesheetPaths.filter((entry) => entry !== path)
      : [...selectedMarkdownStylesheetPaths, path].sort((left, right) => left.localeCompare(right));

    setMarkdownStylesheetPaths(nextSelection);
  }, [selectedMarkdownStylesheetPaths]);

  const clearMarkdownStylesheets = useCallback(() => {
    setMarkdownStylesheetPaths([]);
  }, []);

  const handleCompileResult = useCallback((result: CompileResponse) => {
    setCompileResult(result);
    setCompileEngine(result.engine);
    setIsCompiling(false);
    setCompilePhase(null);
    setCompileStartTime(null);

    if (result.success && result.pdf) {
      const bytes = result.pdf as Uint8Array;
      previewPdfRef.current = bytes;
      setPreviewPdf(bytes);
      setIsPreviewStale(false);
    } else {
      setIsPreviewStale(previewPdfRef.current !== null);
    }

    const engineLabel = result.engine === "latex"
      ? "LaTeX"
      : result.engine === "typst"
        ? "Typst"
        : "Markdown";
    if (result.success) {
      toast.success(`${engineLabel} compilation successful`, {
        description: `${result.mainFile} built without errors.`,
      });
    } else {
      toast.error(`${engineLabel} compilation failed`, {
        description: `${result.errors.length} error(s) found.`,
      });
    }
  }, []);

  const handleCompile = useCallback(() => {
    if (isCompiling) return;

    const target = pickCompileTarget(files, activeFile);
    if (!target) {
      toast.error("No compilable source file", {
        description: "Add or select a .tex, .typ, or .md file to compile.",
      });
      return;
    }

    lastCompileVersionRef.current = compileVersion;
    setCompileEngine(target.engine);
    setIsCompiling(true);
    setCompileStartTime(Date.now());
    setCompiledPdfName(target.pdfName);

    if (target.engine === "markdown") {
      void compileMarkdownToPdf({
        files,
        mainFile: target.mainFile,
        stylesheetPaths: selectedMarkdownStylesheetPaths,
        onStatusChange: setCompilePhase,
      }).then((result) => {
        handleCompileResult(result);
      });
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("@/workers/tex.worker.ts", import.meta.url),
        { type: "module" }
      );
    }

    const worker = workerRef.current;

    worker.onmessage = (event: MessageEvent<CompileResponse | CompileStatusMessage>) => {
      if (event.data.type === "compile-status") {
        setCompilePhase(event.data.phase);
        return;
      }
      handleCompileResult(event.data);
    };

    worker.postMessage({
      type: "compile",
      engine: target.engine,
      files: files.map((file) => ({ name: file.name, content: file.content })),
      mainFile: target.mainFile,
    });
  }, [activeFile, compileVersion, files, handleCompileResult, isCompiling, selectedMarkdownStylesheetPaths]);

  const notifyProjectImport = useCallback((fileCount: number, folderCount: number) => {
    toast.success("Project imported", {
      description:
        folderCount > 0
          ? `${fileCount} file${fileCount === 1 ? "" : "s"} across ${folderCount} folder${folderCount === 1 ? "" : "s"}.`
          : `${fileCount} file${fileCount === 1 ? "" : "s"} added to the project.`,
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(AUTO_COMPILE_STORAGE_KEY, autoCompile ? "true" : "false");
  }, [autoCompile]);

  useEffect(() => {
    window.localStorage.setItem(
      MARKDOWN_STYLES_STORAGE_KEY,
      JSON.stringify(selectedMarkdownStylesheetPaths)
    );
  }, [selectedMarkdownStylesheetPaths]);

  useEffect(() => {
    if (!autoCompile || isCompiling || files.length === 0) {
      return;
    }

    if (compileVersion === lastCompileVersionRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleCompile();
    }, AUTO_COMPILE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoCompile, compileVersion, files.length, handleCompile, isCompiling]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const worker = workerRef.current;

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsImportDragActive(false);
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsImportDragActive(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      setIsImportDragActive(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsImportDragActive(false);
      }
    };

    const handleDrop = async (event: DragEvent) => {
      if (!hasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      resetDragState();

      try {
        const importedProject = await collectProjectImportFromDataTransfer(event.dataTransfer as DataTransfer);
        if (importedProject.files.length === 0) {
          return;
        }

        importFiles(importedProject.files, importedProject.folders);
        notifyProjectImport(importedProject.files.length, importedProject.folders.length);
      } catch (error) {
        toast.error("Import failed", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("blur", resetDragState);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("blur", resetDragState);
    };
  }, [importFiles, notifyProjectImport]);

  useEffect(() => {
    const clampLayout = () => {
      const layoutElement = layoutRef.current;
      const rightColumnElement = rightColumnRef.current;

      if (!layoutElement || !rightColumnElement) return;

      const totalWidth = layoutElement.clientWidth;
      const maxSidebarWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        totalWidth - MIN_EDITOR_WIDTH - previewWidth - HANDLE_SIZE * 2
      );
      const nextSidebarWidth = clamp(sidebarWidth, MIN_SIDEBAR_WIDTH, maxSidebarWidth);

      const maxPreviewWidth = totalWidth - nextSidebarWidth - MIN_EDITOR_WIDTH - HANDLE_SIZE * 2;
      const nextPreviewWidth = clamp(previewWidth, MIN_PREVIEW_WIDTH, maxPreviewWidth);

      if (nextSidebarWidth !== sidebarWidth) {
        setSidebarWidth(nextSidebarWidth);
      }

      if (nextPreviewWidth !== previewWidth) {
        setPreviewWidth(nextPreviewWidth);
      }

      const rightColumnHeight = rightColumnElement.clientHeight;
      const maxConsoleHeight = rightColumnHeight - MIN_PREVIEW_HEIGHT - HANDLE_SIZE;
      const nextConsoleHeight = clamp(consoleHeight, MIN_CONSOLE_HEIGHT, maxConsoleHeight);

      if (nextConsoleHeight !== consoleHeight) {
        setConsoleHeight(nextConsoleHeight);
      }
    };

    clampLayout();
    window.addEventListener("resize", clampLayout);
    return () => window.removeEventListener("resize", clampLayout);
  }, [consoleHeight, previewWidth, sidebarWidth]);

  const beginHorizontalResize = useCallback(
    (target: "sidebar" | "preview", event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();

      const layoutElement = layoutRef.current;
      if (!layoutElement) return;

      const rect = layoutElement.getBoundingClientRect();
      const startClientX = event.clientX;
      const startSidebarWidth = sidebarWidth;
      const startPreviewWidth = previewWidth;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const totalWidth = rect.width;
        const deltaX = moveEvent.clientX - startClientX;
        const maxSidebarWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          totalWidth - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH - HANDLE_SIZE * 2
        );
        const maxPreviewWidth = totalWidth - MIN_EDITOR_WIDTH - MIN_SIDEBAR_WIDTH - HANDLE_SIZE * 2;

        if (target === "sidebar") {
          const nextSidebarWidth = clamp(
            startSidebarWidth + deltaX,
            MIN_SIDEBAR_WIDTH,
            maxSidebarWidth
          );
          const nextPreviewWidth = clamp(
            totalWidth - nextSidebarWidth - MIN_EDITOR_WIDTH - HANDLE_SIZE * 2,
            MIN_PREVIEW_WIDTH,
            MAX_SIDEBAR_WIDTH + totalWidth
          );

          setSidebarWidth(nextSidebarWidth);
          setPreviewWidth(Math.min(startPreviewWidth, nextPreviewWidth));
          return;
        }

        const nextPreviewWidth = clamp(
          startPreviewWidth - deltaX,
          MIN_PREVIEW_WIDTH,
          maxPreviewWidth
        );
        const nextSidebarWidth = clamp(
          totalWidth - nextPreviewWidth - MIN_EDITOR_WIDTH - HANDLE_SIZE * 2,
          MIN_SIDEBAR_WIDTH,
          MAX_SIDEBAR_WIDTH
        );

        setPreviewWidth(nextPreviewWidth);
        setSidebarWidth(Math.min(startSidebarWidth, nextSidebarWidth));
      };

      const onPointerUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [previewWidth, sidebarWidth]
  );

  const beginVerticalResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rightColumnElement = rightColumnRef.current;
    if (!rightColumnElement) return;

    const rect = rightColumnElement.getBoundingClientRect();

    const onPointerMove = (moveEvent: PointerEvent) => {
      const maxConsoleHeight = rect.height - MIN_PREVIEW_HEIGHT - HANDLE_SIZE;
      setConsoleHeight(
        clamp(rect.bottom - moveEvent.clientY, MIN_CONSOLE_HEIGHT, maxConsoleHeight)
      );
    };

    const onPointerUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, []);

  const mobileTabItems = [
    { id: "files" as const, label: "Files", icon: FolderOpen },
    { id: "editor" as const, label: "Editor", icon: FileText },
    { id: "preview" as const, label: "Preview", icon: Eye },
  ];

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col noise-bg">
      <Toolbar
        onCompile={handleCompile}
        isCompiling={isCompiling}
        autoCompile={autoCompile}
        onAutoCompileChange={setAutoCompile}
        isSettingsOpen={isSettingsOpen}
        onSettingsOpenChange={setIsSettingsOpen}
        markdownStylesheets={markdownStylesheets}
        selectedMarkdownStylesheets={selectedMarkdownStylesheetPaths}
        onToggleMarkdownStylesheet={toggleMarkdownStylesheet}
        onClearMarkdownStylesheets={clearMarkdownStylesheets}
      />

      {isMobile ? (
        /* ── Mobile layout: single panel + bottom tab bar ── */
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === "files" && (
              <div className="h-full overflow-auto">
                <FileExplorer />
              </div>
            )}
            {mobileTab === "editor" && (
              <div className="flex h-full min-h-0 flex-col">
                <EditorTabs />
                <div className="flex-1 min-h-0">
                  <MonacoEditor onCompile={handleCompile} />
                </div>
              </div>
            )}
            {mobileTab === "preview" && (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex-1 min-h-0">
                  <PdfPreview pdfData={previewPdf} isStale={isPreviewStale} pdfName={compiledPdfName} />
                </div>
                <div className="shrink-0" style={{ height: 180 }}>
                  <CompileConsole compileResult={compileResult} compileEngine={compileEngine} isCompiling={isCompiling} compilePhase={compilePhase} compileStartTime={compileStartTime} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom tab bar */}
          <nav className="flex shrink-0 border-t border-ink-700 bg-ink-900">
            {mobileTabItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  mobileTab === id ? "text-amber-glow" : "text-ink-400 active:text-ink-200"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        /* ── Desktop layout: resizable columns ── */
        <div ref={layoutRef} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="min-h-0 shrink-0"
            style={{ width: sidebarWidth }}
          >
            <FileExplorer />
          </div>

          <ResizeHandle orientation="horizontal" onPointerDown={(event) => beginHorizontalResize("sidebar", event)} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <EditorTabs />
              <div className="flex-1 min-h-0">
                <MonacoEditor onCompile={handleCompile} />
              </div>
            </div>
          </div>

          <ResizeHandle orientation="horizontal" onPointerDown={(event) => beginHorizontalResize("preview", event)} />

          <div
            ref={rightColumnRef}
            className="flex min-h-0 shrink-0 flex-col"
            style={{ width: previewWidth }}
          >
            <div
              className="min-h-0 flex-1"
              style={{ height: `calc(100% - ${consoleHeight + HANDLE_SIZE}px)` }}
            >
              <PdfPreview pdfData={previewPdf} isStale={isPreviewStale} pdfName={compiledPdfName} />
            </div>
            <ResizeHandle orientation="vertical" onPointerDown={beginVerticalResize} />
            <div className="min-h-0 shrink-0" style={{ height: consoleHeight }}>
              <CompileConsole compileResult={compileResult} compileEngine={compileEngine} isCompiling={isCompiling} compilePhase={compilePhase} compileStartTime={compileStartTime} />
            </div>
          </div>
        </div>
      )}

      {isImportDragActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-amber-glow/40 bg-ink-900/95 px-6 py-5 text-center shadow-2xl shadow-black/40">
            <p className="font-display text-xl text-amber-glow">Drop files or folders to import</p>
            <p className="mt-2 text-sm text-ink-300">
              Mixed selections are supported, including images and nested directories.
            </p>
          </div>
        </div>
      )}

      <Toaster
        theme={activeTheme.isDark ? "dark" : "light"}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#17141c",
            border: "1px solid #342e40",
            color: "#ddd9e8",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
