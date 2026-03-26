const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const TEXT_EXTENSIONS = new Set([
  "aux",
  "bib",
  "bst",
  "cls",
  "csv",
  "def",
  "html",
  "js",
  "json",
  "log",
  "md",
  "pgf",
  "sty",
  "svg",
  "tex",
  "tikz",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

export type VFSFileKind = "text" | "binary";

export interface VFSFile {
  name: string;
  content: string | Uint8Array;
  kind: VFSFileKind;
  mimeType?: string;
}

export interface ImportedProjectData {
  files: VFSFile[];
  folders: string[];
}

interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  isFile: true;
  file: (callback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
}

interface FileSystemDirectoryReader {
  readEntries: (
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void
  ) => void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  isDirectory: true;
  createReader: () => FileSystemDirectoryReader;
}

type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export function normalizePath(path: string) {
  return path
    .replace(/\\+/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/+/g, "/");
}

export function getFileBaseName(path: string) {
  const normalized = normalizePath(path);
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
}

export function getFileExtension(path: string) {
  const baseName = getFileBaseName(path);
  const lastDot = baseName.lastIndexOf(".");
  return lastDot >= 0 ? baseName.slice(lastDot + 1).toLowerCase() : "";
}

export function getAncestorFolders(path: string) {
  const normalized = normalizePath(path);
  const segments = normalized.split("/").slice(0, -1);
  const folders: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    folders.push(segments.slice(0, index + 1).join("/"));
  }

  return folders;
}

export function getVFSFileBytes(file: VFSFile) {
  return typeof file.content === "string" ? textEncoder.encode(file.content) : file.content;
}

export function getVFSFileArrayBuffer(file: VFSFile) {
  const bytes = getVFSFileBytes(file);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function getVFSFileSize(file: VFSFile) {
  return getVFSFileBytes(file).byteLength;
}

export function isTextFile(file: VFSFile) {
  return file.kind === "text";
}

export function isImageFile(file: VFSFile) {
  return file.mimeType?.startsWith("image/") ?? false;
}

function isKnownTextMimeType(mimeType?: string) {
  if (!mimeType) return false;

  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "image/svg+xml"
  );
}

function looksLikeText(bytes: Uint8Array) {
  if (bytes.length === 0) return true;

  const sample = bytes.subarray(0, Math.min(bytes.length, 1024));
  let suspiciousBytes = 0;

  for (const value of sample) {
    if (value === 0) {
      return false;
    }

    const isControlCharacter = value < 7 || (value > 13 && value < 32);
    if (isControlCharacter) {
      suspiciousBytes += 1;
    }
  }

  return suspiciousBytes / sample.length < 0.1;
}

function detectFileKind(name: string, mimeType: string | undefined, bytes: Uint8Array): VFSFileKind {
  const extension = getFileExtension(name);

  if (TEXT_EXTENSIONS.has(extension) || isKnownTextMimeType(mimeType)) {
    return "text";
  }

  return looksLikeText(bytes) ? "text" : "binary";
}

export async function readBrowserFile(file: File, pathOverride?: string): Promise<VFSFile> {
  const path = normalizePath(pathOverride || file.webkitRelativePath || file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectFileKind(path, file.type || undefined, bytes);

  return {
    name: path,
    kind,
    mimeType: file.type || undefined,
    content: kind === "text" ? textDecoder.decode(bytes) : bytes,
  };
}

export async function collectProjectImportFromFileList(fileList: FileList | File[]) {
  const folders = new Set<string>();
  const files = await Promise.all(
    Array.from(fileList).map(async (file) => {
      const importedFile = await readBrowserFile(file);
      getAncestorFolders(importedFile.name).forEach((folder) => folders.add(folder));
      return importedFile;
    })
  );

  return {
    files: dedupeFiles(files),
    folders: Array.from(folders).sort((left, right) => left.localeCompare(right)),
  } satisfies ImportedProjectData;
}

function readDirectoryEntries(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function getFileFromEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  files: VFSFile[],
  folders: Set<string>
) {
  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry);
    const fullPath = normalizePath(pathPrefix ? `${pathPrefix}/${file.name}` : file.name);
    files.push(await readBrowserFile(file, fullPath));
    return;
  }

  const directoryEntry = entry as FileSystemDirectoryEntry;
  const directoryPath = normalizePath(pathPrefix ? `${pathPrefix}/${directoryEntry.name}` : directoryEntry.name);
  if (directoryPath) {
    folders.add(directoryPath);
  }

  const reader = directoryEntry.createReader();

  while (true) {
    const entries = await readDirectoryEntries(reader);
    if (entries.length === 0) {
      break;
    }

    for (const child of entries) {
      await walkEntry(child, directoryPath, files, folders);
    }
  }
}

function dedupeFiles(files: VFSFile[]) {
  return Array.from(new Map(files.map((file) => [file.name, file])).values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function collectProjectImportFromDataTransfer(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  const discoveredFiles: VFSFile[] = [];
  const folders = new Set<string>();
  let usedEntries = false;

  for (const item of items) {
    if (item.kind !== "file") {
      continue;
    }

    const entry = (item as WebkitDataTransferItem).webkitGetAsEntry?.() ?? null;

    if (entry) {
      usedEntries = true;
      await walkEntry(entry, "", discoveredFiles, folders);
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    const importedFile = await readBrowserFile(file);
    getAncestorFolders(importedFile.name).forEach((folder) => folders.add(folder));
    discoveredFiles.push(importedFile);
  }

  if (!usedEntries && discoveredFiles.length === 0 && dataTransfer.files.length > 0) {
    return collectProjectImportFromFileList(dataTransfer.files);
  }

  return {
    files: dedupeFiles(discoveredFiles),
    folders: Array.from(folders).sort((left, right) => left.localeCompare(right)),
  } satisfies ImportedProjectData;
}

export function hasFileDrag(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types).includes("Files");
}