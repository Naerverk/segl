# Personvern

**Kort fortalt:** segl. laster aldri opp dokumentene dine. Alt skjer lokalt i nettleseren på
din enhet.

## Lokal behandling

- PDF-filen leses inn i nettleserens minne gjennom filvelgeren eller dra-og-slipp (File API).
- Visning, rasterisering, vannmerking, sladding, flating og oppretting av ny PDF skjer i nettleseren
  med PDF.js, pdf-lib og Canvas – på din enhet.
- Den ferdige PDF-en lages i minnet og lastes ned via en lokal `blob:`-adresse.
- Det finnes ingen server som tar imot dokumenter, ingen database og ingen brukerkontoer.
- Appen bruker ingen analyseverktøy, sporing, informasjonskapsler (cookies), annonser eller
  «session recording». (Om Buy Me a Coffee-knappen: se under.)
- Dokumentinnhold, filnavn og passord logges ikke til konsollen og tas ikke med i feilmeldinger.
- Originalfilens bytes beholdes ikke etter at dokumentet er åpnet. Når du lukker dokumentet, avbrytes
  en eventuell pågående åpning, og appen slipper alle referanser til PDF.js-dokumentet og
  forhåndsvisningene (object URLs tilbakekalles). Merk: dette er ikke kryptografisk sletting – det er
  nettleseren og operativsystemet som bestemmer når minnet faktisk frigjøres, og de kan ha egne kopier
  (f.eks. swap, krasjrapporter eller nedlastingsmappen).
- Fanetittelen viser aldri filnavnet (det kan inneholde personopplysninger og havne i nettleserhistorikk
  eller fanesynkronisering).

Påstanden «All behandling skjer lokalt i nettleseren. Filene dine lastes aldri opp.» kontrolleres av
automatiske tester (`tests/e2e/privacy.spec.ts`) som overvåker all nettverkstrafikk under en
fullstendig behandling og eksport. I tillegg hindrer en streng Content Security Policy
(`connect-src 'self'`) at appen kan sende forespørsler til andre domener.

## Hva lagres i nettleseren

| Lagring | Innhold |
| --- | --- |
| `localStorage` | Kun `segl.lang` (språkvalg). |
| Cache Storage | Appens egne filer (HTML, JavaScript, CSS, ikoner og PDF.js-ressurser) slik at appen virker offline. Aldri dokumenter. |
| IndexedDB | Ingen app-data. (Workbox kan bruke en intern database til egen bokføring.) |
| Cookies, sessionStorage | Ingenting. |

Dokumenter, filnavn, passord, vannmerketekster (mottaker/formål) og sladdeområder lagres aldri.

## Nettverkstrafikk

Den eneste trafikken er nedlasting av selve appen fra samme domene ved første besøk og ved
oppdateringer. PDF.js henter CMaps, standardfonter og wasm-dekodere fra samme domene – dette er
statiske filer som er like for alle, og forespørslene inneholder ingen dokumentdata. Etter første
besøk fungerer appen helt uten nett.

## Eksterne lenker og Buy Me a Coffee

- Lenken «Støtt utviklingen» i bunnteksten og eventuell kildekodelenke er vanlige lenker. Ingenting lastes
  fra disse tjenestene før du klikker. De åpnes i ny fane uten referrer.
- **Etter at en PDF er laget** vises den offisielle «Buy me a coffee»-knappen. Den hentes fra
  `cdnjs.buymeacoffee.com` og Google Fonts. Knappen kjører i en isolert sandkasse (egen ramme uten
  tilgang til appen), så den kan ikke se dokumentet, forhåndsvisningene eller noe annet i appen.
  Buy Me a Coffee og Google mottar bare det enhver nettside mottar: IP-adresse, nettleser og tidspunkt.
  Ingen referrer sendes. Knappen lastes først når en PDF er ferdig eksportert. Dokumentet kan da
  fortsatt være åpent i appen, men rammen har ingen tilgang til det.
- Lenker inne i PDF-dokumenter er ikke klikkbare i forhåndsvisningen (sidene tegnes som bilder).

## Vertstjenesten

Selve nettsiden leveres av en statisk vert (Cloudflare Pages).
Slike verter kan, som alle webservere, registrere tekniske data om forespørsler etter appens filer
(IP-adresse, tidspunkt, nettleser). De mottar aldri dokumentene dine.
