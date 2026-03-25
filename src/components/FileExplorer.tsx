import { useState, useCallback } from "react";
import { useFiles } from "@/context/FileContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FolderOpen,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

export function FileExplorer() {
  const {
    files,
    activeFile,
    openFile,
    createFile,
    renameFile,
    deleteFile,
  } = useFiles();

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleRename = useCallback(() => {
    if (renameTarget && renameValue.trim()) {
      renameFile(renameTarget, renameValue.trim());
      setRenameTarget(null);
      setRenameValue("");
    }
  }, [renameTarget, renameValue, renameFile]);

  const handleNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    createFile(name.endsWith(".tex") || name.includes(".") ? name : name + ".tex");
    setNewFileName("");
    setNewFileOpen(false);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteFile(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-ink-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink-700">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-amber-glow" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
            Explorer
          </span>
        </div>
        <button
          onClick={() => setNewFileOpen(true)}
          className="p-0.5 rounded hover:bg-ink-750 text-ink-400 hover:text-ink-200 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* File tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {files.map((file) => (
            <ContextMenu key={file.name}>
              <ContextMenuTrigger>
                <button
                  onClick={() => openFile(file.name)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm cursor-pointer
                    transition-colors duration-100
                    ${
                      activeFile === file.name
                        ? "bg-ink-750 text-amber-glow border-l-2 border-amber-glow"
                        : "text-ink-300 hover:bg-ink-800 hover:text-ink-100 border-l-2 border-transparent"
                    }
                  `}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate font-mono text-xs">{file.name}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    setRenameTarget(file.name);
                    setRenameValue(file.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => setDeleteTarget(file.name)}
                  className="text-error focus:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>Enter a new name for "{renameTarget}"</DialogDescription>
          </DialogHeader>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="w-full px-3 py-2 rounded-md bg-ink-800 border border-ink-600 text-ink-100 text-sm font-mono focus:outline-none focus:border-amber-glow"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>Enter a name for the new file.</DialogDescription>
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
            <Button variant="outline" onClick={() => setNewFileOpen(false)}>Cancel</Button>
            <Button onClick={handleNewFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
