import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { Document, Page, StyleSheet, pdf } from "@react-pdf/renderer";
import Html from "react-pdf-html";
import {
  getFileExtension,
  normalizePath,
  type VFSFile,
} from "@/lib/project-files";
import type {
  CompileResponse,
  CompileStatusMessage,
} from "@/workers/tex.worker";

type MarkdownCompileFile = Pick<VFSFile, "name" | "content" | "kind" | "mimeType">;
type MarkdownToken = ReturnType<MarkdownIt["parse"]>[number];

interface CompileMarkdownOptions {
  files: MarkdownCompileFile[];
  mainFile: string;
  stylesheetPaths: string[];
  onStatusChange?: (phase: CompileStatusMessage["phase"]) => void;
}

interface MarkdownRenderEnv {
  baseFile: string;
  files: Map<string, MarkdownCompileFile>;
  missingImages: string[];
}

const textEncoder = new TextEncoder();

const MARKDOWN_PAGE_STYLES = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.55,
    paddingTop: 52,
    paddingBottom: 54,
    paddingHorizontal: 52,
  },
  html: {
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.55,
  },
});

const DEFAULT_MARKDOWN_PRINT_CSS = String.raw`
body {
  color: #111827;
  font-family: Helvetica;
  font-size: 11pt;
  line-height: 1.55;
}

h1, h2, h3, h4, h5, h6 {
  color: #8c3b15;
  font-family: Helvetica;
  font-weight: 700;
  line-height: 1.15;
  margin-top: 0;
  margin-bottom: 8pt;
}

h1 {
  font-size: 26pt;
  border-bottom: 1px solid #d6c6b8;
  padding-bottom: 12px;
  margin-bottom: 18px;
}

h2 {
  font-size: 18pt;
  margin-top: 18px;
}

h3 {
  font-size: 14pt;
  margin-top: 14px;
}

p {
  margin-top: 0;
  margin-bottom: 10pt;
}

a {
  color: #0f766e;
  text-decoration: underline;
}

ul, ol {
  margin-top: 0;
  margin-bottom: 10pt;
  padding-left: 18px;
}

li {
  margin-bottom: 4px;
}

li > ul,
li > ol {
  margin-top: 4px;
  margin-bottom: 0;
}

blockquote {
  margin: 0 0 12px 0;
  padding: 10px 12px;
  border-left: 3px solid #c98b4a;
  background: #faf6ef;
  color: #4b5563;
}

img {
  margin-top: 8px;
  margin-bottom: 14px;
}

table {
  width: 100%;
  margin-bottom: 14px;
  border: 1px solid #d4c4b6;
}

thead {
  background-color: #f3e6da;
}

th,
td {
  border: 1px solid #d4c4b6;
  padding: 6px 8px;
  text-align: left;
}

th {
  padding: 0;
  color: #6b2d10;
  font-weight: 700;
}

.wasmtex-table-heading-cell {
  padding: 6px 8px;
}

.wasmtex-code-block {
  margin: 0 0 14px 0;
  padding: 10px 12px;
  background-color: #111827;
  color: #f8fafc;
  border-radius: 6px;
  font-family: Courier;
  font-size: 9.2pt;
  white-space: pre-wrap;
}

code {
  font-family: Courier;
  font-size: 9.2pt;
  color: #9a3412;
}

hr {
  border: 0;
  border-top: 1px solid #d6c6b8;
  margin: 16px 0;
}
`;

const HIGHLIGHT_INLINE_STYLES: Record<string, string> = {
  "hljs-comment": "color: #94a3b8; font-style: italic;",
  "hljs-quote": "color: #94a3b8; font-style: italic;",
  "hljs-keyword": "color: #f59e0b;",
  "hljs-selector-tag": "color: #f59e0b;",
  "hljs-subst": "color: #f59e0b;",
  "hljs-string": "color: #86efac;",
  "hljs-doctag": "color: #86efac;",
  "hljs-regexp": "color: #86efac;",
  "hljs-template-variable": "color: #86efac;",
  "hljs-title": "color: #7dd3fc;",
  "hljs-section": "color: #7dd3fc;",
  "hljs-name": "color: #7dd3fc;",
  "hljs-selector-id": "color: #7dd3fc;",
  "hljs-selector-class": "color: #7dd3fc;",
  "hljs-number": "color: #fca5a5;",
  "hljs-literal": "color: #fca5a5;",
  "hljs-symbol": "color: #fca5a5;",
  "hljs-bullet": "color: #fca5a5;",
  "hljs-attr": "color: #fca5a5;",
  "hljs-variable": "color: #fca5a5;",
  "hljs-type": "color: #fca5a5;",
  "hljs-built_in": "color: #fca5a5;",
  "hljs-meta": "color: #c4b5fd;",
  "hljs-meta-keyword": "color: #c4b5fd;",
  "hljs-title.class_": "color: #7dd3fc;",
  "hljs-title.function_": "color: #7dd3fc;",
  "hljs-params": "color: #f8fafc;",
};

