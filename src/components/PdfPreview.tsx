import type { CompileResponse } from "@/workers/tex.worker";
import { FileText } from "lucide-react";

interface PdfPreviewProps {
  compileResult: CompileResponse | null;
}

export function PdfPreview({ compileResult }: PdfPreviewProps) {
  // If we have a PDF blob, display it
  if (compileResult?.success && compileResult.pdf) {
    const blob = new Blob([compileResult.pdf as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    return (
      <div className="flex-1 bg-ink-950">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title="PDF Preview"
        />
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex-1 flex items-center justify-center bg-ink-950">
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
