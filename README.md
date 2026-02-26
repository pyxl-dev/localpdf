# LocalPDF

**Free, open-source PDF tools that run entirely in your browser.**

No upload. No server. No tracking. Your files never leave your device.

## Features

| Tool | Description |
|------|-------------|
| **Merge PDF** | Combine multiple PDF files into one document |
| **Split PDF** | Extract specific pages from a PDF |
| **Reorder Pages** | Drag and drop to rearrange PDF pages |
| **Rotate Pages** | Rotate individual pages by 90, 180 or 270 degrees |
| **Remove Pages** | Delete specific pages from a PDF |
| **Images to PDF** | Convert JPG/PNG images into a multi-page PDF |
| **Edit Metadata** | View and edit PDF title, author, subject, keywords |
| **Page Numbers** | Add page numbers to every page |
| **Watermark** | Add a text watermark overlay on all pages |

## Privacy

LocalPDF processes everything **client-side** using JavaScript. Your PDF files are never uploaded to any server. The application works entirely offline after the initial page load.

- Zero network requests during processing
- No cookies, no analytics, no tracking
- Content Security Policy blocks all external resources
- Open source — verify it yourself

## Quick Start

### Online

Visit the hosted version (zero server processing, everything runs in your browser).

### Docker

```bash
docker run -p 8080:80 ghcr.io/OWNER/localpdf:latest
```

Then open http://localhost:8080

### Docker Compose

```yaml
services:
  localpdf:
    image: ghcr.io/OWNER/localpdf:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

```bash
docker compose up -d
```

### Build from source

```bash
git clone https://github.com/OWNER/localpdf.git
cd localpdf
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

- **React** + **TypeScript** + **Vite** — Modern, fast frontend
- **Tailwind CSS** — Utility-first styling
- **pdf-lib** — Client-side PDF manipulation (merge, split, rotate, metadata, etc.)
- **PDF.js** — PDF page rendering for thumbnails
- **nginx** — Production serving (Docker)

## Self-Hosting

LocalPDF is designed for self-hosting. The Docker image is a minimal nginx container serving static files.

```bash
docker build -t localpdf .
docker run -p 8080:80 localpdf
```

The nginx configuration includes:
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Gzip compression
- Static asset caching
- SPA fallback routing

## Development

```bash
npm install    # Install dependencies
npm run dev    # Start dev server (http://localhost:5173)
npm run build  # Production build
npm run lint   # Run ESLint
npx tsc -b     # Type check
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/new-tool`)
3. Commit your changes
4. Push and open a Pull Request

## License

MIT
