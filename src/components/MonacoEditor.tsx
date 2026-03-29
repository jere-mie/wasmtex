import { useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import { useFiles } from "@/context/FileContext";
import {
  getFileExtension,
  getVFSFileSize,
  isImageFile,
  isTextFile,
} from "@/lib/project-files";

// Store Monaco models per file to preserve undo history
const modelCache = new Map<string, editor.ITextModel>();

// Guard: only register the \begin completion provider once across remounts
let envCompletionRegistered = false;

interface MonacoEditorProps {
  onCompile?: () => void;
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
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onCompileRef = useRef(onCompile);
  useEffect(() => { onCompileRef.current = onCompile; }, [onCompile]);

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

      // Override Ctrl/Cmd+Enter to compile instead of inserting a new line
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onCompileRef.current?.();
      });


      // Define custom LaTeX-inspired theme
      monaco.editor.defineTheme("wasmtex-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6b6080", fontStyle: "italic" },
          { token: "keyword", foreground: "d4a574" },
          { token: "string", foreground: "4ade80" },
          { token: "number", foreground: "e8c49a" },
          { token: "type", foreground: "c4b5fd" },
          { token: "delimiter", foreground: "8e85a3" },
          { token: "tag", foreground: "d4a574" },
          { token: "attribute.name", foreground: "e8c49a" },
          { token: "attribute.value", foreground: "4ade80" },
        ],
        colors: {
          "editor.background": "#0c0a0f",
          "editor.foreground": "#ddd9e8",
          "editor.lineHighlightBackground": "#17141c",
          "editor.selectionBackground": "#d4a57430",
          "editor.inactiveSelectionBackground": "#d4a57415",
          "editorCursor.foreground": "#d4a574",
          "editorLineNumber.foreground": "#504866",
          "editorLineNumber.activeForeground": "#d4a574",
          "editorIndentGuide.background": "#1c1922",
          "editorIndentGuide.activeBackground": "#342e40",
          "editorBracketMatch.background": "#d4a57420",
          "editorBracketMatch.border": "#d4a57460",
          "editor.wordHighlightBackground": "#d4a57415",
          "editorWidget.background": "#100e14",
          "editorWidget.border": "#342e40",
          "editorSuggestWidget.background": "#100e14",
          "editorSuggestWidget.border": "#342e40",
          "editorSuggestWidget.selectedBackground": "#1c1922",
          "input.background": "#17141c",
          "input.border": "#342e40",
          "input.foreground": "#ddd9e8",
          "scrollbar.shadow": "#00000000",
          "scrollbarSlider.background": "#504866",
          "scrollbarSlider.hoverBackground": "#6b6080",
          "scrollbarSlider.activeBackground": "#8e85a3",
        },
      });

      monaco.editor.setTheme("wasmtex-dark");

      // Register LaTeX language (basic)
      if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === "latex")) {
        monaco.languages.register({ id: "latex" });
        monaco.languages.setMonarchTokensProvider("latex", {
          tokenizer: {
            root: [
              [/%.*$/, "comment"],
              [/\\[a-zA-Z@]+/, "keyword"],
              [/[{}]/, "delimiter.curly"],
              [/[[\]]/, "delimiter.square"],
              [/\$\$?/, "delimiter.math"],
              [/[&]/, "delimiter"],
              [/[0-9]+/, "number"],
            ],
          },
        });
      }
      if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === "typst")) {
        monaco.languages.register({ id: "typst" });
        monaco.languages.setMonarchTokensProvider("typst", {
          tokenizer: {
            root: [
              [/\/\/.+$/, "comment"],
              [/\/\*/, "comment", "@comment"],
              [/#(let|set|show|import|include|if|else|for|while|context)\b/, "keyword"],
              [/@[a-zA-Z0-9_.-]+/, "type"],
              [/"([^"\\]|\\.)*$/, "string.invalid"],
              [/"([^"\\]|\\.)*"/, "string"],
              [/[{}[\]()]/, "delimiter"],
              [/\$+/, "delimiter.math"],
              [/[0-9]+(?:\.[0-9]+)?/, "number"],
            ],
            comment: [
              [/[^/*]+/, "comment"],
              [/\*\//, "comment", "@pop"],
              [/[/*]/, "comment"],
            ],
          },
        });
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
                  label: `\\begin{${envName}} … \\end{${envName}}`,
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
      theme="wasmtex-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13.5,
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