function buildFileMap(files: MarkdownCompileFile[]) {
  return new Map(files.map((file) => [normalizePath(file.name), file]));
}

function isRemoteTarget(target: string) {
  return /^[a-z]+:/i.test(target) || target.startsWith("//") || target.startsWith("#");
}

function resolveRelativePath(baseFile: string, targetPath: string) {
  const cleanedTarget = targetPath.trim();
  if (!cleanedTarget) return "";

  if (isRemoteTarget(cleanedTarget) || cleanedTarget.startsWith("/")) {
    return normalizePath(cleanedTarget);
  }

  const baseSegments = normalizePath(baseFile).split("/").slice(0, -1);
  const targetSegments = cleanedTarget.split("/");

  for (const segment of targetSegments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      baseSegments.pop();
      continue;
    }

    baseSegments.push(segment);
  }

  return normalizePath(baseSegments.join("/"));
}

function byteArrayToBase64(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getFileMimeType(file: MarkdownCompileFile) {
  if (file.mimeType) {
    return file.mimeType;
  }

  switch (getFileExtension(file.name)) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isSvgAsset(file: MarkdownCompileFile) {
  return getFileMimeType(file) === "image/svg+xml" || getFileExtension(file.name) === "svg";
}

function asDataUri(file: MarkdownCompileFile) {
  const mimeType = getFileMimeType(file);
  if (typeof file.content === "string") {
    return `data:${mimeType};base64,${byteArrayToBase64(textEncoder.encode(file.content))}`;
  }

  return `data:${mimeType};base64,${byteArrayToBase64(file.content)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyInlineHighlightStyles(markup: string) {
  return markup.replace(/<span class="([^"]+)">/g, (_match, classNames: string) => {
    const styles = classNames
      .split(/\s+/)
      .map((className) => HIGHLIGHT_INLINE_STYLES[className])
      .filter(Boolean)
      .join(" ");

    return styles ? `<span style="${styles}">` : "<span>";
  });
}

function highlightCodeMarkup(code: string, language: string) {
  if (language && hljs.getLanguage(language)) {
    try {
      return applyInlineHighlightStyles(
        hljs.highlight(code, {
          language,
          ignoreIllegals: true,
        }).value
      );
    } catch {
      return escapeHtml(code);
    }
  }

  return escapeHtml(code);
}

function formatCodeBlockHtml(markup: string) {
  return markup.replace(/\n/g, "<br />");
}

function collectImageTokens(tokens: MarkdownToken[]): MarkdownToken[] {
  const imageTokens: MarkdownToken[] = [];

  for (const token of tokens) {
    if (token.type === "image") {
      imageTokens.push(token);
    }

    if (token.children && token.children.length > 0) {
      imageTokens.push(...collectImageTokens(token.children));
    }
  }

  return imageTokens;
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image resource: ${source}`));
    image.src = source;
  });
}

async function convertSvgToPngDataUri(file: MarkdownCompileFile) {
  const svgMarkup = typeof file.content === "string"
    ? file.content
    : new TextDecoder().decode(file.content);
  const svgBlobUrl = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml" }));

  try {
    const image = await loadImageElement(svgBlobUrl);
    const canvas = document.createElement("canvas");

    const width = image.naturalWidth || image.width || 480;
    const height = image.naturalHeight || image.height || 220;

    // Rasterize SVG at a higher effective DPI for crispness in PDFs.
    // Typical browser CSS px assume 96 DPI; target ~300 DPI for print-quality.
    const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const TARGET_DPI = 300;
    const BASE_DPI = 96;
    const maxScale = 6; // avoid excessive memory usage for very large scales
    const computedScale = Math.ceil((TARGET_DPI / BASE_DPI) * DPR);
    const scale = Math.min(maxScale, Math.max(3, computedScale));

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    // Keep CSS size equal to logical SVG size so layout remains unchanged
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    // Scale the drawing context so drawing the image at logical size
    // produces a higher-resolution bitmap.
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgBlobUrl);
  }
}

async function resolveAssetSource(file: MarkdownCompileFile) {
  if (isSvgAsset(file)) {
    return convertSvgToPngDataUri(file);
  }

  return asDataUri(file);
}

