import { BusyTexRunner } from "texlyre-busytex";
import { loadFonts } from "@myriaddreamin/typst.ts";
import {
  CompileFormatEnum,
  createTypstCompiler,
  type TypstCompiler,
} from "@myriaddreamin/typst.ts/compiler";
import { withPackageRegistry, withAccessModel } from "@myriaddreamin/typst.ts/options.init";
import { MemoryAccessModel } from "@myriaddreamin/typst.ts/fs/memory";
import { FetchPackageRegistry } from "@myriaddreamin/typst.ts/fs/package";
import typstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import type { VFSFile } from "@/lib/project-files";

export type CompileEngine = "latex" | "typst" | "markdown";

export interface CompileRequest {
  type: "compile";
  engine: CompileEngine;
  files: Pick<VFSFile, "name" | "content">[];
  mainFile: string;
}

export interface CompileStatusMessage {
  type: "compile-status";
  phase: "initializing" | "compiling";
}

export interface CompileResponse {
  type: "compile-result";
  engine: CompileEngine;
  mainFile: string;
  success: boolean;
  pdf?: Uint8Array;
  log: string;
  errors: string[];
  exitCode?: number;
}

interface WorkerCompileResult {
  success: boolean;
  pdf?: Uint8Array;
  log: string;
  errors: string[];
  exitCode?: number;
}

function resolvePublicAssetPath(relativePath: string) {
  return new URL(
    relativePath.replace(/^\/+/, ""),
    new URL(import.meta.env.BASE_URL, self.location.origin)
  ).toString();
}

const BUSYTEX_BASE_PATH = resolvePublicAssetPath("core/busytex");
const TYPST_FONT_ASSET_PATH = resolvePublicAssetPath("core/typst-fonts");
const TEXLIVE_EXTRA_PACKAGE_PATH = resolvePublicAssetPath("core/busytex/texlive-extra.js");

const runner = new BusyTexRunner({
  busytexBasePath: BUSYTEX_BASE_PATH,
  verbose: false,
});

const typstCompiler: TypstCompiler = createTypstCompiler();
const typstPackageAccessModel = new MemoryAccessModel();
const typstPackageRegistry = new FetchPackageRegistry(typstPackageAccessModel);

const DRIVER_ORDER = [
  "xetex_bibtex8_dvipdfmx",
  "luahbtex_bibtex8",
  "pdftex_bibtex8",
] as const;

let runnerReady: Promise<void> | null = null;
let typstReady: Promise<void> | null = null;

function ensureLatexRunnerReady() {
  if (!runnerReady) {
    runnerReady = runner.initialize(true).catch((error) => {
      runnerReady = null;
      throw error;
    });
  }

  return runnerReady;
}

function ensureTypstCompilerReady() {
  if (!typstReady) {
    typstReady = typstCompiler
      .init({
        beforeBuild: [
          withAccessModel(typstPackageAccessModel),
          withPackageRegistry(typstPackageRegistry),
          loadFonts([
            // Preload Bravura explicitly so it's available to Typst
            `${TYPST_FONT_ASSET_PATH}/Bravura.otf`,
          ], {
            assets: ["text"],
            assetUrlPrefix: TYPST_FONT_ASSET_PATH,
          }),
        ],
        getModule: () => typstCompilerWasmUrl,
      })
      .catch((error) => {
        typstReady = null;
        throw error;
      });
  }

  return typstReady;
}

function extractLatexErrors(log: string, exitCode?: number) {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const matches = Array.from(
    new Set(
      lines.filter((line) => {
        const lower = line.toLowerCase();
        return (
          line.startsWith("!") ||
          lower.includes("fatal error") ||
          lower.includes("undefined control sequence") ||
          lower.includes("no output pdf file produced") ||
          lower.includes("emergency stop")
        );
      })
    )
  );

  if (matches.length > 0) {
    return matches;
  }

  if (exitCode !== undefined) {
    return [`Compilation failed with exit code ${exitCode}.`];
  }

  return ["Compilation failed."];
}

function extractTypstErrors(diagnostics: string[]) {
  const matches = Array.from(
    new Set(
      diagnostics.filter((line) => {
        const lower = line.toLowerCase();
        return lower.includes("error") || lower.includes("panic") || lower.includes("failed");
      })
    )
  );

  if (matches.length > 0) {
    return matches;
  }

  if (diagnostics.length > 0) {
    return diagnostics;
  }

  return ["Compilation failed."];
}

function toTypstPath(name: string) {
  return name.startsWith("/") ? name : `/${name}`;
}

