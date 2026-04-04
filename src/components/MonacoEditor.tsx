import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import { useFiles } from "@/context/FileContext";
import { useTheme } from "@/context/ThemeContext";
import { BUILTIN_THEMES, getMonacoThemeId } from "@/lib/themes";
import {
  getFileExtension,
  getVFSFileSize,
  isImageFile,
  isTextFile,
} from "@/lib/project-files";

// Store Monaco models per file to preserve undo history
const modelCache = new Map<string, editor.ITextModel>();

// Guard: only register providers once across remounts
let envCompletionRegistered = false;
let latexRegistered = false;
let typstRegistered = false;

const LATEX_LANGUAGE_CONFIGURATION: monaco.languages.LanguageConfiguration = {
  comments: { lineComment: "%" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "$", close: "$" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "$", close: "$" },
  ],
};

/**
 * Rich LaTeX tokenizer. All token names map to explicit entries in the
 * WasmTeX Monaco theme rules, so custom themes render correctly.
 *
 * Token name → theme rule mapping:
 *   comment           → comment (italic)
 *   keyword.control   → \begin, \end, \newcommand, \def, …
 *   markup.heading    → \section, \chapter, …
 *   markup.list       → \item
 *   markup.emphasis   → \textbf, \textit, \emph, …
 *   function          → \cite, \ref, \label, \eqref, …
 *   namespace         → \usepackage, \documentclass, \input, …
 *   keyword           → all other \commands
 *   escape            → \\ \& \% \$ special char escapes
 *   delimiter         → { } [ ]  (replaces non-themed delimiter.curly/square)
 *   operator          → & ^ _ ~ = + - * / < > | math operators
 *   number            → numeric literals
 *   type              → identifiers inside math mode
 *   attribute.name    → environment names and optional-arg keys
 *   string.raw        → display math content marker ($$ … $$)
 */