function createMarkdownRenderer() {
  const renderer = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  });

  const defaultThOpen = renderer.renderer.rules.th_open;
  const defaultThClose = renderer.renderer.rules.th_close;

  renderer.renderer.rules.th_open = (tokens, index, options, env, self) => {
    const openTag = defaultThOpen
      ? defaultThOpen(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);

    return `${openTag}<div class="wasmtex-table-heading-cell">`;
  };

  renderer.renderer.rules.th_close = (tokens, index, options, env, self) => {
    const closeTag = defaultThClose
      ? defaultThClose(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);

    return `</div>${closeTag}`;
  };

  renderer.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const language = token.info.trim().split(/\s+/)[0] ?? "";
    const highlighted = formatCodeBlockHtml(highlightCodeMarkup(token.content, language));
    return `<div class="wasmtex-code-block">${highlighted}</div>`;
  };

  renderer.renderer.rules.code_block = (tokens, index) => {
    const token = tokens[index];
    return `<div class="wasmtex-code-block">${formatCodeBlockHtml(escapeHtml(token.content))}</div>`;
  };

  return renderer;
}

async function renderMarkdownHtml(markdownSource: string, env: MarkdownRenderEnv) {
  const renderer = createMarkdownRenderer();
  const tokens = renderer.parse(markdownSource, {}) as ReturnType<MarkdownIt["parse"]>;
  const imageTokens = collectImageTokens(tokens);

  for (const token of imageTokens) {
    const source = token.attrGet("src")?.trim() ?? "";

    if (!source || isRemoteTarget(source) || source.startsWith("data:")) {
      continue;
    }

    const resolvedPath = resolveRelativePath(env.baseFile, source);
    const asset = env.files.get(resolvedPath);

    if (!asset) {
      env.missingImages.push(`${source} (resolved to ${resolvedPath})`);
      continue;
    }

    token.attrSet("src", await resolveAssetSource(asset));
  }

  return renderer.renderer.render(tokens, renderer.options, {});
}

function createHtmlDocument(bodyHtml: string, selectedStylesheets: string[]) {
  const styleTags = [
    `<style>${DEFAULT_MARKDOWN_PRINT_CSS}</style>`,
    ...selectedStylesheets.map((stylesheet) => `<style>${stylesheet}</style>`),
  ];

  return `
    <html>
      <body>
        ${styleTags.join("\n")}
        ${bodyHtml}
      </body>
    </html>
  `;
}

export async function compileMarkdownToPdf({
  files,
  mainFile,
  stylesheetPaths,
  onStatusChange,
}: CompileMarkdownOptions): Promise<CompileResponse> {
  try {
    const normalizedMainFile = normalizePath(mainFile);
    const fileMap = buildFileMap(files);
    const mainEntry = fileMap.get(normalizedMainFile);

    if (!mainEntry || typeof mainEntry.content !== "string") {
      return {
        type: "compile-result",
        engine: "markdown",
        mainFile,
        success: false,
        log: `Error: Main markdown file "${mainFile}" not found.`,
        errors: [`File not found: ${mainFile}`],
      };
    }

    onStatusChange?.("initializing");

    const selectedStylesheets = stylesheetPaths.flatMap((path) => {
      const entry = fileMap.get(normalizePath(path));
      return entry && typeof entry.content === "string" ? [entry.content] : [];
    });

    const renderEnv: MarkdownRenderEnv = {
      baseFile: normalizedMainFile,
      files: fileMap,
      missingImages: [],
    };

    const bodyHtml = await renderMarkdownHtml(mainEntry.content, renderEnv);

    if (renderEnv.missingImages.length > 0) {
      return {
        type: "compile-result",
        engine: "markdown",
        mainFile,
        success: false,
        log: [
          `Markdown PDF failed: ${mainFile}`,
          "",
          ...renderEnv.missingImages.map((entry) => `Missing image: ${entry}`),
        ].join("\n"),
        errors: renderEnv.missingImages.map((entry) => `Missing image: ${entry}`),
      };
    }

    onStatusChange?.("compiling");

    const html = createHtmlDocument(bodyHtml, selectedStylesheets);
    const blob = await pdf(
      <Document title={mainFile} author="WasmTeX" subject="Markdown to PDF export">
        <Page size="A4" style={MARKDOWN_PAGE_STYLES.page} wrap>
          <Html style={MARKDOWN_PAGE_STYLES.html}>{html}</Html>
        </Page>
      </Document>
    ).toBlob();
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());

    return {
      type: "compile-result",
      engine: "markdown",
      mainFile,
      success: true,
      pdf: pdfBytes,
      log: [
        `Markdown PDF generated: ${mainFile}`,
        "Pages: A4 print layout",
        `Stylesheets applied: ${selectedStylesheets.length}`,
        `Images resolved: ${bodyHtml.includes("<img") ? "yes" : "none"}`,
        "Vector text rendering: react-pdf",
      ].join("\n"),
      errors: [],
    };
  } catch (error) {
    return {
      type: "compile-result",
      engine: "markdown",
      mainFile,
      success: false,
      log: `Markdown PDF failed: ${error instanceof Error ? error.message : String(error)}`,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}