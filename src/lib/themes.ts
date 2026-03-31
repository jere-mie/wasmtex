// ── Theme type definitions ─────────────────────────────────────────────────

export const THEME_COLOR_KEYS = [
  '--color-ink-950',
  '--color-ink-900',
  '--color-ink-850',
  '--color-ink-800',
  '--color-ink-750',
  '--color-ink-700',
  '--color-ink-600',
  '--color-ink-500',
  '--color-ink-400',
  '--color-ink-300',
  '--color-ink-200',
  '--color-ink-100',
  '--color-amber-glow',
  '--color-amber-bright',
  '--color-amber-dim',
  '--color-amber-muted',
  '--color-parchment',
  '--color-parchment-dim',
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export interface MonacoThemeDefinition {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: Array<{
    token: string;
    foreground?: string;
    fontStyle?: string;
    background?: string;
  }>;
  colors: Record<string, string>;
}

export interface WasmTexTheme {
  id: string;
  name: string;
  author?: string;
  isDark: boolean;
  builtin: boolean;
  description?: string;
  colors: Record<ThemeColorKey, string>;
  monacoTheme: MonacoThemeDefinition;
}

/** JSON structure accepted for user-imported theme files */
export interface ThemeImportData {
  id?: string;
  name: string;
  author?: string;
  isDark?: boolean;
  colors: Partial<Record<string, string>>;
  monacoTheme?: Partial<MonacoThemeDefinition>;
}

export function getMonacoThemeId(themeId: string): string {
  return `wasmtex-${themeId}`;
}

// ── Built-in themes ────────────────────────────────────────────────────────

const INK_AMBER: WasmTexTheme = {
  id: 'ink-amber',
  name: 'Ink & Amber',
  isDark: true,
  builtin: true,
  description: 'Deep purple-black with warm amber gold. The original WasmTeX palette.',
  colors: {
    '--color-ink-950': '#08060a',
    '--color-ink-900': '#0c0a0f',
    '--color-ink-850': '#100e14',
    '--color-ink-800': '#17141c',
    '--color-ink-750': '#1c1922',
    '--color-ink-700': '#231f2a',
    '--color-ink-600': '#342e40',
    '--color-ink-500': '#504866',
    '--color-ink-400': '#6b6080',
    '--color-ink-300': '#8e85a3',
    '--color-ink-200': '#b5afc5',
    '--color-ink-100': '#ddd9e8',
    '--color-amber-glow': '#d4a574',
    '--color-amber-bright': '#e8c49a',
    '--color-amber-dim': '#a67c52',
    '--color-amber-muted': '#7a5c3d',
    '--color-parchment': '#f5f0e8',
    '--color-parchment-dim': '#e0d8cc',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b6080', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'd4a574' },
      { token: 'keyword.control', foreground: 'f59e0b' },
      { token: 'string', foreground: '4ade80' },
      { token: 'string.raw', foreground: '86efac' },
      { token: 'number', foreground: 'e8c49a' },
      { token: 'type', foreground: 'c4b5fd' },
      { token: 'type.identifier', foreground: 'c4b5fd' },
      { token: 'function', foreground: '7dd3fc' },
      { token: 'namespace', foreground: '67e8f9' },
      { token: 'operator', foreground: 'f1f5f9' },
      { token: 'escape', foreground: 'c4b5fd' },
      { token: 'markup.heading', foreground: 'fbbf24', fontStyle: 'bold' },
      { token: 'markup.list', foreground: '8e85a3' },
      { token: 'markup.emphasis', foreground: 'f9a8d4' },
      { token: 'delimiter', foreground: '8e85a3' },
      { token: 'tag', foreground: 'd4a574' },
      { token: 'attribute.name', foreground: 'e8c49a' },
      { token: 'attribute.value', foreground: '4ade80' },
    ],
    colors: {
      'editor.background': '#0c0a0f',
      'editor.foreground': '#ddd9e8',
      'editor.lineHighlightBackground': '#17141c',
      'editor.selectionBackground': '#d4a57430',
      'editor.inactiveSelectionBackground': '#d4a57415',
      'editorCursor.foreground': '#d4a574',
      'editorLineNumber.foreground': '#504866',
      'editorLineNumber.activeForeground': '#d4a574',
      'editorIndentGuide.background1': '#1c1922',
      'editorIndentGuide.activeBackground1': '#342e40',
      'editorBracketMatch.background': '#d4a57420',
      'editorBracketMatch.border': '#d4a57460',
      'editor.wordHighlightBackground': '#d4a57415',
      'editorWidget.background': '#100e14',
      'editorWidget.border': '#342e40',
      'editorSuggestWidget.background': '#100e14',
      'editorSuggestWidget.border': '#342e40',
      'editorSuggestWidget.selectedBackground': '#1c1922',
      'input.background': '#17141c',
      'input.border': '#342e40',
      'input.foreground': '#ddd9e8',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#504866',
      'scrollbarSlider.hoverBackground': '#6b6080',
      'scrollbarSlider.activeBackground': '#8e85a3',
    },
  },
};

