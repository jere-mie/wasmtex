<div align="center">

# WasmTeX

### A privacy-first, browser-based LaTeX, Typst, and Markdown-to-PDF editor powered by WebAssembly.

Write, compile, and preview LaTeX, Typst, or Markdown documents entirely in your browser. No server. No install. No document data leaves your machine.

**[Launch Editor →](https://latex.zxcv.fyi)**

</div>

---

## How It Works

WasmTeX runs LaTeX and Typst compilers in the browser and now also renders Markdown directly into vector PDFs with print-focused defaults. All files live in a **Virtual File System (VFS)** backed by IndexedDB, so your documents persist across sessions without any server.

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ File     │  │  Monaco      │  │  PDF Preview       │  │
│  │ Explorer │  │  Editor      │  │  (iframe/pdf.js)   │  │
│  │          │  │              │  │                    │  │
│  │  VFS     │  │  TeX syntax  │  ├────────────────────┤  │
│  │  tree    │  │  highlighting│  │  Compile Console   │  │
│  └──────────┘  └──────┬───────┘  └──────────┬─────────┘  │
│                       │                     │            │
│                   ┌───┴─────────────────────┴────┐       │
│                   │      Web Worker (TeX WASM)   │       │
│                   └───────────────┬──────────────┘       │
│                                   │                      │
│                   ┌───────────────┴────────────────┐     │
│                   │      IndexedDB (VFS Store)     │     │
│                   └────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/wasmtex.git
cd wasmtex

# Install dependencies
npm install

# Download the BusyTeX runtime assets used for in-browser PDF generation
npm run download:tex-assets

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript via Vite |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | Radix UI primitives |
| **Editor** | Monaco Editor |
| **TeX Engine** | WebAssembly (Web Worker) |
| **Persistence** | IndexedDB via `idb-keyval` |
| **Icons** | Lucide React |
| **Animations** | Motion |
| **Toasts** | Sonner |

## Features

- **Full IDE Layout** - Resizable 3-panel design: file explorer, tabbed editor, and PDF preview with console
- **Monaco Editor** - VS Code's editor engine with custom LaTeX and Typst tokenizers plus built-in Markdown highlighting
- **Virtual File System** - Create, rename, and delete project files including `.tex`, `.typ`, `.md`, `.css`, and local image assets with IndexedDB persistence
- **Three PDF Paths** - LaTeX compiles through BusyTeX, Typst compiles through Typst.ts, and Markdown renders to vector PDFs through react-pdf
- **Print-Ready Markdown** - Headings, nested lists, links, images, tables, and syntax-highlighted code blocks are styled for paper output out of the box
- **Markdown CSS Overrides** - Project CSS files can be enabled from Settings to customize Markdown PDF output without changing the app code
- **Starter Samples** - Fresh workspaces include sample LaTeX, Typst, and Markdown files plus a default Markdown print stylesheet and image asset
- **Web Worker Compilation** - TeX runs off the main thread for a responsive editing experience
- **Zero Backend** - Everything happens client-side. Your documents never leave your browser

## Markdown Support

Markdown files compile to vector PDFs using a print-focused renderer. The default sample demonstrates:

- Headings and paragraphs
- Nested unordered lists
- Clickable external links in the generated PDF
- Local project images
- Tables with styled header rows and borders
- Fenced code blocks with syntax highlighting

To customize the output, edit `markdown-print.css` or add your own `.css` files and enable them in Settings under **Markdown Print CSS**.

## Runtime Assets

The LaTeX engine is powered by `texlyre-busytex` and requires large WASM/data assets that are not bundled into the app source automatically.

Run `npm run download:tex-assets` after installing dependencies to place the runtime files under `public/core/busytex`.

Typst font assets are downloaded automatically during `npm run build`.

## Docs

- `docs/typst-support.md`
- `docs/markdown-support.md`

## License

MIT

