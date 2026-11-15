# Security

## What segl. protects against

Accidentally sharing more than you intended: hidden text, metadata, attachments, scripts,
editable form fields and content under redactions. A visible watermark shows what the copy is
meant for.

## What segl. does not protect against

A recipient who can see the document can always take a screenshot, photograph, print or retouch
it. Watermarks make misuse harder, not impossible.

## How it works

- **Always raster.** Every page in the new PDF is a single new JPEG image. Text, fonts, hidden
  layers, form fields, comments, attachments, JavaScript, metadata and digital signatures from the
  original cannot be carried over. The only metadata in the result is `Producer: segl.`.
- **Redaction** overwrites the pixels in the marked areas before the image is encoded. The content
  underneath does not exist in the output file.
- **Untrusted PDFs** are parsed in PDF.js' own Web Worker and only drawn to a canvas. PDF
  JavaScript and XFA are never executed.
- **Nothing is dropped silently.** Images in the PDF are never removed while rendering. Documents
  with images above 120 megapixels are rejected, and a page that cannot be rendered completely
  stops the export.
- **Resource limits:** at most 300 MB per file, 2000 pages and a 16 MP canvas per page (the DPI is
  lowered automatically).
- **Strict CSP:** `default-src 'none'`, everything else only from `'self'`. See
  `src/config/csp.ts`.

## Limitations

- Text in the result cannot be searched, copied or read by screen readers.
- A digital signature is not carried over to the new PDF. The app warns about signed documents.
- Encrypting the output file is not supported.
- XFA forms are not supported.
- A correct result depends on PDF.js rendering the page correctly. Always check the preview.

## Reporting a vulnerability

Please report vulnerabilities privately via **Report a vulnerability** under
[Security](https://github.com/Naerverk/segl/security), not as a public issue. Do not attach real
documents; create a minimal synthetic test file instead.
