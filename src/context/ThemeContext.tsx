import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  THEME_COLOR_KEYS,
  type WasmTexTheme,
} from '@/lib/themes';

// ── Storage keys ──────────────────────────────────────────────────────────

const ACTIVE_THEME_KEY  = 'wasmtex:active-theme';
const USER_THEMES_KEY   = 'wasmtex:user-themes';

// ── Context shape ─────────────────────────────────────────────────────────

interface ThemeContextValue {
  /** The currently applied theme */
  activeTheme: WasmTexTheme;
  /** All user-defined / imported themes */
  userThemes: WasmTexTheme[];
  /** Switch to a theme by id */
  setThemeId: (id: string) => void;
  /** Persist a new user-created / imported theme */
  addUserTheme: (theme: WasmTexTheme) => void;
  /** Remove a user theme by id */
  removeUserTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────

function applyThemeCssVars(theme: WasmTexTheme): void {
  const root = document.documentElement;
  for (const key of THEME_COLOR_KEYS) {
    const value = theme.colors[key];
    if (value) root.style.setProperty(key, value);
  }
}

function readUserThemes(): WasmTexTheme[] {
  try {
    const raw = window.localStorage.getItem(USER_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as WasmTexTheme[];
  } catch {
    return [];
  }
}

function persistUserThemes(themes: WasmTexTheme[]): void {
  window.localStorage.setItem(USER_THEMES_KEY, JSON.stringify(themes));
}

function findTheme(id: string, userThemes: WasmTexTheme[]): WasmTexTheme {
  return (
    BUILTIN_THEMES.find(t => t.id === id) ??
    userThemes.find(t => t.id === id) ??
    BUILTIN_THEMES[0]
  );
}

// ── Provider ──────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userThemes, setUserThemes] = useState<WasmTexTheme[]>(() => readUserThemes());

  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    const stored = window.localStorage.getItem(ACTIVE_THEME_KEY);
    const id = stored ?? DEFAULT_THEME_ID;
    // Make sure the id is resolvable; fall back to default otherwise
    const allIds = new Set([
      ...BUILTIN_THEMES.map(t => t.id),
      ...readUserThemes().map(t => t.id),
    ]);
    return allIds.has(id) ? id : DEFAULT_THEME_ID;
  });

  const activeTheme = useMemo(
    () => findTheme(activeThemeId, userThemes),
    [activeThemeId, userThemes],
  );

  // Apply CSS variables whenever the active theme changes
  useEffect(() => {
    applyThemeCssVars(activeTheme);
  }, [activeTheme]);

  const setThemeId = useCallback((id: string) => {
    setActiveThemeId(id);
    window.localStorage.setItem(ACTIVE_THEME_KEY, id);
  }, []);

  const addUserTheme = useCallback((theme: WasmTexTheme) => {
    setUserThemes(prev => {
      // Replace if same id, otherwise append
      const exists = prev.some(t => t.id === theme.id);
      const next = exists
        ? prev.map(t => (t.id === theme.id ? theme : t))
        : [...prev, theme];
      persistUserThemes(next);
      return next;
    });
  }, []);

  const removeUserTheme = useCallback((id: string) => {
    setUserThemes(prev => {
      const next = prev.filter(t => t.id !== id);
      persistUserThemes(next);
      return next;
    });
    // If the deleted theme was active, revert to default
    setActiveThemeId(prev => {
      if (prev === id) {
        window.localStorage.setItem(ACTIVE_THEME_KEY, DEFAULT_THEME_ID);
        return DEFAULT_THEME_ID;
      }
      return prev;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ activeTheme, userThemes, setThemeId, addUserTheme, removeUserTheme }),
    [activeTheme, userThemes, setThemeId, addUserTheme, removeUserTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