const IVORY: WasmTexTheme = {
  id: 'ivory',
  name: 'Ivory',
  isDark: false,
  builtin: true,
  description: 'Warm parchment paper. Easy on the eyes in bright environments.',
  colors: {
    '--color-ink-950': '#faf8f4',
    '--color-ink-900': '#f5f0e8',
    '--color-ink-850': '#ede8dc',
    '--color-ink-800': '#e4ddd1',
    '--color-ink-750': '#d8d0c2',
    '--color-ink-700': '#c8bcaa',
    '--color-ink-600': '#a8977f',
    '--color-ink-500': '#8a7b66',
    '--color-ink-400': '#6e5f4a',
    '--color-ink-300': '#574738',
    '--color-ink-200': '#3d3126',
    '--color-ink-100': '#241e16',
    '--color-amber-glow': '#7a5230',
    '--color-amber-bright': '#9c6e44',
    '--color-amber-dim': '#5c3c22',
    '--color-amber-muted': '#3e2815',
    '--color-parchment': '#f5f0e8',
    '--color-parchment-dim': '#e0d8cc',
  },
  monacoTheme: {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: 'a8977f', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7a5230' },
      { token: 'keyword.control', foreground: '8b5e3c' },
      { token: 'string', foreground: '2a7a3b' },
      { token: 'string.raw', foreground: '3a8a4a' },
      { token: 'number', foreground: '6b4420' },
      { token: 'type', foreground: '6040a0' },
      { token: 'type.identifier', foreground: '6040a0' },
      { token: 'function', foreground: '1a5c8a' },
      { token: 'namespace', foreground: '1a7a8a' },
      { token: 'operator', foreground: '3d3126' },
      { token: 'escape', foreground: '6040a0' },
      { token: 'markup.heading', foreground: '7a5230', fontStyle: 'bold' },
      { token: 'markup.list', foreground: '8a7b66' },
      { token: 'markup.emphasis', foreground: 'c04080' },
      { token: 'delimiter', foreground: 'a8977f' },
      { token: 'tag', foreground: '7a5230' },
      { token: 'attribute.name', foreground: '6b4420' },
      { token: 'attribute.value', foreground: '2a7a3b' },
    ],
    colors: {
      'editor.background': '#f5f0e8',
      'editor.foreground': '#241e16',
      'editor.lineHighlightBackground': '#ede8dc',
      'editor.selectionBackground': '#7a523030',
      'editor.inactiveSelectionBackground': '#7a523015',
      'editorCursor.foreground': '#7a5230',
      'editorLineNumber.foreground': '#a8977f',
      'editorLineNumber.activeForeground': '#7a5230',
      'editorIndentGuide.background1': '#d8d0c2',
      'editorIndentGuide.activeBackground1': '#c8bcaa',
      'editorBracketMatch.background': '#7a523020',
      'editorBracketMatch.border': '#7a523060',
      'editor.wordHighlightBackground': '#7a523015',
      'editorWidget.background': '#ede8dc',
      'editorWidget.border': '#c8bcaa',
      'editorSuggestWidget.background': '#ede8dc',
      'editorSuggestWidget.border': '#c8bcaa',
      'editorSuggestWidget.selectedBackground': '#d8d0c2',
      'input.background': '#e4ddd1',
      'input.border': '#c8bcaa',
      'input.foreground': '#241e16',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#a8977f80',
      'scrollbarSlider.hoverBackground': '#8a7b66a0',
      'scrollbarSlider.activeBackground': '#6e5f4a',
    },
  },
};

