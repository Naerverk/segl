# Sikkerhet

## Hva segl. beskytter mot

Utilsiktet deling av mer enn du har tenkt: skjult tekst, metadata, vedlegg, skript, redigerbare
skjemafelt og innhold under sladding. Et synlig vannmerke viser hva kopien er ment for.

## Hva segl. ikke beskytter mot

En mottaker som kan se dokumentet, kan alltid ta skjermbilde, fotografere, skrive ut eller
retusjere det. Vannmerker gjør misbruk vanskeligere, men ikke umulig.

## Slik fungerer det

- **Alltid raster.** Hver side i den nye PDF-en er ett nytt JPEG-bilde. Tekst, fonter, skjulte lag,
  skjemafelt, kommentarer, vedlegg, JavaScript, metadata og digitale signaturer fra originalen kan
  ikke følge med. Eneste metadata i resultatet er `Producer: segl.`.
- **Sladding** overskriver pikslene i de merkede områdene før bildet kodes. Innholdet under finnes
  ikke i resultatfilen.
- **Ubetrodde PDF-er** parses i PDF.js' egen Web Worker og tegnes kun til canvas. PDF-JavaScript og
  XFA kjøres aldri.
- **Ingenting utelates i det stille.** Bilder i PDF-en fjernes aldri ved tegning. Dokumenter med
  bilder over 120 megapiksler avvises, og en side som ikke kan tegnes fullstendig, stopper eksporten.
- **Ressursgrenser:** maks 300 MB fil, 2000 sider og 16 MP canvas per side (DPI senkes automatisk).
- **Streng CSP:** `default-src 'none'`, alt annet bare fra `'self'`. Se `src/config/csp.ts`.

## Begrensninger

- Teksten i resultatet kan ikke søkes i, kopieres eller leses opp av skjermlesere.
- En digital signatur blir ikke med i den nye PDF-en. Appen varsler om signerte dokumenter.
- Kryptering av resultatfilen støttes ikke.
- XFA-skjemaer støttes ikke.
- Resultatet forutsetter at PDF.js tegner siden riktig. Kontroller alltid forhåndsvisningen.

## Rapportere sårbarheter

Rapporter sårbarheter privat via «Report a vulnerability» under
[Security](https://github.com/Naerverk/segl/security) i repoet, ikke som et offentlig issue.
Ikke legg ved ekte dokumenter. Lag heller en minimal, syntetisk testfil.
