# Privacy

**In short:** segl. never uploads your documents. Everything happens locally in the browser on
your device.

## Local processing

- The PDF is read into the browser's memory through the file picker or drag and drop (File API).
- Viewing, rasterising, watermarking, redaction, flattening and creating the new PDF all happen in
  the browser with PDF.js, pdf-lib and Canvas, on your device.
- The finished PDF is created in memory and downloaded through a local `blob:` URL.
- There is no server that receives documents, no database and no user accounts.
- The app uses no analytics, tracking, cookies, ads or session recording. (For the Buy Me a
  Coffee button, see below.)
- Document content, file names and passwords are never logged to the console or included in error
  messages.
- The original file's bytes are not kept after the document is opened. When you close the
  document, any import in progress is cancelled and the app releases all references to the PDF.js
  document and the previews (object URLs are revoked). Note: this is not cryptographic erasure.
  The browser and operating system decide when memory is actually freed, and they may keep their
  own copies (for example swap, crash reports or the downloads folder).
- The tab title never shows the file name (it may contain personal data and end up in browser
  history or tab sync).

The claim "All processing happens locally in your browser. Your files are never uploaded." is
checked by automated tests (`tests/e2e/privacy.spec.ts`) that monitor all network traffic during
a complete processing and export. In addition, a strict Content Security Policy
(`connect-src 'self'`) prevents the app from sending requests to other domains.

## What is stored in the browser

| Storage | Contents |
| --- | --- |
| `localStorage` | Only `segl.lang` (language choice). |
| Cache Storage, IndexedDB, cookies, sessionStorage | Nothing. There is no service worker and no offline cache. |

Documents, file names, passwords, watermark texts (recipient/purpose) and redaction areas are
never stored.

## Network traffic

The only traffic is downloading the app itself from the same domain. The PDF engine (PDF.js and
pdf-lib) is downloaded when you open a file, and PDF.js loads CMaps, standard fonts and wasm
decoders from the same domain when a document needs them. These are static files that are the
same for everyone, and the requests contain no document data.

## External links and Buy Me a Coffee

- The "Support development" link in the footer and the source code links are ordinary links.
  Nothing is loaded from these services until you click. They open in a new tab without a
  referrer.
- **After a PDF has been created**, the official "Buy me a coffee" button is shown. It is loaded
  from `cdnjs.buymeacoffee.com` and Google Fonts. The button runs in an isolated sandbox (a
  separate frame with no access to the app), so it cannot see the document, the previews or
  anything else in the app. Buy Me a Coffee and Google only receive what any website receives:
  IP address, browser and time. No referrer is sent. The button is loaded only once a PDF has been
  exported. The document may still be open in the app, but the frame has no access to it.
- Links inside PDF documents are not clickable in the preview (pages are drawn as images).

## Hosting

The site is served by a static host (Cloudflare Pages). Like any web server, the host may record
technical data about requests for the app's files (IP address, time, browser). It never receives
your documents.
