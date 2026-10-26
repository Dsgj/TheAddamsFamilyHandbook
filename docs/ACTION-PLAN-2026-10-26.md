# Gemensam åtgärdsplan för Codex

Utgångspunkt: REPO-REVIEW-2026-10-26.md och UX-REVIEW-2026-10-26.md.

## Genomförande

Ett repo, en skrivande agent och inga nya runtimeberoenden. Återanvänd befintlig lagringsadapter, guidekomponent, design tokens och tester. Ändra inte synkade manualtexter eller obekräftade maskinuppgifter. Kör riktade regressionstester under arbetet och ett gemensamt slutbygge för bred verifiering.

| Steg | Leverans                                                                                                                      | Verifiering                                             | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| 1    | Historik räknas som data; atomisk backupimport med bibehållna äldre data; validerade importdatum med jämförelse i tidsordning | Lagrings-/importtester och webbläsare inklusive kvotfel | Klart  |
| 2    | Versionsbunden offlineflagga, isolerade sidcacher, skanningsversion och tydlig nedladdningsstatus/återförsök                  | Cachetester och PWA-flöde                               | Klart  |
| 3    | WebP-storlekar; oanvänt bildmaterial bevaras utanför publicerad katalog                                                       | Bild-/payloadtester                                     | Klart  |
| 4    | Tydliga setuphandlingar, stegöversikt och fortsätt-länk, återkommande skötsel med Done today, bekvämare läsning               | Guideflöden, tangentbord, mobil och dator               | Klart  |
| 5    | Synlig kartlegend, precisa texter för listan, backup och installation samt dokumenttyper                                      | Riktade UX-/tillgänglighetstester                       | Klart  |
| 6    | Slutgranskning, bygge, typkontroller, lint, format, enhetstester och relevant webbläsarurval                                  | Utfall dokumenteras här                                 | Klart  |

## Medvetna avgränsningar

M2 med fotobilagor, ny fristående inköpsmodell och full interaktiv demonteringsguide är egna funktionsprojekt med större datamigrering och innehållsarbete. Den här åtgärdsomgången löser identifierade fel och förbättrar befintliga flöden; den inför inte dessa nya produktområden. Ändra inte CI-matrisen eller sökmotorns arkitektur utan mätbar flaskhals. Verklig användarprovning och faktakontroll vid den fysiska maskinen kräver ägarens deltagande och redovisas som manuella uppföljningar.

## Resultat

Genomfört och verifierat enligt nedan. Aktuell leveransstatus framgår av Git-historiken och GitHub Actions.

- Historikbärande poster håller backup och rensning tillgängliga även när sista felmarkeringen är borta.
- Import sparar alla backupsektioner och reset-räknare i en enda atomisk localStorage-post. Före första import läses äldre nycklar som tidigare; efter import är den gemensamma posten auktoritativ och äldre nycklar speglas när det går. Ett kvotfel vid huvudskrivningen ändrar inga importerade data. En misslyckad spegelskrivning gör inte den beständiga återställningen partiell. Testat efter omladdning och mellan öppna flikar med den nya versionen.
- Giltiga datum bevarar sitt format för bakåtkompatibilitet men jämförs kronologiskt, inklusive tidszonsförskjutningar. Ogiltiga historikdatum släpps och ogiltiga postdatum får epokens tidpunkt.
- Offlineflaggan är bunden till build-id. Gamla dokument tar inte bort andra versioners sidcacher. Skanningscachen har en egen innehållsversion så att en bildrättning ändrar den utan att varje UI-ändring gör det.
- Workshop visar pågående, färdig, ofullständig eller Save-Data-pausad sidnedladdning och erbjuder manuell nedladdning/återförsök. Texten skiljer appskal och sparade sidor från manualbilder som sparas när de öppnas.
- WebP-stöd omfattar lossy, lossless och extended headers. De tre oanvända originalbilderna finns oförändrade i `docs/reference-photos/` och publiceras inte.
- Guiderna har stegöversikt, fortsätt till första ofärdiga uppgiften och valbar döljning av redan avslutade steg. En nyss avklarad uppgift döljs inte automatiskt under tangentbordsfokus. Presetåtgärder har inga missvisande Install-värdefält. Alternativ ligger under Other options, längre förklaringar är större och vanliga värdefält är smalare på dator.
- Care har Done today för en ny utförd omgång utan att först avmarkera. Varningarna är uppdelade utan att deras innehåll tagits bort.
- Kartan har en valbar synlig lagerlegend och användningshjälp. Inköpsknappen beskriver att komponenten markeras Fault. Backuptexter och länkar är konsekventa. Handboken förklarar dokumenttyperna och har en liten ordlista. Grundtemat är bevarat.