const LATEX_TOKENIZER: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".tex",
  tokenizer: {
    root: [
      // Comments
      [/%.*$/, "comment"],
      // Display math $$...$$
      [/\$\$/, "string.raw", "@mathDisplay"],
      // Inline math $...$
      [/\$/, "operator", "@mathInline"],
      // \begin{env} / \end{env}
      [/(\\(?:begin|end)\*?)(\s*)(\{)([^}]*)(\})/, [
        "keyword.control", "", "delimiter", "attribute.name", "delimiter",
      ]],
      // \begin / \end without braces yet (fallback)
      [/\\(?:begin|end)\*?\b/, "keyword.control"],
      // Definition / new-command control
      [/\\(?:newcommand|renewcommand|newenvironment|renewenvironment|providecommand|def|let|gdef|edef|xdef|newcounter|setcounter|addtocounter|stepcounter)\*?\b/, "keyword.control"],
      // Structural / heading commands
      [/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\b/, "markup.heading"],
      // List item
      [/\\item\b/, "markup.list"],
      // Emphasis / formatting commands
      [/\\(?:textbf|textit|emph|textsc|texttt|textrm|textup|textsl|underline|footnote|footnotemark|footnotetext|text)\*?\b/, "markup.emphasis"],
      // Cross-reference commands
      [/\\(?:cite[a-zA-Z]*|(?:eq|auto|page|v)?ref|label)\*?\b/, "function"],
      // Include / package commands
      [/\\(?:usepackage|RequirePackage|documentclass|input|include|includegraphics|bibliography|bibliographystyle|addbibresource)\*?\b/, "namespace"],
      // Special character escapes:  \\ \& \% \$ \# \_ \{ \} \~ \^
      [/\\[\\&%$#_{}~^]/, "escape"],
      // All other backslash commands
      [/\\[a-zA-Z@]+\*?/, "keyword"],
      // Braces and brackets
      [/[{}[\]]/, "delimiter"],
      // Math operators inline (alignment, super/subscript, etc.)
      [/[&^_~]/, "operator"],
      // Numbers
      [/[0-9]+(?:\.[0-9]+)?/, "number"],
    ],
    mathDisplay: [
      [/\$\$/, "string.raw", "@pop"],
      [/\\[a-zA-Z@]+\*?/, "keyword"],
      [/\\[\\&%$#_{}~^]/, "escape"],
      [/[{}[\]()]/, "delimiter"],
      [/[\^_]/, "operator"],
      [/[+\-*/=<>!,;|]/, "operator"],
      [/[0-9]+(?:\.[0-9]+)?/, "number"],
      [/[a-zA-Z]+/, "type"],
    ],
    mathInline: [
      [/\$/, "operator", "@pop"],
      [/\\[a-zA-Z@]+\*?/, "keyword"],
      [/\\[\\&%$#_{}~^]/, "escape"],
      [/[{}[\]()]/, "delimiter"],
      [/[\^_]/, "operator"],
      [/[+\-*/=<>!,;|]/, "operator"],
      [/[0-9]+(?:\.[0-9]+)?/, "number"],
      [/[a-zA-Z]+/, "type"],
    ],
  },
};

const TYPST_LANGUAGE_CONFIGURATION: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "`", close: "`" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "`", close: "`" },
  ],
};

const TYPST_TOKENIZER: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".typst",
  keywords: [
    "as",
    "break",
    "context",
    "continue",
    "else",
    "for",
    "if",
    "import",
    "in",
    "include",
    "let",
    "return",
    "set",
    "show",
    "while",
  ],
  builtins: ["auto", "false", "none", "true"],
  tokenizer: {
    root: [
      [/^\s*=+.*$/, "markup.heading"],
      [/(^\s*)([-+])(\s)/, ["white", "markup.list", "white"]],
      [/(^\s*)(\d+\.)(\s)/, ["white", "markup.list", "white"]],
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/```/, "string.raw", "@rawBlock"],
      [/`/, "string.raw", "@rawInline"],
      [/<[A-Za-z0-9:_-]+>/, "type.identifier"],
      [/@[A-Za-z0-9:_-]+/, "namespace"],
      [/\$(?=\S)/, "delimiter.math", "@math"],
      [/#(as|break|context|continue|else|for|if|import|in|include|let|return|set|show|while)\b/, "keyword.control"],
      [/#[A-Za-z_][\w-]*/, "function"],
      [/"/, "string.quote", "@string"],
      [/\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?(?:pt|mm|cm|in|em|fr|deg|rad|%)?)\b/, "number"],
      [/\b[A-Za-z_][\w-]*(?=\s*:)/, "attribute.name"],
      [/\b[A-Za-z_][\w-]*(?=\s*\()/, "function"],
      [/\b[A-Za-z_][\w-]*\b/, {
        cases: {
          "@keywords": "keyword",
          "@builtins": "keyword",
          "@default": "identifier",
        },
      }],
      [/[{}[\]()]/, "@brackets"],
      [/[,:;]/, "delimiter"],
      [/[+\-*/=<>!^&|]+/, "operator"],
      [/[*_](?=\S)/, "markup.emphasis"],
      [/#/, "delimiter"],
    ],
    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "escape"],
      [/"/, "string.quote", "@pop"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\/\*/, "comment", "@push"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
    rawBlock: [
      [/```/, "string.raw", "@pop"],
      [/[^`]+/, "string.raw"],
      [/`/, "string.raw"],
    ],
    rawInline: [
      [/`/, "string.raw", "@pop"],
      [/[^`]+/, "string.raw"],
    ],
    math: [
      [/\$/, "delimiter.math", "@pop"],
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/"/, "string.quote", "@string"],
      [/\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/, "number"],
      [/\b[A-Za-z_][\w-]*(?=\s*\()/, "function"],
      [/\b[A-Za-z_][\w-]*\b/, {
        cases: {
          "@builtins": "keyword",
          "@default": "identifier",
        },
      }],
      [/[{}[\]()]/, "@brackets"],
      [/[,:;]/, "delimiter"],
      [/[+\-*/=<>!^_&|]+/, "operator"],
    ],
  },
};

interface MonacoEditorProps {
  onCompile?: () => void;
}

function refreshEditorFontMetrics(activeEditor: editor.IStandaloneCodeEditor) {
  monaco.editor.remeasureFonts();
  activeEditor.render();
  activeEditor.layout();
}

function scheduleEditorFontRefresh(activeEditor: editor.IStandaloneCodeEditor) {
  refreshEditorFontMetrics(activeEditor);

  const animationFrameId = window.requestAnimationFrame(() => {
    refreshEditorFontMetrics(activeEditor);
  });

  let disposed = false;

  void document.fonts.ready.then(() => {
    if (!disposed) {
      refreshEditorFontMetrics(activeEditor);
    }
  });

  return () => {
    disposed = true;
    window.cancelAnimationFrame(animationFrameId);
  };
}

function getEditorLanguage(fileName: string) {
  switch (getFileExtension(fileName)) {
    case "tex":
    case "bib":
    case "bst":
    case "cls":
    case "sty":
      return "latex";
    case "typ":
      return "typst";
    case "css":
      return "css";
    case "html":
      return "html";
    case "js":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "ts":
    case "tsx":
      return "typescript";
    default:
      return "plaintext";
  }
}

export function MonacoEditor({ onCompile }: MonacoEditorProps) {
  const { activeFile, getFile, getFileContent, updateFileContent } = useFiles();
  const { activeTheme, userThemes } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const fontRefreshCleanupRef = useRef<(() => void) | null>(null);
  const onCompileRef = useRef(onCompile);
  useEffect(() => { onCompileRef.current = onCompile; }, [onCompile]);
  useEffect(() => () => { fontRefreshCleanupRef.current?.(); }, []);

  // Register all themes and apply the active one whenever it changes
  useEffect(() => {
    const allThemes = [...BUILTIN_THEMES, ...userThemes];
    for (const theme of allThemes) {
      monaco.editor.defineTheme(getMonacoThemeId(theme.id), theme.monacoTheme);
    }
    monaco.editor.setTheme(getMonacoThemeId(activeTheme.id));
  }, [activeTheme, userThemes]);

  const activeEntry = activeFile ? getFile(activeFile) : undefined;
  const isEditableTextFile = activeEntry ? isTextFile(activeEntry) : false;

  function setModelForFile(
    editor: editor.IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor"),
    fileName: string,
    content: string
  ) {
    const language = getEditorLanguage(fileName);
    let model = modelCache.get(fileName);
    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`file:///${fileName}`);
      model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, language, uri);
      modelCache.set(fileName, model);
    }
    monaco.editor.setModelLanguage(model, language);
    editor.setModel(model);
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    fontRefreshCleanupRef.current?.();
    fontRefreshCleanupRef.current = scheduleEditorFontRefresh(editor);

      // Override Ctrl/Cmd+Enter to compile instead of inserting a new line
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onCompileRef.current?.();
      });


      // Register all built-in + user themes and apply the active one
      const allThemes = [...BUILTIN_THEMES, ...userThemes];
      for (const theme of allThemes) {
        monaco.editor.defineTheme(getMonacoThemeId(theme.id), theme.monacoTheme);
      }
      monaco.editor.setTheme(getMonacoThemeId(activeTheme.id));

      // Register LaTeX language
      if (!latexRegistered && !monaco.languages.getLanguages().some((l: { id: string }) => l.id === "latex")) {
        latexRegistered = true;
        monaco.languages.register({ id: "latex" });
        monaco.languages.setLanguageConfiguration("latex", LATEX_LANGUAGE_CONFIGURATION);
        monaco.languages.setMonarchTokensProvider("latex", LATEX_TOKENIZER);
      }
      if (!typstRegistered && !monaco.languages.getLanguages().some((l: { id: string }) => l.id === "typst")) {
        typstRegistered = true;
        monaco.languages.register({ id: "typst" });
        monaco.languages.setLanguageConfiguration("typst", TYPST_LANGUAGE_CONFIGURATION);
        monaco.languages.setMonarchTokensProvider("typst", TYPST_TOKENIZER);
      }
      // Register \begin{env} -> snippet completion (fires on '}' trigger)
      if (!envCompletionRegistered) {
        envCompletionRegistered = true;
        monaco.languages.registerCompletionItemProvider("latex", {
          triggerCharacters: ["}"],
          provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);
            const match = textBefore.match(/\\begin\{([^}]+)\}$/);
            if (!match) return { suggestions: [] };

            const envName = match[1];
            const indent = lineContent.match(/^(\s*)/)?.[1] ?? "";
            const contentIndent = indent + "  ";

            // Replace the entire \begin{envName} text the user already typed
            const startCol = textBefore.lastIndexOf("\\begin{") + 1; // 1-based

            return {
              suggestions: [
                {
                  label: `\\begin{${envName}} ... \\end{${envName}}`,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  insertText: `\\begin{${envName}}\n${contentIndent}$0\n${indent}\\end{${envName}}`,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  range: new monaco.Range(
                    position.lineNumber,
                    startCol,
                    position.lineNumber,
                    position.column
                  ),
                  detail: "LaTeX environment",
                  sortText: "0",
                },
              ],
            };
          },
        });
      }
      // Set model for active file
    if (activeFile && isEditableTextFile) {
      setModelForFile(editor, monaco, activeFile, getFileContent(activeFile) ?? "");
    }
  };

  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined && isEditableTextFile) {
      updateFileContent(activeFile, value);
    }
  };

  useEffect(() => {
    if (!editorRef.current || !isEditableTextFile) {
      return;
    }

    refreshEditorFontMetrics(editorRef.current);
  }, [activeFile, isEditableTextFile]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ink-900">
        <div className="text-center space-y-3">
          <div className="font-display text-4xl text-ink-600 select-none">WasmTeX</div>
          <p className="text-ink-500 text-sm">Open a file to start editing</p>
        </div>
      </div>
    );
  }

  if (!activeEntry) {
    return null;
  }

  const editorLanguage = getEditorLanguage(activeEntry.name);

  if (!isEditableTextFile) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-900">
        <div className="max-w-md space-y-3 px-6 text-center">
          <div className="font-display text-3xl text-ink-500 select-none">{activeEntry.name.split("/").pop()}</div>
          <p className="text-sm text-ink-400">
            {isImageFile(activeEntry)
              ? "This image asset is stored in the project and available to the compiler and downloads, but it is not editable in the text editor."
              : "This file is stored as binary data and is available to the compiler and downloads, but it cannot be edited in the text editor."}
          </p>
          <p className="text-xs font-mono text-ink-500">
            {activeEntry.mimeType ?? "application/octet-stream"} • {getVFSFileSize(activeEntry).toLocaleString()} bytes
          </p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      key={activeFile}
      defaultValue={getFileContent(activeFile) ?? ""}
      defaultLanguage={editorLanguage}
      theme={getMonacoThemeId(activeTheme.id)}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13.5,
        fontLigatures: false,
        lineHeight: 22,
        padding: { top: 12, bottom: 12 },
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        wordWrap: "on",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes: 0,
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
        },
        suggest: {
          showWords: false,
        },
      }}
    />
  );
}
