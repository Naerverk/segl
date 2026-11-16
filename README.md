# segl.

[![Made with AI](https://img.shields.io/badge/made%20with-AI-8A2BE2)](#segl)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PDF.js](https://img.shields.io/badge/PDF.js-E5252A)](https://mozilla.github.io/pdf.js/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

> [!NOTE]
> **Built with the help of artificial intelligence.** The code and documentation were developed
> with AI tools. Always check the result before you share sensitive documents.

🇳🇴 *På norsk: segl. lager trygge delingskopier av PDF-er, helt lokalt i nettleseren. Bruk appen
på [segl.naerverk.no](https://segl.naerverk.no).*

segl. prepares PDFs that contain sensitive information for sharing, for example a copy of an ID
document, a signed letter or a power of attorney. All processing happens locally in the browser,
and files are never uploaded. There is no backend, database or user account.

App: [segl.naerverk.no](https://segl.naerverk.no) (Norwegian and English)

## Features

- Every page in the result becomes a new JPEG image. Text, hidden layers, form fields,
  attachments, scripts and metadata from the original are not carried over.
- Permanent redaction: the pixels are overwritten before the image is saved.
- Watermark with recipient, purpose and date.
- Two modes per page: **Standard** (150 DPI) and **High detail** (200 DPI or more).
- Preview rendered by the same code as the export.
- Password-protected PDFs (the password is never stored).
- Small download: the start page is about 90 KB; the PDF engine is only loaded when a file is opened.

See [SECURITY.md](SECURITY.md) for the security model and limitations, and
[PRIVACY.md](PRIVACY.md) for privacy.

## Getting started

Requires Node.js ≥ 22.18 (see `.nvmrc`).

```bash
npm install          # also copies PDF.js resources to public/pdfjs
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
```

## Tests

```bash
npm test                          # unit and integration tests
npx playwright install chromium   # first time only
npm run test:e2e                  # end-to-end and privacy tests
```

## Configuration

Copy `.env.example` to `.env`. The values are embedded at build time and are not secret.

| Variable | Description |
| --- | --- |
| `VITE_BUYMEACOFFEE_URL` | Buy Me a Coffee page (`https://`). Empty = no link or button. |
| `VITE_SOURCE_URL` | Link to the source code (default: https://github.com/Naerverk/segl). |
| `VITE_BASE` | Base path when hosted in a subfolder (default `/`). |

## Deployment

`dist/` is a static site that can be served by any host with HTTPS. Security headers are
generated into `dist/_headers`.

Production on Cloudflare Pages is deployed by pushing a `prod_YYYY_MM_DD_N` tag on `main`
(`npm run release`). The workflow runs the full CI suite before deploying. The required secrets
are listed in `.github/workflows/deploy-cloudflare.yml`.

## Technology

React, TypeScript, Vite, Tailwind CSS, PDF.js, pdf-lib, Vitest and Playwright.

## License

[MIT](LICENSE). Licenses for third-party code shipped with the app are collected at build time
in `dist/third-party-licenses.txt`.

## Support the project

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/jenslien)
