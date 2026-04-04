import { useRef, useState } from 'react';
import { Check, Download, Trash2, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTheme } from '@/context/ThemeContext';
import { BUILTIN_THEMES, themeFromImport, type ThemeImportData, type WasmTexTheme } from '@/lib/themes';
import { ThemeBuilder } from '@/components/ThemeBuilder';

/** Five representative swatch keys sampled from the ink scale + accent. */
const SWATCH_KEYS = [
  '--color-ink-900',
  '--color-ink-750',
  '--color-ink-600',
  '--color-ink-300',
  '--color-amber-glow',
] as const;

function ThemeCard({
  theme,
  isActive,
  onSelect,
  onDelete,
  onDownload,
}: {
  theme: { id: string; name: string; builtin: boolean; isDark: boolean; colors: Record<string, string> };
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex flex-col gap-2 rounded-lg border p-3 text-left
        transition-all duration-150 cursor-pointer
        ${isActive
          ? 'border-amber-glow bg-ink-800 shadow-[0_0_0_1px_var(--color-amber-glow)]'
          : 'border-ink-700 bg-ink-900 hover:border-ink-500 hover:bg-ink-850'
        }
      `}
    >
      {/* Color swatches */}
      <div className="flex gap-1">
        {SWATCH_KEYS.map(key => (
          <span
            key={key}
            className="h-4 flex-1 rounded-sm"
            style={{ backgroundColor: theme.colors[key] ?? '#888' }}
          />
        ))}
      </div>

      {/* Name + active indicator */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-200 truncate">{theme.name}</span>
        {isActive && (
          <span className="shrink-0 rounded-full bg-amber-glow p-0.5 text-ink-950">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Download + Delete buttons (user themes only) */}
      {!theme.builtin && (
        <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
          {onDownload && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDownload(); }}
              className="rounded p-1 bg-[#1c1922] text-[#b5afc5] hover:bg-[#342e40] hover:text-[#e8c49a]"
              title="Download theme JSON"
            >
              <Download className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="rounded p-1 bg-[#1c1922] text-[#b5afc5] hover:bg-[#342e40] hover:text-[#f87171]"
              title="Remove theme"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </button>
  );
}

export function ThemePanel() {
  const { activeTheme, userThemes, setThemeId, addUserTheme, removeUserTheme } = useTheme();
  const importRef = useRef<HTMLInputElement | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const allThemes = [...BUILTIN_THEMES, ...userThemes];

  const handleDownloadTheme = (theme: WasmTexTheme) => {
    const json = JSON.stringify({ ...theme, builtin: false }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      toast.error('Invalid JSON', { description: 'Could not parse the theme file.' });
      return;
    }

    if (
      typeof raw !== 'object' ||
      raw === null ||
      typeof (raw as Record<string, unknown>).name !== 'string' ||
      typeof (raw as Record<string, unknown>).colors !== 'object'
    ) {
      toast.error('Invalid theme format', {
        description: 'The file must have at least a "name" string and a "colors" object.',
      });
      return;
    }

    const theme = themeFromImport(raw as ThemeImportData);
    addUserTheme(theme);
    setThemeId(theme.id);
    toast.success(`Theme "${theme.name}" imported`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-100">Appearance</h3>
        <span className="text-xs text-ink-500">
          {activeTheme.isDark ? 'Dark' : 'Light'} - {activeTheme.name}
        </span>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allThemes.map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={activeTheme.id === theme.id}
            onSelect={() => setThemeId(theme.id)}
            onDelete={!theme.builtin ? () => removeUserTheme(theme.id) : undefined}
            onDownload={!theme.builtin ? () => handleDownloadTheme(theme) : undefined}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setBuilderOpen(true)}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Build a Theme
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportJson}
        />
      </div>

      <ThemeBuilder open={builderOpen} onOpenChange={setBuilderOpen} />
    </div>
  );
}
