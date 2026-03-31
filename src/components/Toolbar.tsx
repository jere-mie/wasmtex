import { useEffect, useRef, useState } from "react";
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
  FolderOpen,
  Settings,
} from "lucide-react";
import { buildZip } from "@/lib/zip";
import { collectProjectImportFromFileList } from "@/lib/project-files";
import { ThemePanel } from "@/components/ThemePanel";

interface ToolbarProps {
  onCompile: () => void;
  isCompiling: boolean;
  autoCompile: boolean;
  onAutoCompileChange: (enabled: boolean) => void;
  isSettingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

export function Toolbar({
  onCompile,
  isCompiling,
  autoCompile,
  onAutoCompileChange,
  isSettingsOpen,
  onSettingsOpenChange,
}: ToolbarProps) {
  const { createFile, importFiles, files } = useFiles();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadDirectoryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const directoryInput = uploadDirectoryRef.current;
    if (!directoryInput) return;

    directoryInput.setAttribute("webkitdirectory", "");
    directoryInput.setAttribute("directory", "");
  }, []);

  const handleNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    createFile(name.includes(".") ? name : `${name}.tex`);
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
    setImportOpen(true);
  };

  const commitImport = (fileCount: number, folderCount: number) => {
    toast.success("Project imported", {
      description:
        folderCount > 0
          ? `${fileCount} file${fileCount === 1 ? "" : "s"} across ${folderCount} folder${folderCount === 1 ? "" : "s"}.`
          : `${fileCount} file${fileCount === 1 ? "" : "s"} added to the project.`,
    });
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;

    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    const importedProject = await collectProjectImportFromFileList(selectedFiles).catch((error: unknown) => {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    event.target.value = "";

    if (!importedProject || importedProject.files.length === 0) return;

    importFiles(importedProject.files, importedProject.folders);
    setImportOpen(false);
    commitImport(importedProject.files.length, importedProject.folders.length);
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

      <Button variant="ghost" size="icon" onClick={handleUploadClick} title="Import files or folders">
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

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onSettingsOpenChange(true)}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadChange}
      />

      <input
        ref={uploadDirectoryRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadChange}
      />

      <div className="flex-1" />

      <div className="hidden items-center gap-3 text-xs text-ink-400 md:flex">
        <a
          href="https://github.com/jere-mie/wasmtex"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-amber-glow"
        >
          GitHub
        </a>
        <span className="text-ink-600">/</span>
        <a
          href="https://jeremie.bornais.ca"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-amber-glow"
        >
          Created by Jeremie Bornais
        </a>
      </div>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              Enter a name for the new LaTeX or Typst file.
            </DialogDescription>
          </DialogHeader>
          <input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
            placeholder="chapter1.tex or article.typ"
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Project Assets</DialogTitle>
            <DialogDescription>
              Bring in files, folders, images, bibliography data, or any other assets. You can also drag files and folders directly into the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto items-start justify-start gap-3 px-4 py-3 text-left"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex flex-col gap-1">
                <span>Choose files</span>
                <span className="text-xs text-ink-400">Select one or more files of any type.</span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto items-start justify-start gap-3 px-4 py-3 text-left"
              onClick={() => uploadDirectoryRef.current?.click()}
            >
              <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex flex-col gap-1">
                <span>Choose folder</span>
                <span className="text-xs text-ink-400">Import an entire directory tree with nested assets.</span>
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={onSettingsOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure editor behavior for your current browser session and saved workspace preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-4">
              <ThemePanel />
            </div>

          <div className="rounded-lg border border-ink-700 bg-ink-900/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-ink-100">Auto compile</h3>
                <p className="text-sm text-ink-400">
                  Automatically recompile after edits, similar to Overleaf. Disabled by default.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoCompile}
                onClick={() => onAutoCompileChange(!autoCompile)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  autoCompile
                    ? "border-amber-glow bg-amber-glow/80"
                    : "border-ink-600 bg-ink-800"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-ink-950 transition-transform ${
                    autoCompile ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-500">
              When enabled, WasmTeX waits briefly after changes before compiling to avoid recompiling on every keystroke.
            </p>
          </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onSettingsOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
