# Kapsejladsapp MVP

Lokal-first webapp til kapsejladsledere og dommere. MVP'en kan oprette løb, håndtere flere starter/klasser, afvikle 5-minutters startprocedure med lyd, registrere målgang via kø og beregne foreløbige korrigerede tider.

## Start lokalt

På en anden computer: installer Node.js 24 eller nyere, pak projektet ud og kør fra projektmappen:

```powershell
node server/index.mjs
```

Åbn derefter:

```text
http://localhost:4173
```

Denne workspace har ikke en fungerende `npm` på PATH, så MVP'en er lavet uden eksterne runtime-afhængigheder og kan køres direkte med Node 24.

```powershell
& "C:\Users\n1htll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server/index.mjs
```

Hvis du har Node 24 installeret normalt, virker dette også:

```powershell
node server/index.mjs
```

Databasen oprettes automatisk som `data/kapsejlads.sqlite`, og seed data med dagens løb og 8 både lægges ind første gang.

## Test online via GitHub Pages (ingen server)

`npm run build:pages` bygger en statisk version i `dist/`, hvor SQLite kører i browseren (sql.js/WebAssembly) med præcis samme API- og databasekode som serveren. Hver tester får sin egen testdatabase med seed-data, gemt i browserens `localStorage`: data overlever reload og deles mellem faner i samme browser (fx ekstern startskærm), men deles ikke mellem personer eller enheder. Tilføj `?reset` til URL'en for at nulstille til seed-data.

Opsætning (én gang): GitHub → *Settings → Pages → Source: GitHub Actions*. Workflowet `.github/workflows/pages.yml` deployer ved push til `main` og kan også startes manuelt. Adressen bliver `https://<bruger>.github.io/sejl/`.

Begrænsninger i Pages-versionen: WebSejler-opslag virker sandsynligvis ikke pga. CORS (brug manuel indtastning), og data er lokale pr. browser.

## Delt server (valgfrit)

Hvis testerne skal dele data, kan Node-versionen hostes med `Dockerfile` + `render.yaml` (Render gratis plan). Litestream kopierer SQLite-databasen til Cloudflare R2 (gratis), så data overlever genstart:

1. Cloudflare R2: opret bucket og API-token (Object Read & Write); notér Access Key ID, Secret og S3-endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
2. Render: *New → Blueprint* → vælg repoet, og udfyld `LITESTREAM_BUCKET`, `LITESTREAM_ENDPOINT`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`.

Uden `LITESTREAM_*` kører appen uden persistens. Andre variabler: `PORT` (default 4173), `DATA_DIR` (default `./data`).

## Deling (ZIP)

Appen bruger en lokal Node/SQLite-backend, så den kan ikke køre fuldt på GitHub Pages alene. Til demo er den letteste deling en ZIP af projektet. Modtageren pakker ZIP'en ud, installerer Node.js 24+ og starter appen med `node server/index.mjs`.

ZIP-pakken bør ikke indeholde `data/kapsejlads.sqlite`, medmindre du vil dele dine konkrete testdata. Uden databasen opretter appen en frisk lokal SQLite-database med seed-data første gang den startes.

## Test

```powershell
& "C:\Users\n1htll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests/run-tests.mjs
```

Browser-smoke-testen bruger lokal Chrome:

```powershell
& "C:\Users\n1htll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tests/browser-smoke.mjs
```

## Brug

1. Gå til **Dashboard** og vælg dagens event/start.
2. Brug **Løb** til at oprette eller redigere kapsejlads og starter.
3. Brug **Både** til at tilføje deltagere manuelt eller prøve WebSejler-opslag med certifikatnummer/URL.
4. Brug **Start** til 5-minutters nedtælling. Appen viser fase, næste signal, klasse og aktive signalflag.
5. Brug **Målgang** til at sætte både i forventet rækkefølge og trykke den store målgangsknap, når øverste båd passerer linjen.
6. Brug **Resultater** til sejlet tid, måltal/TCC og foreløbig korrigeret tid.

## Ekstern startskærm

På **Start** kan du trykke **Åbn ekstern startskærm**. Det åbner `/display.html?startId=...` i en ny fane eller et nyt vindue, som kan trækkes over på en sekundær skærm og sættes i fuld skærm.

Skærmen følger den valgte starts countdown via backend/SQLite og viser stor nedtælling, fase, næste signal og signalflag. MVP'en bruger standard 5-minutters logik: valgfri klassestander eller talstander op ved 5:00, P-flag op ved 4:00, P-flag ned ved 1:00 og startstanderen ned ved start.

Når et event/løb oprettes, kan første startgruppe vælge **Klassestander** eller **Talstander 1-9**. Der er 10 indbyggede klassestandere, og valget vises som preview på opret-siden. Selve flagfladen vises uden tekst; navnet står kun som caption under flaget i appen.

Under **Indstillinger** kan egne klassestandere uploades som PNG/JPG/SVG/WebP. De gemmes lokalt i SQLite og bliver derefter tilgængelige i stander-vælgeren.

På **Løb** kan det valgte event/løb slettes med **Slet løb**. Handlingen kræver bekræftelse og fjerner eventet med tilhørende starter, både, mål og resultater.

## Bluetooth og lyd

Webapps kan normalt ikke parre eller vælge Bluetooth-højttalere direkte. Forbind højttaleren i operativsystemet eller browseren først, og tryk derefter **Lydtest** i appen.

Hvis browseren understøtter `HTMLMediaElement.setSinkId`, viser appen en lydudgangsvælger under **Indstillinger**. På mange mobile browsere er valget låst til enhedens aktuelle lydudgang.

Under **Indstillinger** kan signallyden vælges mellem **Elektronisk**, **Tågehorn** og **Skibsklokke**. Brug **Lydtest** efter skift, så lydstyrke og højttaler kan tjekkes før startproceduren.

**Party Mode** kan også slås til/fra under **Indstillinger**. Når den er slået til, vises konfetti når White Beam / certifikat 35114 registreres i mål.

## WebSejler

MVP'en har en isoleret WebSejler-adapter i `server/websejlerAdapter.mjs`.

- Input: sejlnummer, bådnavn, certifikatnummer eller certifikat-URL.
- Første understøttede format: offentlige certifikatsider som `https://websejler.dk/da/certifikat/35114`.
- Hvis hentning eller parsing fejler, viser appen manuel indtastning med samme felter.
- Normaliserede felter gemmes sammen med rå kildeuddrag, så integrationen kan forbedres uden at ændre resten af appen.

Der blev ikke fundet officiel REST/JSON API-dokumentation for WebSejler i planfasen. Derfor bør scraping/parsing valideres mod WebSejlers vilkår, før det bruges i drift.

## DH-formel og placeholder

Beregning ligger i `shared/calculations.mjs`.

MVP:

- Sejlet tid = målgangstid minus faktisk starttid.
- Foreløbig korrigeret tid = sejlet tid * `TCC`, hvis TCC findes.
- Ellers bruges en tydeligt markeret placeholder baseret på indtastet måltal.

Den korrekte danske DH-formel skal indsættes og valideres i `calculateCorrectedSeconds`.

## Kendte begrænsninger

- Frontend er en dependency-free SPA for at kunne køre i dette workspace uden `npm`; `package.json` markerer React/Express/Prisma som planlagte afhængigheder for næste iteration.
- WebSejler-parseren er defensiv, men ikke en officiel integration.
- Ingen brugerlogin eller rollemodel.
- Ingen PWA/offline cache ud over lokal SQLite.
- Ingen eksport til CSV/PDF endnu.
- Resultatberegning er foreløbig og skal valideres mod gældende DH-regler.
