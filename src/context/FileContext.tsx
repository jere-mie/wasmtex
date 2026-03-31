import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { get, set, del, keys, clear } from "idb-keyval";
import {
  type VFSFile,
  getAncestorFolders,
  normalizePath,
} from "@/lib/project-files";

const DEFAULT_MAIN_TEX = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\title{My First \\LaTeX\\ Document}
\\author{WasmTeX User}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to \\textbf{WasmTeX}, a browser-based \\LaTeX\\ editor powered by WebAssembly.

This document is being compiled entirely in your browser - no server required.

\\section{Mathematics}
The beauty of \\LaTeX\\ lies in its typesetting. Consider Euler's identity:

\\begin{equation}
  e^{i\\pi} + 1 = 0
\\end{equation}

Or the quadratic formula:

\\begin{equation}
  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\end{equation}

\\section{Features}
\\begin{itemize}
  \\item Real-time PDF preview
  \\item Syntax highlighting via Monaco Editor
  \\item Virtual file system with IndexedDB persistence
  \\item Privacy-first: everything stays in your browser
\\end{itemize}

\\end{document}
`;

const DEFAULT_MAIN_TYP = `#set page(numbering: "1")

#align(center)[
  = My First Typst Document
  WasmTeX User
]

== Introduction
Welcome to *WasmTeX*, a browser-based Typst editor powered by WebAssembly.

== Mathematics
Euler's identity:
$ e^(i pi) + 1 = 0 $

Quadratic formula:
$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $

== Features
- Real-time PDF preview
- Syntax highlighting via Monaco Editor
- Virtual file system with IndexedDB persistence
- Privacy-first: everything stays in your browser