const OBSIDIAN: WasmTexTheme = {
  id: 'obsidian',
  name: 'Obsidian',
  isDark: true,
  builtin: true,
  description: 'Jet black with electric cyan — stark, precise, futuristic.',
  colors: {
    '--color-ink-950': '#030408',
    '--color-ink-900': '#060810',
    '--color-ink-850': '#0a0c18',
    '--color-ink-800': '#10141f',
    '--color-ink-750': '#161a28',
    '--color-ink-700': '#1d2235',
    '--color-ink-600': '#2b3050',
    '--color-ink-500': '#3e4570',
    '--color-ink-400': '#555c8a',
    '--color-ink-300': '#747ca4',
    '--color-ink-200': '#9ea5c5',
    '--color-ink-100': '#d2d6ee',
    '--color-amber-glow': '#00d4c8',
    '--color-amber-bright': '#40e8e0',
    '--color-amber-dim': '#009e94',
    '--color-amber-muted': '#00695f',
    '--color-parchment': '#e8f8f6',
    '--color-parchment-dim': '#c8ece8',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '555c8a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '00d4c8' },
      { token: 'keyword.control', foreground: '40e8e0' },
      { token: 'string', foreground: '4ade80' },
      { token: 'string.raw', foreground: '86efac' },
      { token: 'number', foreground: '40e8e0' },
      { token: 'type', foreground: 'c4b5fd' },
      { token: 'type.identifier', foreground: 'c4b5fd' },
      { token: 'function', foreground: '60a5fa' },
      { token: 'namespace', foreground: '00d4c8' },
      { token: 'operator', foreground: 'd2d6ee' },
      { token: 'escape', foreground: 'c4b5fd' },
      { token: 'markup.heading', foreground: '00d4c8', fontStyle: 'bold' },
      { token: 'markup.list', foreground: '747ca4' },
      { token: 'markup.emphasis', foreground: 'f9a8d4' },
      { token: 'delimiter', foreground: '747ca4' },
      { token: 'tag', foreground: '00d4c8' },
      { token: 'attribute.name', foreground: '40e8e0' },
      { token: 'attribute.value', foreground: '4ade80' },
    ],
    colors: {
      'editor.background': '#060810',
      'editor.foreground': '#d2d6ee',
      'editor.lineHighlightBackground': '#10141f',
      'editor.selectionBackground': '#00d4c830',
      'editor.inactiveSelectionBackground': '#00d4c815',
      'editorCursor.foreground': '#00d4c8',
      'editorLineNumber.foreground': '#3e4570',
      'editorLineNumber.activeForeground': '#00d4c8',
      'editorIndentGuide.background1': '#161a28',
      'editorIndentGuide.activeBackground1': '#2b3050',
      'editorBracketMatch.background': '#00d4c820',
      'editorBracketMatch.border': '#00d4c860',
      'editor.wordHighlightBackground': '#00d4c815',
      'editorWidget.background': '#0a0c18',
      'editorWidget.border': '#2b3050',
      'editorSuggestWidget.background': '#0a0c18',
      'editorSuggestWidget.border': '#2b3050',
      'editorSuggestWidget.selectedBackground': '#161a28',
      'input.background': '#10141f',
      'input.border': '#2b3050',
      'input.foreground': '#d2d6ee',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#3e4570',
      'scrollbarSlider.hoverBackground': '#555c8a',
      'scrollbarSlider.activeBackground': '#747ca4',
    },
  },
};