### Verifierat

| Kontroll                                                                       | Resultat                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bygge                                                                          | Passerar, 353 sidor, inga bildstorleksvarningar                                                                                                   |
| Astro/TypeScript                                                               | 0 fel, 0 varningar                                                                                                                                |
| Svelte                                                                         | 0 fel, 0 varningar                                                                                                                                |
| ESLint, Prettier, git diff --check                                             | Passerar                                                                                                                                          |
| Enhetstester                                                                   | 549 av 549 passerar i 45 testfiler                                                                                                                |
| Mobil Chromium: smoke, storage, setup, care, tables, hubs och nya regressioner | 75 passerar; ett datorspecifikt test överhoppat enligt befintlig testregel                                                                        |
| Dator Chromium: PWA och nya regressioner                                       | 26 av 26 passerar                                                                                                                                 |
| Mobil WebKit: smoke, setup, care och nya regressioner                          | 21 av 21 passerar                                                                                                                                 |
| Kontrollnamn och utskrift i setup                                              | 2 av 2 passerar                                                                                                                                   |
| Import och efterföljande redigering mellan flikar, alla tre projekt            | 3 av 3 passerar                                                                                                                                   |
| Smal guide på 320 px, samtliga tre projekt                                     | 3 av 3 passerar efter rättad radbrytning; omkörning av guidetestet ovan                                                                           |
| Axe på setup, care, workshop, handbook och öppnad mobil kartlegend             | Inga avvikelser i tio sid-/temakontroller totalt                                                                                                  |
| Visuell kontroll                                                               | Mobil mörk och dator ljus; kartlegendens layoutfel rättat; ingen horisontell sidskroll på setup/care/workshop/handbook vid 320, 390 eller 1440 px |

De slutliga webbläsarurvalen avslutades normalt med exitkod 0. För att undvika Windows-problemet med Playwrights serveravslut startades preview separat. En mellanliggande testkörning kolliderade med en annan körnings trace-katalog; samma urval kördes om separat och passerade. Inga testregler undantogs för att dölja felet. Testkörningar som startade före ett ombygges avslut avvisades av repots befintliga dist-skydd och kördes om efter avslutat bygge.

### Begränsningar och uppföljning

- Andra versioners sidcacher behålls för öppna flikars skull och kan ta mer utrymme tills webbläsaren rensar dem. Fullständig cachehantering och skanningsöversikt är fortsatt utveckling.
- Två olika appversioner som samtidigt skriver data har inte kompatibilitetstestats. Flikarna bör använda den uppdaterade versionen inför återställning. Backupfilens format är oförändrat. Den fysiska iPhonens releasecheck i README återstår.
- Fullständig CI-matris, Docker och nytt Pages-bygge under subpath har inte körts lokalt. Befintlig CI innehåller dessa kontroller.
- Senaste-backup-status, fotobilagor/M2, fristående beställningsbehov, interaktiv A8-arbetsvy och eventuell sökoptimering är fortsatt produktarbete. Förslagen är inte markerade som genomförda i denna omgång.
- Genomför de fem användaruppgifterna från UX-granskningen med två eller tre personer. Kontroll av maskinuppgifter och obekräftade manualtranskriptioner kräver jämförelse med maskinen/källbilderna.
