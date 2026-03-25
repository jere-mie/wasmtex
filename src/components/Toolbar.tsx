import { useState, useCallback, useRef } from "react";
import { useFiles } from "@/context/FileContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Play,
  Plus,
  Download,
  Settings,
  Loader2,
} from "lucide-react";
import type { CompileResponse } from "@/workers/tex.worker";

interface ToolbarProps {
  onCompileResult: (result: CompileResponse) => void;
  isCompiling: boolean;
  setIsCompiling: (v: boolean) => void;
}

export function Toolbar({ onCompileResult, isCompiling, setIsCompiling }: ToolbarProps) {
  const { files, createFile, activeFile } = useFiles();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const workerRef = useRef<Worker | null>(null);

  const handleCompile = useCallback(() => {
    if (isCompiling) return;
    setIsCompiling(true);

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("@/workers/tex.worker.ts", import.meta.url),
        { type: "module" }
      );
    }

    const worker = workerRef.current;
    worker.onmessage = (e: MessageEvent<CompileResponse>) => {
      onCompileResult(e.data);
      setIsCompiling(false);
    };

    worker.postMessage({
      type: "compile",
      files: files.map((f) => ({ name: f.name, content: f.content })),
      mainFile: activeFile ?? "main.tex",
    });
  }, [files, activeFile, isCompiling, onCompileResult, setIsCompiling]);

  const handleNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    createFile(name.endsWith(".tex") ? name : name + ".tex");
    setNewFileName("");
    setNewFileOpen(false);
  };

  return (
    <header className="flex items-center h-11 px-3 bg-ink-900 border-b border-ink-700 shrink-0 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-glow to-amber-dim flex items-center justify-center">
          <span className="font-display text-ink-950 text-xs font-bold leading-none">T</span>
        </div>
        <h1 className="font-display text-base font-semibold text-amber-glow tracking-wide">
          WasmTeX
        </h1>
      </div>

      <div className="h-5 w-px bg-ink-700 mx-1" />

      {/* Compile button */}
      <Button
        variant="default"
        size="sm"
        onClick={handleCompile}
        disabled={isCompiling}
        className="gap-1.5 font-mono text-xs"
      >
        {isCompiling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {isCompiling ? "Compiling…" : "Compile"}
      </Button>

      {/* New File */}
      <Button variant="ghost" size="icon" onClick={() => setNewFileOpen(true)} title="New File">
        <Plus className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      {/* Right side  */}
      <Button variant="ghost" size="icon" title="Download Project">
        <Download className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Settings">
        <Settings className="h-4 w-4" />
      </Button>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              Enter a name for the new LaTeX file.
            </DialogDescription>
          </DialogHeader>
          <input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
            placeholder="chapter1.tex"
            className="w-full px-3 py-2 rounded-md bg-ink-800 border border-ink-600 text-ink-100 text-sm font-mono focus:outline-none focus:border-amber-glow placeholder:text-ink-500"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