const VERDANT: WasmTexTheme = {
  id: 'verdant',
  name: 'Verdant',
  isDark: true,
  builtin: true,
  description: 'Deep forest greens with gold leaf. Lush, contemplative, focused.',
  colors: {
    '--color-ink-950': '#020704',
    '--color-ink-900': '#050d07',
    '--color-ink-850': '#09120b',
    '--color-ink-800': '#0e1a10',
    '--color-ink-750': '#132016',
    '--color-ink-700': '#1a2c1d',
    '--color-ink-600': '#26402c',
    '--color-ink-500': '#365840',
    '--color-ink-400': '#4e7258',
    '--color-ink-300': '#6a9474',
    '--color-ink-200': '#90b898',
    '--color-ink-100': '#c4dcc8',
    '--color-amber-glow': '#d4b44a',
    '--color-amber-bright': '#eecf6e',
    '--color-amber-dim': '#a68834',
    '--color-amber-muted': '#7a6226',
    '--color-parchment': '#f4f0e6',
    '--color-parchment-dim': '#dfd6c2',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '4e7258', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'd4b44a' },
      { token: 'keyword.control', foreground: 'eecf6e' },
      { token: 'string', foreground: '6ade80' },
      { token: 'string.raw', foreground: '90d898' },
      { token: 'number', foreground: 'eecf6e' },
      { token: 'type', foreground: 'c4d5fd' },
      { token: 'type.identifier', foreground: 'c4d5fd' },
      { token: 'function', foreground: '7dd3fc' },
      { token: 'namespace', foreground: '60e0c0' },
      { token: 'operator', foreground: 'c4dcc8' },
      { token: 'escape', foreground: 'c4d5fd' },
      { token: 'markup.heading', foreground: 'd4b44a', fontStyle: 'bold' },
      { token: 'markup.list', foreground: '6a9474' },
      { token: 'markup.emphasis', foreground: 'f9a8d4' },
      { token: 'delimiter', foreground: '6a9474' },
      { token: 'tag', foreground: 'd4b44a' },
      { token: 'attribute.name', foreground: 'eecf6e' },
      { token: 'attribute.value', foreground: '6ade80' },
    ],
    colors: {
      'editor.background': '#050d07',
      'editor.foreground': '#c4dcc8',
      'editor.lineHighlightBackground': '#0e1a10',
      'editor.selectionBackground': '#d4b44a30',
      'editor.inactiveSelectionBackground': '#d4b44a15',
      'editorCursor.foreground': '#d4b44a',
      'editorLineNumber.foreground': '#365840',
      'editorLineNumber.activeForeground': '#d4b44a',
      'editorIndentGuide.background1': '#132016',
      'editorIndentGuide.activeBackground1': '#26402c',
      'editorBracketMatch.background': '#d4b44a20',
      'editorBracketMatch.border': '#d4b44a60',
      'editor.wordHighlightBackground': '#d4b44a15',
      'editorWidget.background': '#09120b',
      'editorWidget.border': '#26402c',
      'editorSuggestWidget.background': '#09120b',
      'editorSuggestWidget.border': '#26402c',
      'editorSuggestWidget.selectedBackground': '#132016',
      'input.background': '#0e1a10',
      'input.border': '#26402c',
      'input.foreground': '#c4dcc8',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#365840',
      'scrollbarSlider.hoverBackground': '#4e7258',
      'scrollbarSlider.activeBackground': '#6a9474',
    },
  },
};

const CRIMSON: WasmTexTheme = {
  id: 'crimson',
  name: 'Crimson',
  isDark: true,
  builtin: true,
  description: 'Deep burgundy with rose gold. Rich, dramatic, literary.',
  colors: {
    '--color-ink-950': '#090405',
    '--color-ink-900': '#0e0507',
    '--color-ink-850': '#14090b',
    '--color-ink-800': '#1c0e11',
    '--color-ink-750': '#241217',
    '--color-ink-700': '#30181e',
    '--color-ink-600': '#48242e',
    '--color-ink-500': '#663040',
    '--color-ink-400': '#854454',
    '--color-ink-300': '#a05e6d',
    '--color-ink-200': '#c08898',
    '--color-ink-100': '#e0c0c8',
    '--color-amber-glow': '#e8a87c',
    '--color-amber-bright': '#f2c2a0',
    '--color-amber-dim': '#c07e58',
    '--color-amber-muted': '#8a5840',
    '--color-parchment': '#f5ebe6',
    '--color-parchment-dim': '#e4d4cc',
  },
  monacoTheme: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '663040', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'e8a87c' },
      { token: 'keyword.control', foreground: 'f2c2a0' },
      { token: 'string', foreground: '6ade80' },
      { token: 'string.raw', foreground: '86efac' },
      { token: 'number', foreground: 'f2c2a0' },
      { token: 'type', foreground: 'c4b5fd' },
      { token: 'type.identifier', foreground: 'c4b5fd' },
      { token: 'function', foreground: '7dd3fc' },
      { token: 'namespace', foreground: '60e0c0' },
      { token: 'operator', foreground: 'e0c0c8' },
      { token: 'escape', foreground: 'c4b5fd' },
      { token: 'markup.heading', foreground: 'e8a87c', fontStyle: 'bold' },
      { token: 'markup.list', foreground: 'a05e6d' },
      { token: 'markup.emphasis', foreground: 'f9a8d4' },
      { token: 'delimiter', foreground: 'a05e6d' },
      { token: 'tag', foreground: 'e8a87c' },
      { token: 'attribute.name', foreground: 'f2c2a0' },
      { token: 'attribute.value', foreground: '6ade80' },
    ],
    colors: {
      'editor.background': '#0e0507',
      'editor.foreground': '#e0c0c8',
      'editor.lineHighlightBackground': '#1c0e11',
      'editor.selectionBackground': '#e8a87c30',
      'editor.inactiveSelectionBackground': '#e8a87c15',
      'editorCursor.foreground': '#e8a87c',
      'editorLineNumber.foreground': '#663040',
      'editorLineNumber.activeForeground': '#e8a87c',
      'editorIndentGuide.background1': '#241217',
      'editorIndentGuide.activeBackground1': '#48242e',
      'editorBracketMatch.background': '#e8a87c20',
      'editorBracketMatch.border': '#e8a87c60',
      'editor.wordHighlightBackground': '#e8a87c15',
      'editorWidget.background': '#14090b',
      'editorWidget.border': '#48242e',
      'editorSuggestWidget.background': '#14090b',
      'editorSuggestWidget.border': '#48242e',
      'editorSuggestWidget.selectedBackground': '#241217',
      'input.background': '#1c0e11',
      'input.border': '#48242e',
      'input.foreground': '#e0c0c8',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#663040',
      'scrollbarSlider.hoverBackground': '#854454',
      'scrollbarSlider.activeBackground': '#a05e6d',
    },
  },
};