`;

interface FileContextType {
  files: VFSFile[];
  folders: string[];
  activeFile: string | null;
  openFiles: string[];
  setActiveFile: (name: string) => void;
  openFile: (name: string) => void;
  closeFile: (name: string) => void;
  createFile: (name: string, content?: string) => void;
  createFolder: (path: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  renameFolder: (oldPath: string, newPath: string) => void;
  deleteFile: (name: string) => void;
  deleteFolder: (path: string) => void;
  importFiles: (incomingFiles: VFSFile[], incomingFolders?: string[]) => void;
  updateFileContent: (name: string, content: string) => void;
  getFile: (name: string) => VFSFile | undefined;
  getFileContent: (name: string) => string | undefined;
  resetToDefaults: () => Promise<void>;
}

const FileContext = createContext<FileContextType | null>(null);

const IDB_PREFIX = "wasmtex:";
const IDB_FOLDERS_KEY = `${IDB_PREFIX}__folders__`;
const LS_OPEN_FILES_KEY = "wasmtex:open-files";
const LS_ACTIVE_FILE_KEY = "wasmtex:active-file";

function sortFiles(nextFiles: VFSFile[]) {
  return [...nextFiles].sort((left, right) => left.name.localeCompare(right.name));
}

function sortFolders(nextFolders: string[]) {
  return [...new Set(nextFolders.map((folder) => normalizePath(folder)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function mergeFolders(existingFolders: string[], incomingFolders: string[]) {
  return sortFolders([...existingFolders, ...incomingFolders]);
}

function serializeFile(file: VFSFile) {
  return {
    content: file.content,
    kind: file.kind,
    mimeType: file.mimeType,
  };
}

function isPersistedFileRecord(
  value: unknown
): value is { content: string | Uint8Array; kind?: string; mimeType?: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "content" in value &&
    (typeof value.content === "string" || value.content instanceof Uint8Array)
  );
}

function deserializeFile(name: string, value: unknown): VFSFile {
  if (typeof value === "string") {
    return {
      name,
      content: value,
      kind: "text",
    };
  }

  if (isPersistedFileRecord(value)) {
    return {
      name,
      content: value.content,
      kind: value.kind === "binary" ? "binary" : "text",
      mimeType: typeof value.mimeType === "string" ? value.mimeType : undefined,
    };
  }

  return {
    name,
    content: "",
    kind: "text",
  };
}

export function FileProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<VFSFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const allKeys = await keys();
      const vfsKeys = (allKeys as string[]).filter((k) =>
        k.startsWith(IDB_PREFIX) && k !== IDB_FOLDERS_KEY
      );
      const storedFolders = await get(IDB_FOLDERS_KEY);

      if (vfsKeys.length === 0) {
        // Initialize with default main.tex and a sample main.typ
        const texFile: VFSFile = {
          name: "main.tex",
          content: DEFAULT_MAIN_TEX,
          kind: "text",
        };
        const typFile: VFSFile = {
          name: "main.typ",
          content: DEFAULT_MAIN_TYP,
          kind: "text",
        };
        await set(IDB_PREFIX + "main.tex", serializeFile(texFile));
        await set(IDB_PREFIX + "main.typ", serializeFile(typFile));
        setFiles([texFile, typFile]);
        setFolders([]);
        // Preserve original behavior: keep main.tex active, but open both files
        setActiveFile("main.tex");
        setOpenFiles(["main.tex", "main.typ"]);
      } else {
        const loaded: VFSFile[] = [];
        for (const key of vfsKeys) {
          const name = (key as string).replace(IDB_PREFIX, "");
          const content = await get(key);
          loaded.push(deserializeFile(name, content));
        }
        const nextFiles = sortFiles(loaded);
        const derivedFolders = nextFiles.flatMap((file) => getAncestorFolders(file.name));
        const nextFolders = mergeFolders(
          Array.isArray(storedFolders) ? (storedFolders as string[]) : [],
          derivedFolders
        );

        setFiles(nextFiles);
        setFolders(nextFolders);

        // Restore open files from localStorage, filtering out any that no longer exist
        const fileNames = new Set(nextFiles.map((f) => f.name));
        const savedOpen = JSON.parse(localStorage.getItem(LS_OPEN_FILES_KEY) ?? "null") as string[] | null;
        const savedActive = localStorage.getItem(LS_ACTIVE_FILE_KEY);
        const restoredOpen = savedOpen?.filter((n) => fileNames.has(n));
        const nextOpen = restoredOpen && restoredOpen.length > 0 ? restoredOpen : [nextFiles[0]?.name].filter(Boolean) as string[];
        const nextActive = savedActive && fileNames.has(savedActive) ? savedActive : (nextOpen[0] ?? null);
        setOpenFiles(nextOpen);
        setActiveFile(nextActive);
      }
      setLoaded(true);
    })();
  }, []);

  // Persist open files and active file to localStorage after initial load
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LS_OPEN_FILES_KEY, JSON.stringify(openFiles));
  }, [openFiles, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (activeFile !== null) {
      localStorage.setItem(LS_ACTIVE_FILE_KEY, activeFile);
    }
  }, [activeFile, loaded]);

  const persistFile = useCallback(async (file: VFSFile) => {
    await set(IDB_PREFIX + file.name, serializeFile(file));
  }, []);

  const persistFolders = useCallback(async (nextFolders: string[]) => {
    await set(IDB_FOLDERS_KEY, sortFolders(nextFolders));
  }, []);

  const createFile = useCallback(
    (name: string, content = "") => {
      const normalizedName = normalizePath(name);
      if (!normalizedName || files.some((f) => f.name === normalizedName)) return;
      const newFile: VFSFile = { name: normalizedName, content, kind: "text" };
      const nextFolders = mergeFolders(folders, getAncestorFolders(normalizedName));
      setFiles((prev) => sortFiles([...prev, newFile]));
      setFolders(nextFolders);
      setOpenFiles((prev) => (prev.includes(normalizedName) ? prev : [...prev, normalizedName]));
      setActiveFile(normalizedName);
      void persistFile(newFile);
      void persistFolders(nextFolders);
    },
    [files, folders, persistFile, persistFolders]
  );

  const createFolder = useCallback(
    (path: string) => {
      const normalizedPath = normalizePath(path);
      if (!normalizedPath) return;
      const nextFolders = mergeFolders(folders, [...getAncestorFolders(`${normalizedPath}/placeholder`), normalizedPath]);
      setFolders(nextFolders);
      void persistFolders(nextFolders);
    },
    [folders, persistFolders]
  );

  const renameFile = useCallback(
    (oldName: string, newName: string) => {
      const normalizedNewName = normalizePath(newName);
      if (!normalizedNewName || files.some((f) => f.name === normalizedNewName)) return;
      setFiles((prev) =>
        sortFiles(prev.map((f) => (f.name === oldName ? { ...f, name: normalizedNewName } : f)))
      );
      setOpenFiles((prev) =>
        prev.map((n) => (n === oldName ? normalizedNewName : n))
      );
      if (activeFile === oldName) setActiveFile(normalizedNewName);
      const nextFolders = mergeFolders(folders, getAncestorFolders(normalizedNewName));
      setFolders(nextFolders);
      // Migrate IDB
      void (async () => {
        const targetFile = files.find((file) => file.name === oldName);
        if (targetFile) {
          await persistFile({ ...targetFile, name: normalizedNewName });
        }
        await del(IDB_PREFIX + oldName);
        await persistFolders(nextFolders);
      })();
    },
    [files, activeFile, folders, persistFile, persistFolders]
  );

  const renameFolder = useCallback(
    (oldPath: string, newPath: string) => {
      const sourcePrefix = normalizePath(oldPath);
      const targetPrefix = normalizePath(newPath);
      if (!sourcePrefix || !targetPrefix || sourcePrefix === targetPrefix) return;

      const prefixWithSlash = `${sourcePrefix}/`;
      const targetWithSlash = `${targetPrefix}/`;
      const hasConflict =
        files.some(
          (file) =>
            !file.name.startsWith(prefixWithSlash) &&
            (file.name === targetPrefix || file.name.startsWith(targetWithSlash))
        ) ||
        folders.some(
          (folder) =>
            folder !== sourcePrefix &&
            !folder.startsWith(prefixWithSlash) &&
            (folder === targetPrefix || folder.startsWith(targetWithSlash))
        );

      if (hasConflict) return;

      const renamedFiles = files.map((file) =>
        file.name.startsWith(prefixWithSlash)
          ? { ...file, name: `${targetPrefix}/${file.name.slice(prefixWithSlash.length)}` }
          : file
      );
      const renamedFolders = sortFolders(
        folders.map((folder) =>
          folder === sourcePrefix
            ? targetPrefix
            : folder.startsWith(prefixWithSlash)
              ? `${targetPrefix}/${folder.slice(prefixWithSlash.length)}`
              : folder
        )
      );

      setFiles(sortFiles(renamedFiles));
      setFolders(renamedFolders);
      setOpenFiles((prev) =>
        prev.map((name) =>
          name.startsWith(prefixWithSlash)
            ? `${targetPrefix}/${name.slice(prefixWithSlash.length)}`
            : name
        )
      );
      if (activeFile?.startsWith(prefixWithSlash)) {
        setActiveFile(`${targetPrefix}/${activeFile.slice(prefixWithSlash.length)}`);
      }

      void (async () => {
        const filesToRename = files.filter((file) => file.name.startsWith(prefixWithSlash));
        for (const file of filesToRename) {
          await del(IDB_PREFIX + file.name);
        }
        for (const file of filesToRename) {
          await persistFile({
            ...file,
            name: `${targetPrefix}/${file.name.slice(prefixWithSlash.length)}`,
          });
        }
        await persistFolders(renamedFolders);
      })();
    },
    [activeFile, files, folders, persistFile, persistFolders]
  );

  const deleteFile = useCallback(
    (name: string) => {
      setFiles((prev) => prev.filter((f) => f.name !== name));
      setOpenFiles((prev) => prev.filter((n) => n !== name));
      if (activeFile === name) {
        setActiveFile(() => {
          const remaining = files.filter((f) => f.name !== name);
          return remaining[0]?.name ?? null;
        });
      }
      void del(IDB_PREFIX + name);
    },
    [files, activeFile]
  );

  const deleteFolder = useCallback(
    (path: string) => {
      const normalizedPath = normalizePath(path);
      if (!normalizedPath) return;
      const prefixWithSlash = `${normalizedPath}/`;
      const remainingFiles = files.filter(
        (file) => file.name !== normalizedPath && !file.name.startsWith(prefixWithSlash)
      );
      const remainingFolders = folders.filter(
        (folder) => folder !== normalizedPath && !folder.startsWith(prefixWithSlash)
      );

      setFiles(remainingFiles);
      setFolders(remainingFolders);
      setOpenFiles((prev) =>
        prev.filter((name) => name !== normalizedPath && !name.startsWith(prefixWithSlash))
      );
      if (activeFile === normalizedPath || activeFile?.startsWith(prefixWithSlash)) {
        setActiveFile(remainingFiles[0]?.name ?? null);
      }

      void (async () => {
        const removedFiles = files.filter(
          (file) => file.name !== normalizedPath && file.name.startsWith(prefixWithSlash)
        );
        for (const file of removedFiles) {
          await del(IDB_PREFIX + file.name);
        }
        await persistFolders(remainingFolders);
      })();
    },
    [activeFile, files, folders, persistFolders]
  );

  const importFiles = useCallback(
    (incomingFiles: VFSFile[], incomingFolders: string[] = []) => {
      if (incomingFiles.length === 0) return;

      const uniqueIncoming = Array.from(
        new Map(
          incomingFiles.map((file) => [normalizePath(file.name), { ...file, name: normalizePath(file.name) }])
        ).values()
      );
      const nextFolders = mergeFolders(
        folders,
        [...incomingFolders, ...uniqueIncoming.flatMap((file) => getAncestorFolders(file.name))]
      );

      setFiles((prev) => {
        const merged = new Map(prev.map((file) => [file.name, file]));

        uniqueIncoming.forEach((file) => {
          merged.set(file.name, file);
          void persistFile(file);
        });

        return sortFiles(Array.from(merged.values()));
      });

      setFolders(nextFolders);
      void persistFolders(nextFolders);
    },
    [folders, persistFile, persistFolders]
  );

  const updateFileContent = useCallback(
    (name: string, content: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.name === name && f.kind === "text" ? { ...f, content } : f))
      );
      const currentFile = files.find((file) => file.name === name);
      if (currentFile && currentFile.kind === "text") {
        void persistFile({ ...currentFile, content });
      }
    },
    [files, persistFile]
  );

  const getFile = useCallback(
    (name: string) => files.find((file) => file.name === name),
    [files]
  );

  const getFileContent = useCallback(
    (name: string) => {
      const file = files.find((entry) => entry.name === name);
      return typeof file?.content === "string" ? file.content : undefined;
    },
    [files]
  );

  const resetToDefaults = useCallback(async () => {
    // Wipe everything from IndexedDB then re-seed with the two default files
    await clear();
    const texFile: VFSFile = { name: "main.tex", content: DEFAULT_MAIN_TEX, kind: "text" };
    const typFile: VFSFile = { name: "main.typ", content: DEFAULT_MAIN_TYP, kind: "text" };
    await set(IDB_PREFIX + "main.tex", serializeFile(texFile));
    await set(IDB_PREFIX + "main.typ", serializeFile(typFile));
    setFiles([texFile, typFile]);
    setFolders([]);
    setOpenFiles(["main.tex", "main.typ"]);
    setActiveFile("main.tex");
  }, []);

  const openFile = useCallback(
    (name: string) => {
      setOpenFiles((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setActiveFile(name);
    },
    []
  );

  const closeFile = useCallback(
    (name: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((n) => n !== name);
        if (activeFile === name) {
          const idx = prev.indexOf(name);
          const nextActive = next[Math.min(idx, next.length - 1)] ?? null;
          setActiveFile(nextActive);
        }
        return next;
      });
    },
    [activeFile]
  );

  if (!loaded) return null;

  return (
    <FileContext.Provider
      value={{
        files,
        folders,
        activeFile,
        openFiles,
        setActiveFile,
        openFile,
        closeFile,
        createFile,
        createFolder,
        renameFile,
        renameFolder,
        deleteFile,
        deleteFolder,
        importFiles,
        updateFileContent,
        getFile,
        getFileContent,
        resetToDefaults,
      }}
    >
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (!context) throw new Error("useFiles must be used within FileProvider");
  return context;
}
