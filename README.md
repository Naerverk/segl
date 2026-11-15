# segl.

[![Laget med KI](https://img.shields.io/badge/laget%20med-KI-8A2BE2)](#segl)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PDF.js](https://img.shields.io/badge/PDF.js-E5252A)](https://mozilla.github.io/pdf.js/)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/explore/progressive-web-apps)
[![Lisens: MIT](https://img.shields.io/badge/lisens-MIT-yellow)](LICENSE)

> [!NOTE]
> **Laget ved hjelp av kunstig intelligens.** Koden og dokumentasjonen er utviklet med hjelp av
> KI-verktøy. Kontroller alltid resultatet før du deler sensitive dokumenter.

segl. gjør PDF-er med sensitiv informasjon klare for deling, for eksempel en kopi av legitimasjon,
et signert brev eller en fullmakt. All behandling skjer lokalt i nettleseren, og filene lastes
aldri opp. Det finnes ingen backend, database eller brukerkontoer.

App: [segl.naerverk.no](https://segl.naerverk.no)

## Funksjoner

- Hver side i resultatet blir et nytt JPEG-bilde. Tekst, skjulte lag, skjemafelt, vedlegg, skript
  og metadata fra originalen følger ikke med.
- Permanent sladding: pikslene overskrives før bildet lagres.
- Vannmerke med mottaker, formål og dato.
- To moduser per side: **Beskytt** (150 DPI) og **Høy kvalitet** (200 DPI).
- Forhåndsvisning med samme kode som eksporten.
- Passordbeskyttede PDF-er (passordet lagres ikke).
- Installerbar PWA som virker offline. Norsk og engelsk.

Se [SECURITY.md](SECURITY.md) for sikkerhetsmodell og begrensninger, og [PRIVACY.md](PRIVACY.md)
for personvern.

## Kom i gang

Krav: Node.js ≥ 22.18 (se `.nvmrc`).

```bash
npm install          # kopierer også PDF.js-ressurser til public/pdfjs
npm run dev          # http://localhost:5173
npm run build        # produksjonsbygg til dist/
```

## Tester

```bash
npm test                          # enhets- og integrasjonstester
npx playwright install chromium   # første gang
npm run test:e2e                  # ende-til-ende-, personvern- og offlinetester
```

## Konfigurasjon

Kopier `.env.example` til `.env`. Verdiene bygges inn ved byggetid og er ikke hemmelige.

| Variabel | Beskrivelse |
| --- | --- |
| `VITE_BUYMEACOFFEE_URL` | Buy Me a Coffee-side (`https://`). Tom = ingen lenke eller knapp. |
| `VITE_SOURCE_URL` | Lenke til kildekoden (standard: https://github.com/Naerverk/segl). |
| `VITE_BASE` | Basesti ved publisering i undermappe (standard `/`). |

## Publisering

`dist/` er en statisk nettside som kan legges på en hvilken som helst vert med HTTPS.
Sikkerhetshodene genereres til `dist/_headers`.

Produksjon på Cloudflare Pages publiseres ved å pushe en tag `prod_YYYY_MM_DD_N` på `main`
(`npm run release`). Workflowen kjører hele CI-suiten før publisering. Nødvendige secrets står i
`.github/workflows/deploy-cloudflare.yml`.

## Teknologi

React, TypeScript, Vite, Tailwind CSS, PDF.js, pdf-lib, Workbox, Vitest og Playwright.

## Lisens

[MIT](LICENSE). Lisensene for tredjepartskode som følger med appen, samles ved bygg i
`dist/third-party-licenses.txt`.

## Støtt prosjektet

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/jenslien)
