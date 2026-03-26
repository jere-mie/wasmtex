import { useState, useRef } from "react";
import { useFiles } from "@/context/FileContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  Upload,
  Loader2,
  Download,
} from "lucide-react";
import type { VFSFile } from "@/context/FileContext";
import { buildZip } from "@/lib/zip";

interface ToolbarProps {
  onCompile: () => void;
  isCompiling: boolean;
}

export function Toolbar({ onCompile, isCompiling }: ToolbarProps) {
  const { createFile, importFiles, files } = useFiles();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    createFile(name.endsWith(".tex") ? name : name + ".tex");
    setNewFileName("");
    setNewFileOpen(false);
  };

  const handleDownload = () => {
    if (files.length === 0) return;
    const zip = buildZip(files.map((f) => ({ name: f.name, content: f.content })));
    const buf = new ArrayBuffer(zip.byteLength);
    new Uint8Array(buf).set(zip);
    const url = URL.createObjectURL(new Blob([buf], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "wasmtex-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    const uploadedFiles = await Promise.all(
      selectedFiles.map(
        (file) =>
          new Promise<VFSFile>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              resolve({
                name: file.name,
                content: typeof reader.result === "string" ? reader.result : "",
              });
            };

            reader.onerror = () => {
              reject(reader.error ?? new Error(`Failed to read ${file.name}`));
            };

            reader.readAsText(file);
          })
      )
    ).catch((error: unknown) => {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    event.target.value = "";

    if (!uploadedFiles) return;

    importFiles(uploadedFiles);

    toast.success("Files imported", {
      description:
        uploadedFiles.length === 1
          ? `${uploadedFiles[0].name} added to the project.`
          : `${uploadedFiles.length} files added to the project.`,
    });
  };

  return (
    <header className="flex items-center h-11 px-3 bg-ink-900 border-b border-ink-700 shrink-0 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-glow to-amber-dim flex items-center justify-center">
          <span className="font-display text-ink-950 text-xs font-bold leading-none">T</span>
        </div>
        <h1 className="hidden sm:block font-display text-base font-semibold text-amber-glow tracking-wide">
          WasmTeX
        </h1>
      </div>

      <div className="h-5 w-px bg-ink-700 mx-1" />

      {/* Compile button */}
      <Button
        variant="default"
        size="sm"
        onClick={onCompile}
        disabled={isCompiling}
        className="gap-1.5 font-mono text-xs"
        title="Compile (Ctrl/Cmd+Enter)"
      >
        {isCompiling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{isCompiling ? "Compiling..." : "Compile"}</span>
      </Button>

      {/* New File */}
      <Button variant="ghost" size="icon" onClick={() => setNewFileOpen(true)} title="New File">
        <Plus className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="icon" onClick={handleUploadClick} title="Upload Files">
        <Upload className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={files.length === 0}
        title="Download all files as ZIP"
      >
        <Download className="h-4 w-4" />
      </Button>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".tex,.bib,.sty,.cls,.bst,.txt,.csv,.tsv,.tikz,.pgf,.svg,text/*"
        className="hidden"
        onChange={handleUploadChange}
      />

      <div className="flex-1" />

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
