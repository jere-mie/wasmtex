import { useRef, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useFiles } from "@/context/FileContext";

// Store Monaco models per file to preserve undo history
const modelCache = new Map<string, editor.ITextModel>();

export function MonacoEditor() {
  const { activeFile, getFileContent, updateFileContent } = useFiles();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

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
              [/[\[\]]/, "delimiter.square"],
              [/\$\$?/, "delimiter.math"],
              [/[&]/, "delimiter"],
              [/[0-9]+/, "number"],
            ],
          },
        });
      }

      // Set model for active file
      if (activeFile) {
        setModelForFile(editor, monaco, activeFile, getFileContent(activeFile) ?? "");
      }
    },
    [activeFile, getFileContent]
  );

  const setModelForFile = (
    editor: editor.IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor"),
    fileName: string,
    content: string
  ) => {
    let model = modelCache.get(fileName);
    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`file:///${fileName}`);
      model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, "latex", uri);
      modelCache.set(fileName, model);
    }
    editor.setModel(model);
  };

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        updateFileContent(activeFile, value);
      }
    },
    [activeFile, updateFileContent]
  );

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

  return (
    <Editor
      key={activeFile}
      defaultValue={getFileContent(activeFile) ?? ""}
      defaultLanguage="latex"
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
