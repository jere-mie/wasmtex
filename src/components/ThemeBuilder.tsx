import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { buildThemeFromColors, generateThemeColors, hslToHex, THEME_COLOR_KEYS } from '@/lib/themes';

// ── Types ─────────────────────────────────────────────────────────────────

interface BuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Generates a random aesthetically-pleasing bg/text/accent triple. */
function randomColors(dark: boolean): { bg: string; text: string; accent: string } {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  const bgHue    = Math.random() * 360;
  // accent hue is 120-200° away from bg so it's clearly distinct
  const accentHue = (bgHue + rand(120, 200)) % 360;
  if (dark) {
    const bgS      = rand(5, 20);   // low saturation for dark bg
    const bgL      = rand(4, 14);
    const textS    = rand(5, 25);
    const textL    = rand(78, 92);
    const accentS  = rand(55, 90);
    const accentL  = rand(55, 72);
    return {
      bg:     hslToHex(bgHue,    bgS,    bgL),
      text:   hslToHex(bgHue,    textS,  textL),
      accent: hslToHex(accentHue, accentS, accentL),
    };
  } else {
    const bgS      = rand(0, 15);
    const bgL      = rand(92, 98);
    const textS    = rand(5, 20);
    const textL    = rand(8, 22);
    const accentS  = rand(55, 85);
    const accentL  = rand(35, 52);
    return {
      bg:     hslToHex(bgHue,    bgS,    bgL),
      text:   hslToHex(bgHue,    textS,  textL),
      accent: hslToHex(accentHue, accentS, accentL),
    };
  }
}

/** Creates a slug-like id from a string + timestamp suffix. */
function makeThemeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'custom';
  return `${slug}-${Date.now().toString(36)}`;
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-300">{label}</label>
      <div className="flex items-center gap-2">
        <div
          className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-ink-600"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="
            w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5
            font-mono text-xs text-ink-100 focus:border-amber-glow focus:outline-none
          "
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function ThemeBuilder({ open, onOpenChange }: BuilderProps) {
  const { addUserTheme, setThemeId } = useTheme();

  const [name, setName]           = useState('My Theme');
  const [isDark, setIsDark]       = useState(true);
  const [bgColor, setBgColor]     = useState('#0c0a0f');
  const [textColor, setTextColor] = useState('#ddd9e8');
  const [accentColor, setAccent]  = useState('#d4a574');

  const previewColors = useMemo(
    () => generateThemeColors(bgColor, textColor, accentColor),
    [bgColor, textColor, accentColor],
  );

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Please enter a theme name');
      return;
    }
    const theme = buildThemeFromColors(
      makeThemeId(trimmed),
      trimmed,
      bgColor,
      textColor,
      accentColor,
      isDark,
    );
    addUserTheme(theme);
    setThemeId(theme.id);
    toast.success(`Theme "${trimmed}" saved`);
    onOpenChange(false);
  };

  const handleRandomize = () => {
    const { bg, text, accent } = randomColors(isDark);
    setBgColor(bg);
    setTextColor(text);
    setAccent(accent);
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Build a Theme</DialogTitle>
          <DialogDescription>
            Pick three colours - the rest of the palette is generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-300">Theme name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Theme"
              className="
                w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-1.5
                text-sm text-ink-100 focus:border-amber-glow focus:outline-none
                placeholder:text-ink-500
              "
            />
          </div>

          {/* Dark / Light toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-300">Mode</span>
            <div className="flex rounded-md border border-ink-600 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setIsDark(true)}
                className={`px-3 py-1.5 transition-colors ${
                  isDark
                    ? 'bg-amber-glow text-ink-950 font-medium'
                    : 'bg-ink-800 text-ink-400 hover:bg-ink-750'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setIsDark(false)}
                className={`px-3 py-1.5 transition-colors ${
                  !isDark
                    ? 'bg-amber-glow text-ink-950 font-medium'
                    : 'bg-ink-800 text-ink-400 hover:bg-ink-750'
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-3 gap-3">
            <ColorPicker label="Background" value={bgColor}    onChange={setBgColor}    />
            <ColorPicker label="Foreground" value={textColor}  onChange={setTextColor}  />
            <ColorPicker label="Accent"     value={accentColor} onChange={setAccent}    />
          </div>

          {/* Live palette preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-ink-300">Generated palette</span>
            <div className="flex h-7 overflow-hidden rounded-md border border-ink-700">
              {THEME_COLOR_KEYS.slice(0, 12).map(key => (
                <div
                  key={key}
                  className="flex-1 relative group"
                  style={{ backgroundColor: previewColors[key] }}
                  title={`${key}: ${previewColors[key]}`}
                />
              ))}
            </div>
            <div className="flex h-5 gap-1">
              {(['--color-amber-glow', '--color-amber-bright', '--color-amber-dim', '--color-amber-muted'] as const).map(key => (
                <div
                  key={key}
                  className="flex-1 rounded-sm"
                  style={{ backgroundColor: previewColors[key] }}
                  title={`${key}: ${previewColors[key]}`}
                />
              ))}
            </div>
          </div>

          {/* Mini editor preview */}
          <div
            className="rounded-md border border-ink-700 p-3 font-mono text-xs leading-relaxed"
            style={{
              backgroundColor: previewColors['--color-ink-900'],
              color: previewColors['--color-ink-200'],
            }}
          >
            <span style={{ color: previewColors['--color-ink-500'] }}>% LaTeX preview</span>
            <br />
            <span style={{ color: previewColors['--color-amber-glow'] }}>{'\\documentclass'}</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'{'}</span>
            <span style={{ color: previewColors['--color-ink-100'] }}>article</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'}'}</span>
            <br />
            <span style={{ color: previewColors['--color-amber-glow'] }}>{'\\begin'}</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'{'}</span>
            <span style={{ color: previewColors['--color-ink-100'] }}>document</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'}'}</span>
            <br />
            <span style={{ color: previewColors['--color-ink-400'] }}>{'  Hello, World!'}</span>
            <br />
            <span style={{ color: previewColors['--color-amber-glow'] }}>{'\\end'}</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'{'}</span>
            <span style={{ color: previewColors['--color-ink-100'] }}>document</span>
            <span style={{ color: previewColors['--color-ink-300'] }}>{'}'}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleRandomize} className="mr-auto gap-1.5">
            <Shuffle className="h-3.5 w-3.5" />
            Randomize
          </Button>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Theme</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
