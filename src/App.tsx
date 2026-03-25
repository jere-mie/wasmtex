import { useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Toolbar } from "@/components/Toolbar";
import { FileExplorer } from "@/components/FileExplorer";
import { EditorTabs } from "@/components/EditorTabs";
import { MonacoEditor } from "@/components/MonacoEditor";
import { PdfPreview } from "@/components/PdfPreview";
import { CompileConsole } from "@/components/CompileConsole";
import type { CompileResponse } from "@/workers/tex.worker";

function App() {
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const handleCompileResult = useCallback((result: CompileResponse) => {
    setCompileResult(result);
    if (result.success) {
      toast.success("Compilation successful", {
        description: "Document built without errors.",
      });
    } else {
      toast.error("Compilation failed", {
        description: `${result.errors.length} error(s) found.`,
      });
    }
  }, []);

  return (
    <div className="h-full flex flex-col noise-bg">
      <Toolbar
        onCompileResult={handleCompileResult}
        isCompiling={isCompiling}
        setIsCompiling={setIsCompiling}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* File Explorer */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
          <FileExplorer />
        </ResizablePanel>

        <ResizableHandle />

        {/* Editor */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex flex-col h-full">
            <EditorTabs />
            <div className="flex-1 min-h-0">
              <MonacoEditor />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Preview + Console */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={70} minSize={20}>
              <PdfPreview compileResult={compileResult} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <CompileConsole compileResult={compileResult} isCompiling={isCompiling} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#17141c",
            border: "1px solid #342e40",
            color: "#ddd9e8",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          },
        }}
      />
    </div>
  );
}

export default App;
