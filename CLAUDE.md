# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalPDF is a client-side-only PDF manipulation SPA. All PDF processing happens in the browser — zero server involvement, no uploads, no tracking. Deployed to GitHub Pages and available as a Docker image.

**Live:** https://pyxl-dev.github.io/localpdf/

## Commands

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npx tsc -b         # TypeScript type checking only
npm run preview    # Preview production build
```

No test framework is currently installed.

## Architecture

### Tech Stack
- React 19 + TypeScript (strict mode) + Vite 7 + Tailwind CSS 4
- **pdf-lib** — primary PDF manipulation engine (merge, split, rotate, metadata, page numbers, watermark)
- **pdfjs-dist** — fallback renderer for corrupted/encrypted PDFs (renders pages to PNG, re-embeds in new pdf-lib document)
- Hash-based routing via react-router-dom (required for GitHub Pages static hosting)

### Source Layout

```
src/
  main.tsx                  # Entry: StrictMode > HashRouter > LanguageProvider > App
  App.tsx                   # Route definitions (10 routes)
  components/
    Layout.tsx              # Header/footer shell
    ToolLayout.tsx          # Shared tool page template (title, description, back link)
    FileDropzone.tsx        # Reusable drag-and-drop file input
  pages/                    # One component per tool (MergePDF, SplitPDF, etc.)
  lib/
    pdf-operations.ts       # All PDF manipulation functions (pdf-lib + pdfjs fallback)
    pdf-renderer.ts         # PDF.js thumbnail rendering (canvas → PNG data URL)
    download.ts             # Blob → file download helper
  hooks/
    usePdfPages.ts          # Hook for loading PDF pages with thumbnails
  i18n/
    translations.ts         # EN/FR/ES translation strings (type-safe keys)
    LanguageContext.tsx      # React context provider
    useTranslation.ts       # Hook: t(key, params)
    context.ts              # Context type definitions
```

### Key Patterns

- **PDF fallback chain:** `loadPdf()` in `pdf-operations.ts` tries pdf-lib first, falls back to pdfjs-dist rendering if parsing fails. This is the core resilience pattern — don't break it.
- **Immutable state:** All state updates use spread/new objects, never mutation.
- **No state management library:** Pure React useState/useCallback. No Redux/Zustand.
- **i18n:** Type-safe translation keys. Browser language auto-detected, persisted to localStorage. Adding a new locale requires adding to the `Locale` type union and adding all translation strings.
- **Relative base path:** `base: './'` in vite.config.ts — required for GitHub Pages. Don't change to absolute.

### Adding a New Tool

1. Create `src/pages/NewTool.tsx` using `ToolLayout` wrapper and `FileDropzone`
2. Add PDF operation function in `src/lib/pdf-operations.ts`
3. Add route in `src/App.tsx`
4. Add tool card in `src/pages/Home.tsx`
5. Add all translation keys in `src/i18n/translations.ts` for all 3 locales (en, fr, es)

## CI/CD

CI runs on every PR and push to main: lint → type check → build → dependency review → npm audit (fails on HIGH) → license check → Gitleaks secret scan.

Deploy to GitHub Pages triggers automatically after CI passes on main.

Docker builds trigger on version tags (`v*`) with multi-platform support (amd64/arm64), Trivy scanning, and SBOM generation.

## Styling

Dark theme with Slate/Blue palette. All styling via Tailwind utility classes — no component library. Custom scrollbar styles in `src/index.css`.

## Security Considerations

- CSP headers configured in Dockerfile's nginx.conf — `wasm-unsafe-eval` required for pdf.js
- `ignoreEncryption: true` used when loading PDFs to handle encrypted files gracefully
- No external API calls, no cookies, no analytics
