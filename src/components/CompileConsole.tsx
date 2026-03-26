import { useRef, useEffect, useState } from "react";
import type { CompileResponse, CompileStatusMessage } from "@/workers/tex.worker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, CheckCircle2, XCircle, AlertCircle, Copy, Check, Loader2 } from "lucide-react";

interface CompileConsoleProps {
  compileResult: CompileResponse | null;
  isCompiling: boolean;
  compilePhase: CompileStatusMessage["phase"] | null;
  compileStartTime: number | null;
}

export function CompileConsole({ compileResult, isCompiling, compilePhase, compileStartTime }: CompileConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [, forceUpdate] = useState(0);

  // Tick every second while compiling so elapsed re-derives from the stable startTime prop.
  // This survives remounts: even if the component mounts mid-download it shows correct elapsed.
  useEffect(() => {
    if (!isCompiling) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isCompiling]);

  const elapsed = compileStartTime != null ? Math.floor((Date.now() - compileStartTime) / 1000) : 0;

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

  const isInitializing = isCompiling && compilePhase === "initializing";
  const isRunning = isCompiling && compilePhase === "compiling";

  // Fake progress: ease quickly to ~80% over 90s, then crawl toward 95%.
  // Snaps to 100% the moment the compiling phase starts.
  const initProgress = (() => {
    if (!isCompiling) return 0;
    if (!isInitializing) return 100; // compiling phase = done initializing
    // logistic-ish curve: fast early, slow late, caps at 95
    const t = elapsed / 90; // normalise to ~90 s target
    return Math.min(95, 95 * (1 - Math.exp(-3 * t)));
  })();

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950 border-t border-ink-700">
      {/* Console header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-900 border-b border-ink-700 shrink-0">
        <Terminal className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
          Console
        </span>
        {isCompiling && (
          <span className="font-mono text-[10px] text-ink-500 ml-1">{elapsed}s</span>
        )}
        {compileResult && !isCompiling && (
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
        <div className="p-3 font-mono text-xs leading-relaxed space-y-3">
          {isInitializing && (
            <div className="rounded-md border border-amber-glow/20 bg-amber-glow/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-glow">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="font-semibold">Downloading TeX engine...</span>
                <span className="ml-auto font-mono text-[10px] text-ink-400">
                  {Math.round(initProgress)}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-ink-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-glow transition-[width] duration-1000 ease-out"
                  style={{ width: `${initProgress}%` }}
                />
              </div>
              <p className="text-ink-400 text-[11px] leading-relaxed">
                The TeX runtime (~430 MB) is being fetched from the server. This only happens
                once - subsequent compiles will be fast. Please wait, this may take up to a
                minute depending on your connection.
              </p>
            </div>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-amber-glow">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Compiling document...</span>
            </div>
          )}

          {isCompiling && !compilePhase && (
            <div className="flex items-center gap-2 text-amber-glow">
              <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
              <span>Starting...</span>
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