export const BUILTIN_THEMES: WasmTexTheme[] = [
  INK_AMBER,
  IVORY,
  OBSIDIAN,
  VERDANT,
  CRIMSON,
];

export const DEFAULT_THEME_ID = 'ink-amber';

// ── Color utility functions (for ThemeBuilder) ────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    default:  h = ((rn - gn) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t: number) => {
    const tn = ((t % 1) + 1) % 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hn + 1 / 3) * 255),
    Math.round(hue2rgb(hn) * 255),
    Math.round(hue2rgb(hn - 1 / 3) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
    .join('');
}

export function hexToHsl(hex: string): [number, number, number] {
  return rgbToHsl(...hexToRgb(hex));
}

export function hslToHex(h: number, s: number, l: number): string {
  return rgbToHex(...hslToRgb(h, s, l));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Generates the full set of theme color variables by interpolating a 12-step
 * lightness scale between `bgColor` (darkest) and `textColor` (lightest) and
 * deriving a 4-step accent scale from `accentColor`.
 */
export function generateThemeColors(
  bgColor: string,
  textColor: string,
  accentColor: string,
): Record<ThemeColorKey, string> {
  const [bgH, bgS, bgL] = hexToHsl(bgColor);
  const [textH, textS, textL] = hexToHsl(textColor);
  const [accentH, accentS, accentL] = hexToHsl(accentColor);

  const steps = [950, 900, 850, 800, 750, 700, 600, 500, 400, 300, 200, 100] as const;
  const inkColors: Partial<Record<ThemeColorKey, string>> = {};

  steps.forEach((step, i) => {
    const t = i / (steps.length - 1);
    const h = lerp(bgH, textH, t);
    const s = lerp(bgS, textS, t);
    const l = lerp(bgL, textL, t);
    inkColors[`--color-ink-${step}` as ThemeColorKey] = hslToHex(h, s, l);
  });

  const brightL = Math.min(accentL + 12, 90);
  const dimL    = Math.max(accentL - 15, 10);
  const mutedL  = Math.max(accentL - 30, 5);

  return {
    ...inkColors,
    '--color-amber-glow':    accentColor,
    '--color-amber-bright':  hslToHex(accentH, accentS, brightL),
    '--color-amber-dim':     hslToHex(accentH, accentS, dimL),
    '--color-amber-muted':   hslToHex(accentH, accentS, mutedL),
    '--color-parchment':     '#f5f0e8',
    '--color-parchment-dim': '#e0d8cc',
  } as Record<ThemeColorKey, string>;
}

/** Builds a full WasmTexTheme (including Monaco theme) from three picker colors. */
export function buildThemeFromColors(
  id: string,
  name: string,
  bgColor: string,
  textColor: string,
  accentColor: string,
  isDark: boolean,
): WasmTexTheme {
  const colors = generateThemeColors(bgColor, textColor, accentColor);
  const strip = (h: string) => h.replace('#', '');

  const monacoTheme: MonacoThemeDefinition = {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment',          foreground: strip(colors['--color-ink-500']), fontStyle: 'italic' },
      { token: 'keyword',          foreground: strip(accentColor) },
      { token: 'keyword.control',  foreground: strip(colors['--color-amber-bright']) },
      { token: 'string',           foreground: '4ade80' },
      { token: 'string.raw',       foreground: '86efac' },
      { token: 'number',           foreground: strip(colors['--color-amber-bright']) },
      { token: 'type',             foreground: 'c4b5fd' },
      { token: 'type.identifier',  foreground: 'c4b5fd' },
      { token: 'function',         foreground: '7dd3fc' },
      { token: 'namespace',        foreground: '67e8f9' },
      { token: 'operator',         foreground: strip(colors['--color-ink-100']) },
      { token: 'escape',           foreground: 'c4b5fd' },
      { token: 'markup.heading',   foreground: strip(accentColor), fontStyle: 'bold' },
      { token: 'markup.list',      foreground: strip(colors['--color-ink-400']) },
      { token: 'markup.emphasis',  foreground: 'f9a8d4' },
      { token: 'delimiter',        foreground: strip(colors['--color-ink-400']) },
      { token: 'tag',              foreground: strip(accentColor) },
      { token: 'attribute.name',   foreground: strip(colors['--color-amber-bright']) },
      { token: 'attribute.value',  foreground: '4ade80' },
    ],
    colors: {
      'editor.background':                     colors['--color-ink-900'],
      'editor.foreground':                     colors['--color-ink-100'],
      'editor.lineHighlightBackground':        colors['--color-ink-800'],
      'editor.selectionBackground':            strip(accentColor) + '30',
      'editor.inactiveSelectionBackground':    strip(accentColor) + '15',
      'editorCursor.foreground':               accentColor,
      'editorLineNumber.foreground':           colors['--color-ink-500'],
      'editorLineNumber.activeForeground':     accentColor,
      'editorIndentGuide.background1':         colors['--color-ink-750'],
      'editorIndentGuide.activeBackground1':   colors['--color-ink-600'],
      'editorBracketMatch.background':         strip(accentColor) + '20',
      'editorBracketMatch.border':             strip(accentColor) + '60',
      'editor.wordHighlightBackground':        strip(accentColor) + '15',
      'editorWidget.background':               colors['--color-ink-850'],
      'editorWidget.border':                   colors['--color-ink-600'],
      'editorSuggestWidget.background':        colors['--color-ink-850'],
      'editorSuggestWidget.border':            colors['--color-ink-600'],
      'editorSuggestWidget.selectedBackground':colors['--color-ink-750'],
      'input.background':                      colors['--color-ink-800'],
      'input.border':                          colors['--color-ink-600'],
      'input.foreground':                      colors['--color-ink-100'],
      'scrollbar.shadow':                      '#00000000',
      'scrollbarSlider.background':            colors['--color-ink-600'],
      'scrollbarSlider.hoverBackground':       colors['--color-ink-500'],
      'scrollbarSlider.activeBackground':      colors['--color-ink-400'],
    },
  };

  return { id, name, isDark, builtin: false, colors, monacoTheme };
}

/**
 * Merges a user-imported JSON blob into a full WasmTexTheme, filling any
 * missing color keys from the Ink & Amber defaults.
 */
export function themeFromImport(raw: ThemeImportData): WasmTexTheme {
  const id   = raw.id ?? `custom-${Date.now()}`;
  const base = BUILTIN_THEMES[0]; // fallback defaults from Ink & Amber

  const colors: Record<ThemeColorKey, string> = { ...base.colors };
  for (const key of THEME_COLOR_KEYS) {
    if (typeof raw.colors[key] === 'string') {
      colors[key] = raw.colors[key] as string;
    }
  }

  const monacoBase: MonacoThemeDefinition = {
    base: (raw.isDark ?? true) ? 'vs-dark' : 'vs',
    inherit: true,
    rules: raw.monacoTheme?.rules ?? base.monacoTheme.rules,
    colors: raw.monacoTheme?.colors ?? base.monacoTheme.colors,
  };

  return {
    id,
    name: raw.name,
    author: raw.author,
    isDark: raw.isDark ?? true,
    builtin: false,
    colors,
    monacoTheme: monacoBase,
  };
}