async function compileWithFallback(
  files: Pick<VFSFile, "name" | "content">[],
  mainFile: string
): Promise<WorkerCompileResult> {
  let lastResult: Awaited<ReturnType<typeof runner.compile>> | null = null;

  for (const driver of DRIVER_ORDER) {
    const result = await runner.compile(
      files.map((file) => ({
        path: file.name,
        content: file.content,
      })),
      mainFile,
      files.some((file) => file.name.endsWith(".bib")) || null,
      "info",
      driver,
      [TEXLIVE_EXTRA_PACKAGE_PATH]
    );

    if (result.success) {
      if (driver === DRIVER_ORDER[0]) {
        return {
          success: result.success,
          pdf: result.pdf ? new Uint8Array(result.pdf) : undefined,
          log: result.log,
          errors: [],
          exitCode: result.exitCode,
        };
      }

      return {
        success: result.success,
        pdf: result.pdf ? new Uint8Array(result.pdf) : undefined,
        log: [`Engine selected: ${driver}`, "", result.log].join("\n"),
        errors: [],
        exitCode: result.exitCode,
      };
    }

    lastResult = result;
  }

  return {
    success: lastResult?.success ?? false,
    pdf: lastResult?.pdf ? new Uint8Array(lastResult.pdf) : undefined,
    log: lastResult?.log ?? "Compilation failed.",
    errors: lastResult ? extractLatexErrors(lastResult.log, lastResult.exitCode) : ["Compilation failed."],
    exitCode: lastResult?.exitCode,
  };
}

async function compileTypst(
  files: Pick<VFSFile, "name" | "content">[],
  mainFile: string
): Promise<WorkerCompileResult> {
  typstCompiler.resetShadow();

  for (const file of files) {
    const path = toTypstPath(file.name);

    if (typeof file.content === "string") {
      typstCompiler.addSource(path, file.content);
      continue;
    }

    typstCompiler.mapShadow(path, file.content);
  }

  const result = await typstCompiler.compile({
    mainFilePath: toTypstPath(mainFile),
    format: CompileFormatEnum.pdf,
    diagnostics: "unix",
  });

  const diagnostics = result.diagnostics ?? [];
  const pdf = result.result ? new Uint8Array(result.result) : undefined;
  const log = [
    pdf ? `Typst PDF compiled: ${mainFile}` : `Typst compilation failed: ${mainFile}`,
    ...(diagnostics.length > 0 ? ["", ...diagnostics] : []),
  ].join("\n");

  return {
    success: Boolean(pdf),
    pdf,
    log,
    errors: pdf ? [] : extractTypstErrors(diagnostics),
  };
}

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { type, engine, files, mainFile } = event.data;

  if (type !== "compile") return;

  try {
    const main = files.find((f) => f.name === mainFile);
    if (!main) {
      const response: CompileResponse = {
        type: "compile-result",
        engine,
        mainFile,
        success: false,
        log: `Error: Main file "${mainFile}" not found.`,
        errors: [`File not found: ${mainFile}`],
      };
      self.postMessage(response);
      return;
    }

    const statusInit: CompileStatusMessage = { type: "compile-status", phase: "initializing" };
    self.postMessage(statusInit);

    if (engine === "latex") {
      await ensureLatexRunnerReady();
    } else if (engine === "typst") {
      await ensureTypstCompilerReady();
    } else {
      throw new Error("Markdown compilation is handled on the main thread.");
    }

    const statusCompiling: CompileStatusMessage = { type: "compile-status", phase: "compiling" };
    self.postMessage(statusCompiling);

    const result = engine === "latex"
      ? await compileWithFallback(files, mainFile)
      : await compileTypst(files, mainFile);

    if (!result) {
      throw new Error("Compilation did not return a result.");
    }

    const pdf = result.pdf ? new Uint8Array(result.pdf) : undefined;
    const response: CompileResponse = {
      type: "compile-result",
      engine,
      mainFile,
      success: result.success,
      pdf,
      log: result.log,
      errors: result.errors,
      exitCode: result.exitCode,
    };

    if (pdf) {
      self.postMessage(response, { transfer: [pdf.buffer] });
      return;
    }

    self.postMessage(response);
  } catch (err) {
    const response: CompileResponse = {
      type: "compile-result",
      engine,
      mainFile,
      success: false,
      log: `Internal error: ${err instanceof Error ? err.message : String(err)}`,
      errors: [String(err)],
    };
    self.postMessage(response);
  }
};
