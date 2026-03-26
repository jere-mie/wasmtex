import { useRef, useEffect, useState } from "react";
import type { CompileResponse } from "@/workers/tex.worker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, CheckCircle2, XCircle, AlertCircle, Copy, Check } from "lucide-react";

interface CompileConsoleProps {
  compileResult: CompileResponse | null;
  isCompiling: boolean;
}

export function CompileConsole({ compileResult, isCompiling }: CompileConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [compileResult]);

  const handleCopy = () => {
    if (!compileResult) return;
    navigator.clipboard.writeText(compileResult.log).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950 border-t border-ink-700">
      {/* Console header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-900 border-b border-ink-700 shrink-0">
        <Terminal className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
          Console
        </span>
        {compileResult && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              title="Copy console output"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-400 hover:text-ink-200 hover:bg-ink-800 transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            {compileResult.success ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-[10px] text-success font-mono">OK</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-error" />
                <span className="text-[10px] text-error font-mono">
                  {compileResult.errors.length} error(s)
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Console output */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3 font-mono text-xs leading-relaxed">
          {isCompiling && (
            <div className="flex items-center gap-2 text-amber-glow">
              <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
              <span>Compiling...</span>
            </div>
          )}

          {!compileResult && !isCompiling && (
            <div className="text-ink-500 italic">
              Console output will appear here after compilation.
            </div>
          )}

          {compileResult && (
            <pre className="whitespace-pre-wrap text-ink-300">
              {compileResult.log.split("\n").map((line, i) => {
                let className = "text-ink-300";
                if (line.startsWith("!")) className = "text-error";
                else if (line.startsWith("Output written")) className = "text-success";
                else if (line.includes("successfully") || line.includes("completed"))
                  className = "text-success";
                else if (line.startsWith("This is WasmTeX")) className = "text-amber-glow";
                else if (line.startsWith("Note:")) className = "text-ink-400 italic";
                return (
                  <div key={i} className={className}>
                    {line}
                  </div>
                );
              })}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
