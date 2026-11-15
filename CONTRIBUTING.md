# Bidra til segl.

Repo: [Naerverk/segl](https://github.com/Naerverk/segl).
Alle kan foreslå endringer via en fork og pull request. Bare vedlikeholdere merger og publiserer.
Vi vurderer bidrag etter kapasitet; vi lover ikke svartid eller at forslag blir tatt inn.
Avklar større funksjoner i et issue før du starter. Små feilrettinger kan sendes direkte.

## Lokal utvikling

Bruk Node.js-versjonen i `.nvmrc`, kjør `npm ci` og `npm run dev`.
Hold PR-er små og beskriv problemet, endringen og hvordan den er kontrollert.
Kjør `npm run typecheck`, `npm test` og `npm run build`.
Ved endringer i dokumentbehandling, personvern eller brukerflyt: installer Chromium med
`npx playwright install chromium` og kjør `npm run test:e2e`.
Legg til relevante regresjonstester ved feilrettinger.

## Dokumenter og sikkerhet

Bruk bare syntetiske testfiler. Ikke legg ved legitimasjon, personopplysninger, passord,
API-nøkler eller ekte brukerdokumenter i issues, PR-er, skjermbilder eller logger.
Rapporter sårbarheter privat som beskrevet i [SECURITY.md](SECURITY.md).
Endringer må ivareta lokal dokumentbehandling, permanent sladding og eksplisitte feil ved
ufullstendig rendering. Nye nettverkskall og avhengigheter må begrunnes.

Bidrag leveres under prosjektets [MIT-lisens](LICENSE). Vis hensyn og hold diskusjoner saklige.
