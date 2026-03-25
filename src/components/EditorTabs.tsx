import { useFiles } from "@/context/FileContext";
import { X } from "lucide-react";

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useFiles();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-ink-900 border-b border-ink-700 overflow-x-auto shrink-0">
      {openFiles.map((name) => (
        <div
          key={name}
          className={`
            group flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono cursor-pointer
            border-r border-ink-700 transition-colors duration-100
            ${
              activeFile === name
                ? "bg-ink-850 text-amber-glow border-b-2 border-b-amber-glow -mb-px"
                : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
            }
          `}
          onClick={() => setActiveFile(name)}
        >
          <span className="truncate max-w-[120px]">{name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeFile(name);
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-ink-700 transition-opacity cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
