<div align="center">

# WasmTeX

### A privacy-first, browser-based LaTeX and Typst editor powered by WebAssembly.

Write, compile, and preview LaTeX or Typst documents - entirely in your browser. No server. No install. No document data leaves your machine.

**[Launch Editor →](https://latex.zxcv.fyi)**

</div>

---

## How It Works

WasmTeX runs a complete TeX engine via **WebAssembly** in a Web Worker, keeping your UI responsive while compiling. All files live in a **Virtual File System (VFS)** backed by IndexedDB - your documents persist across sessions without any server.

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
- **Monaco Editor** - VS Code's editor engine with custom LaTeX syntax highlighting and a bespoke dark theme
- **Virtual File System** - Create, rename, and delete `.tex` files with automatic IndexedDB persistence
- **Dual PDF Compilation** - LaTeX compiles through BusyTeX and Typst compiles through Typst.ts, both entirely in the browser
- **Web Worker Compilation** - TeX runs off the main thread for a responsive editing experience
- **Zero Backend** - Everything happens client-side. Your documents never leave your browser

## Runtime Assets

The TeX engine is powered by `texlyre-busytex` and requires large WASM/data assets that are not bundled into the app source automatically.

Run `npm run download:tex-assets` after installing dependencies to place the runtime files under `public/core/busytex`.

## License

MIT

