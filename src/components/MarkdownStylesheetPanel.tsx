import { Check, Eraser, FileCode2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFiles } from "@/context/FileContext";

interface MarkdownStylesheetPanelProps {
  availableStylesheets: string[];
  selectedStylesheets: string[];
  onToggleStylesheet: (path: string) => void;
  onClearStylesheets: () => void;
}

export function MarkdownStylesheetPanel({
  availableStylesheets,
  selectedStylesheets,
  onToggleStylesheet,
  onClearStylesheets,
}: MarkdownStylesheetPanelProps) {
  const { openFile } = useFiles();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink-100">Markdown Print CSS</h3>
          <p className="mt-1 text-sm text-ink-400">
            Enable one or more project CSS files to customize markdown PDF output. Selected files are applied after the built-in print stylesheet.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onClearStylesheets}
          disabled={selectedStylesheets.length === 0}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      {availableStylesheets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-700 bg-ink-900/60 px-4 py-3 text-sm text-ink-400">
          Add a <span className="font-mono text-ink-200">.css</span> file to your project, then enable it here for markdown PDF rendering.
        </div>
      ) : (
        <div className="space-y-2">
          {availableStylesheets.map((path) => {
            const isSelected = selectedStylesheets.includes(path);

            return (
              <div
                key={path}
                className={isSelected
                  ? "flex items-center justify-between gap-3 rounded-lg border border-amber-glow/50 bg-amber-glow/10 px-3 py-2"
                  : "flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2"
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-ink-100">
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-amber-glow" />
                    <span className="truncate font-mono text-xs">{path}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {isSelected ? "Applied to markdown PDF compilation." : "Available for markdown PDF overrides."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openFile(path)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onToggleStylesheet(path)}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    {isSelected ? "Applied" : "Apply"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-500">
        CSS support is limited to properties supported by the PDF renderer. Typography, spacing, borders, tables, links, and code colors are supported.
      </p>
    </div>
  );
}