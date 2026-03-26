import { useEffect, useRef, useState } from "react";
import type { CompileResponse } from "@/workers/tex.worker";
import { AlertTriangle, FileText } from "lucide-react";

interface PdfPreviewProps {
  compileResult: CompileResponse | null;
}

export function PdfPreview({ compileResult }: PdfPreviewProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const displayUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!compileResult) return;

    if (compileResult.success && compileResult.pdf) {
      const url = URL.createObjectURL(
        new Blob([compileResult.pdf as BlobPart], { type: "application/pdf" })
      );
      // Revoke the previous URL now that we have a new one
      if (displayUrlRef.current) {
        URL.revokeObjectURL(displayUrlRef.current);
      }
      displayUrlRef.current = url;
      setDisplayUrl(url);
      setIsStale(false);
    } else if (!compileResult.success) {
      // Keep the cached URL visible but mark it as stale
      setIsStale(true);
    }
  }, [compileResult]);

  // Revoke the cached URL on unmount
  useEffect(() => {
    return () => {
      if (displayUrlRef.current) {
        URL.revokeObjectURL(displayUrlRef.current);
      }
    };
  }, []);

  if (displayUrl) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-ink-950">
        {isStale && (
          <div className="shrink-0 flex items-center gap-2 bg-amber-950/60 border-b border-amber-800/50 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span className="text-[11px] text-amber-300/70">
              Preview is outdated — showing last successful build.
            </span>
          </div>
        )}
        <iframe
          src={`${displayUrl}#view=FitH`}
          className="w-full flex-1 border-0"
          title="PDF Preview"
        />
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
