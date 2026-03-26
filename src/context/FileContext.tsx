import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { get, set, del, keys } from "idb-keyval";

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

export interface VFSFile {
  name: string;
  content: string;
}

interface FileContextType {
  files: VFSFile[];
  activeFile: string | null;
  openFiles: string[];
  setActiveFile: (name: string) => void;
  openFile: (name: string) => void;
  closeFile: (name: string) => void;
  createFile: (name: string, content?: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  deleteFile: (name: string) => void;
  importFiles: (incomingFiles: VFSFile[]) => void;
  updateFileContent: (name: string, content: string) => void;
  getFileContent: (name: string) => string | undefined;
}

const FileContext = createContext<FileContextType | null>(null);

const IDB_PREFIX = "wasmtex:";

export function FileProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<VFSFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const allKeys = await keys();
      const vfsKeys = (allKeys as string[]).filter((k) =>
        k.startsWith(IDB_PREFIX)
      );

      if (vfsKeys.length === 0) {
        // Initialize with default main.tex
        const defaultFile: VFSFile = {
          name: "main.tex",
          content: DEFAULT_MAIN_TEX,
        };
        await set(IDB_PREFIX + "main.tex", DEFAULT_MAIN_TEX);
        setFiles([defaultFile]);
        setActiveFile("main.tex");
        setOpenFiles(["main.tex"]);
      } else {
        const loaded: VFSFile[] = [];
        for (const key of vfsKeys) {
          const name = (key as string).replace(IDB_PREFIX, "");
          const content = await get(key);
          loaded.push({ name, content: content as string });
        }
        loaded.sort((a, b) => a.name.localeCompare(b.name));
        setFiles(loaded);
        setActiveFile(loaded[0]?.name ?? null);
        setOpenFiles([loaded[0]?.name].filter(Boolean) as string[]);
      }
      setLoaded(true);
    })();
  }, []);

  const persistFile = useCallback(async (name: string, content: string) => {
    await set(IDB_PREFIX + name, content);
  }, []);

  const createFile = useCallback(
    (name: string, content = "") => {
      if (files.some((f) => f.name === name)) return;
      const newFile: VFSFile = { name, content };
      setFiles((prev) => [...prev, newFile].sort((a, b) => a.name.localeCompare(b.name)));
      setOpenFiles((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setActiveFile(name);
      persistFile(name, content);
    },
    [files, persistFile]
  );

  const renameFile = useCallback(
    (oldName: string, newName: string) => {
      if (files.some((f) => f.name === newName)) return;
      setFiles((prev) =>
        prev
          .map((f) => (f.name === oldName ? { ...f, name: newName } : f))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setOpenFiles((prev) =>
        prev.map((n) => (n === oldName ? newName : n))
      );
      if (activeFile === oldName) setActiveFile(newName);
      // Migrate IDB
      (async () => {
        const content = await get(IDB_PREFIX + oldName);
        await set(IDB_PREFIX + newName, content);
        await del(IDB_PREFIX + oldName);
      })();
    },
    [files, activeFile]
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
      del(IDB_PREFIX + name);
    },
    [files, activeFile]
  );

  const importFiles = useCallback(
    (incomingFiles: VFSFile[]) => {
      if (incomingFiles.length === 0) return;

      const uniqueIncoming = Array.from(
        new Map(incomingFiles.map((file) => [file.name, file])).values()
      );

      setFiles((prev) => {
        const merged = new Map(prev.map((file) => [file.name, file]));

        uniqueIncoming.forEach((file) => {
          merged.set(file.name, file);
          void persistFile(file.name, file.content);
        });

        return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
      });

      setOpenFiles((prev) => Array.from(new Set([...prev, ...uniqueIncoming.map((file) => file.name)])));
      setActiveFile(uniqueIncoming[0]?.name ?? null);
    },
    [persistFile]
  );

  const updateFileContent = useCallback(
    (name: string, content: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.name === name ? { ...f, content } : f))
      );
      persistFile(name, content);
    },
    [persistFile]
  );

  const getFileContent = useCallback(
    (name: string) => files.find((f) => f.name === name)?.content,
    [files]
  );

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
        activeFile,
        openFiles,
        setActiveFile,
        openFile,
        closeFile,
        createFile,
        renameFile,
        deleteFile,
        importFiles,
        updateFileContent,
        getFileContent,
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
