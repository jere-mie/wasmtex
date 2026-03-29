import { useMemo, useState, type JSX } from "react";
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
  ChevronDown,
  ChevronRight,
  Download,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { buildZip } from "@/lib/zip";
import {
  getVFSFileArrayBuffer,
  getFileBaseName,
  isImageFile,
  type VFSFile,
} from "@/lib/project-files";

interface FolderNode {
  path: string;
  name: string;
  folders: FolderNode[];
  files: VFSFile[];
}

interface RenameTarget {
  kind: "file" | "folder";
  path: string;
}

interface DeleteTarget {
  kind: "file" | "folder";
  path: string;
}

function getParentPath(path: string) {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

function buildFolderTree(files: VFSFile[], folders: string[]) {
  const root: FolderNode = {
    path: "",
    name: "",
    folders: [],
    files: [],
  };
  const nodeMap = new Map<string, FolderNode>([["", root]]);

  const ensureFolderNode = (path: string): FolderNode => {
    if (nodeMap.has(path)) {
      return nodeMap.get(path) as FolderNode;
    }

    const parentPath = getParentPath(path);
    const parentNode = ensureFolderNode(parentPath);
    const node: FolderNode = {
      path,
      name: getFileBaseName(path),
      folders: [],
      files: [],
    };

    parentNode.folders.push(node);
    nodeMap.set(path, node);
    return node;
  };

  for (const folder of folders.slice().sort((left, right) => left.localeCompare(right))) {
    ensureFolderNode(folder);
  }

  for (const file of files.slice().sort((left, right) => left.name.localeCompare(right.name))) {
    const parentNode = ensureFolderNode(getParentPath(file.name));
    parentNode.files.push(file);
  }

  const sortNode = (node: FolderNode) => {
    node.folders.sort((left, right) => left.name.localeCompare(right.name));
    node.files.sort((left, right) => left.name.localeCompare(right.name));
    node.folders.forEach(sortNode);
  };

  sortNode(root);
  return root;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FileExplorer() {
  const {
    files,
    folders,
    activeFile,
    openFile,
    createFile,
    createFolder,
    renameFile,
    renameFolder,
    deleteFile,
    deleteFolder,
    getFile,
  } = useFiles();

  const tree = useMemo(() => buildFolderTree(files, folders), [files, folders]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(folders));
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleRename = () => {
    const nextValue = renameValue.trim();
    if (!renameTarget || !nextValue) return;

    if (renameTarget.kind === "file") {
      renameFile(renameTarget.path, nextValue);
    } else {
      renameFolder(renameTarget.path, nextValue);
    }

    setRenameTarget(null);
    setRenameValue("");
  };

  const handleNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    createFile(name.endsWith(".tex") || name.includes(".") ? name : `${name}.tex`);
    setNewFileName("");
    setNewFileOpen(false);
  };

  const handleNewFolder = () => {
    const path = newFolderName.trim();
    if (!path) return;
    createFolder(path);
    setExpandedFolders((prev) => new Set([...prev, path]));
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "file") {
      deleteFile(deleteTarget.path);
    } else {
      deleteFolder(deleteTarget.path);
    }

    setDeleteTarget(null);
  };

  const handleDownloadFile = (path: string) => {
    const file = getFile(path);
    if (!file) return;

    downloadBlob(
      new Blob([getVFSFileArrayBuffer(file)], { type: file.mimeType ?? "application/octet-stream" }),
      getFileBaseName(path)
    );
  };

  const handleDownloadFolder = (path: string) => {
    const prefix = `${path}/`;
    const folderFiles = files
      .filter((file) => file.name.startsWith(prefix))
      .map((file) => ({
        name: file.name.slice(prefix.length),
        content: file.content,
      }));

    if (folderFiles.length === 0) {
      return;
    }

    const zip = buildZip(folderFiles);
    const zipBuffer = new Uint8Array(zip).buffer;
    downloadBlob(new Blob([zipBuffer], { type: "application/zip" }), `${getFileBaseName(path)}.zip`);
  };

  const renderFile = (file: VFSFile, depth: number) => {
    const isActive = activeFile === file.name;
    const fileName = getFileBaseName(file.name);

    return (
      <ContextMenu key={file.name}>
        <ContextMenuTrigger>
          <button
            onClick={() => openFile(file.name)}
            className={
              isActive
                ? "flex w-full items-center gap-2 border-l-2 border-amber-glow bg-ink-750 py-1.5 pr-3 text-left text-sm text-amber-glow"
                : "flex w-full items-center gap-2 border-l-2 border-transparent py-1.5 pr-3 text-left text-sm text-ink-300 transition-colors duration-100 hover:bg-ink-800 hover:text-ink-100"
            }
            style={{ paddingLeft: `${depth * 14 + 32}px` }}
          >
            {isImageFile(file) ? (
              <FileImage className="h-3.5 w-3.5 shrink-0 opacity-70" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}
            <span className="truncate font-mono text-xs">{fileName}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setRenameTarget({ kind: "file", path: file.name });
              setRenameValue(file.name);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleDownloadFile(file.name)}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Download
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setDeleteTarget({ kind: "file", path: file.name })}
            className="text-error focus:text-error"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderFolder = (folder: FolderNode, depth: number): JSX.Element => {
    const isExpanded = expandedFolders.has(folder.path);

    return (
      <div key={folder.path}>
        <ContextMenu>
          <ContextMenuTrigger>
            <button
              onClick={() => toggleFolder(folder.path)}
              className="flex w-full items-center gap-2 py-1.5 pr-3 text-left text-sm text-ink-300 transition-colors duration-100 hover:bg-ink-800 hover:text-ink-100"
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-500" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-glow" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-glow" />
              )}
              <span className="truncate font-mono text-xs">{folder.name}</span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleDownloadFolder(folder.path)}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Download ZIP
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                setRenameTarget({ kind: "folder", path: folder.path });
                setRenameValue(folder.path);
              }}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Rename
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setDeleteTarget({ kind: "folder", path: folder.path })}
              className="text-error focus:text-error"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {isExpanded && (
          <div>
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.files.map((file) => renderFile(file, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const hasContent = tree.folders.length > 0 || tree.files.length > 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-amber-glow" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
            Explorer
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNewFolderOpen(true)}
            className="rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-750 hover:text-ink-200"
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setNewFileOpen(true)}
            className="rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-750 hover:text-ink-200"
            title="New File"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {tree.folders.map((folder) => renderFolder(folder, 0))}
          {tree.files.map((file) => renderFile(file, 0))}

          {!hasContent && (
            <div className="px-3 py-5 text-sm text-ink-500">
              Drop files or folders here, or create a new file to get started.
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.kind === "folder" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>
              Enter a new path for "{renameTarget?.path}".
            </DialogDescription>
          </DialogHeader>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleRename()}
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-mono text-ink-100 focus:border-amber-glow focus:outline-none"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              Enter a file path. Nested folders like "figures/plot.png" are supported, and source files can end in .tex or .typ.
            </DialogDescription>
          </DialogHeader>
          <input
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleNewFile()}
            placeholder="chapter1.tex or article.typ"
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-500 focus:border-amber-glow focus:outline-none"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFileOpen(false)}>Cancel</Button>
            <Button onClick={handleNewFile}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Enter a folder path. Nested folders like "assets/images" are supported.
            </DialogDescription>
          </DialogHeader>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleNewFolder()}
            placeholder="assets/images"
            className="w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-500 focus:border-amber-glow focus:outline-none"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleNewFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.kind === "folder" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.path}"? This cannot be undone.
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
