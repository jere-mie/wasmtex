import { BusyTexRunner } from "texlyre-busytex";

export interface CompileRequest {
  type: "compile";
  files: { name: string; content: string }[];
  mainFile: string;
}

export interface CompileStatusMessage {
  type: "compile-status";
  phase: "initializing" | "compiling";
}

export interface CompileResponse {
  type: "compile-result";
  success: boolean;
  pdf?: Uint8Array;
  log: string;
  errors: string[];
  exitCode?: number;
}

const runner = new BusyTexRunner({
  busytexBasePath: "/core/busytex",
  verbose: false,
});

const DRIVER_ORDER = [
  "xetex_bibtex8_dvipdfmx",
  "luahbtex_bibtex8",
  "pdftex_bibtex8",
] as const;

let runnerReady: Promise<void> | null = null;

function ensureRunnerReady() {
  if (!runnerReady) {
    runnerReady = runner.initialize(true).catch((error) => {
      runnerReady = null;
      throw error;
    });
  }

  return runnerReady;
}

function extractErrors(log: string, exitCode?: number) {
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

async function compileWithFallback(
  files: { name: string; content: string }[],
  mainFile: string
) {
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
      ["/core/busytex/texlive-extra.js"]
    );

    if (result.success) {
      if (driver === DRIVER_ORDER[0]) {
        return result;
      }

      return {
        ...result,
        log: [`Engine selected: ${driver}`, "", result.log].join("\n"),
      };
    }

    lastResult = result;
  }

  return lastResult;
}

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
  const { type, files, mainFile } = event.data;

  if (type !== "compile") return;

  try {
    const main = files.find((f) => f.name === mainFile);
    if (!main) {
      const response: CompileResponse = {
        type: "compile-result",
        success: false,
        log: `Error: Main file "${mainFile}" not found.`,
        errors: [`File not found: ${mainFile}`],
      };
      self.postMessage(response);
      return;
    }

    const statusInit: CompileStatusMessage = { type: "compile-status", phase: "initializing" };
    self.postMessage(statusInit);

    await ensureRunnerReady();

    const statusCompiling: CompileStatusMessage = { type: "compile-status", phase: "compiling" };
    self.postMessage(statusCompiling);

    const result = await compileWithFallback(files, mainFile);

    if (!result) {
      throw new Error("Compilation did not return a result.");
    }

    const pdf = result.pdf ? new Uint8Array(result.pdf) : undefined;
    const response: CompileResponse = {
      type: "compile-result",
      success: result.success,
      pdf,
      log: result.log,
      errors: result.success ? [] : extractErrors(result.log, result.exitCode),
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
      success: false,
      log: `Internal error: ${err instanceof Error ? err.message : String(err)}`,
      errors: [String(err)],
    };
    self.postMessage(response);
  }
};
