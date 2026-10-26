# Repogranskning 26 oktober 2026

> Historisk granskning före åtgärder. Genomförda ändringar och aktuella testresultat finns i [åtgärdsplanen](ACTION-PLAN-2026-10-26.md).

App: The Addams Family Handbook. Granskad lokal arbetskopia, inklusive tre redan befintliga ospårade WebP-bilder. Ingen applikationskod eller användarfil har ändrats.

## Bedömning och omfattning

Appen har en stark grund: statisk leverans, tydlig separation av källdata och ägarens rättningar, central lagringsmodul, återanvändbara UI-delar och omfattande tester för navigering, tillgänglighet och offlinebruk. En större omskrivning är inte motiverad av denna granskning.

Kartläggningen omfattade repots appkod, konfiguration, tester, CI, Docker, synkskript, datamodell och dokumentation. Fördjupningen fokuserade på lagring/backup, PWA, sökning, bildhantering och byggd leverans. Detta är en riskbaserad genomgång, inte en rad-för-rad-verifiering av varje fil, en visuell kontroll av alla sidor eller en verifiering av manualens alla sakuppgifter. Inga extra agenter, paketinstallationer eller externa tjänster användes.

## Prioriterade fynd

### 1. P1: Servicehistorik kan inte säkerhetskopieras när aktuella markeringar är borta

Plats: `src/components/DeviceData.svelte:28`, `:35`, `:189` och `:240`.

Komponenträknaren inkluderar endast poster med status eller anteckning. `nextStatus` behåller däremot historik när ett fel markeras som åtgärdat. Om bara sådan historik finns kvar och inga setup-/verify-poster finns, visas “Nothing saved on this device yet” och Download backup är avstängd. Clear all är också avstängd om inga Recent-/Viewed-/Reading-poster finns.

**Verifierat i Chromium:** en giltig lagrad komponent med tom status och anteckning men två historikhändelser gav både tommeddelande och avstängda backup-/rensningsknappar.

Åtgärd: räkna även historikbärande poster som sparade data. Lägg ett regressionstest på tillståndet efter att sista felet åtgärdats, samt på en importerad fil med enbart historik.

### 2. P1: Misslyckad återställning kan redan ha ändrat sparade data

Plats: `src/lib/model/backup.ts:62–72` och `src/lib/storage.ts` (`writeJson`/`put`).

Import skriver status, setup och verify i separata steg och kontrollerar resultatet efteråt. Om en skrivning lyckas och nästa misslyckas lämnas tidigare ändringar kvar. Felmeddelandet berättar inte vilka delar som faktiskt återställdes. Vid replace kan tidigare data redan ha skrivits över.

**Verifierat i Chromium:** simulerad kvotvägran för `tafh:setup`, medan `tafh:status` tilläts. UI rapporterade “This device would not save the backup”, men komponentens status och anteckning hade beständigt ändrats till importfilens värden.

Åtgärd: gör återställning transaktionell, lämpligen när M2:s IndexedDB-adapter införs. Om localStorage behålls behövs en genomtänkt återställnings-/journalstrategi och tydlig hantering av partiellt resultat; enbart rollback är inte en full garanti när även rollback kan misslyckas. Testa fel på varje skrivsteg och kontrollera data efter omladdning.

### 3. P2: Offlineladdningens färdigflagga följer inte appversionen

Plats: `src/pwa.ts:150–154`, `src/lib/storage.ts` (`SESSION_KEYS.warm`).

Sidcachen heter `tafh-pages-<build-id>`, men färdigflaggan i sessionStorage är alltid samma booleska `tafh:warm`. Efter att en version laddats klart kan nästa version i samma flik hoppa över uppvärmningen helt, eftersom sessionStorage överlever omladdning. Nytt innehåll blir då inte automatiskt tillgängligt offline enligt avsikten.

**Kodbelagt; inte testat med två riktiga driftsatta versioner.**

Åtgärd: lagra build-id som färdigvärde och kontrollera det mot aktuell build. Lägg ett test som går från version A till B med bibehållen flik/session. Granska samtidigt raderingen av andra versioners cache: en gammal, fortfarande öppen flik kan också köra `warm()` och radera en nyare versions cache.

### 4. P2: Tre lokala bilder gör nuvarande testkörning röd

Plats: `src/lib/handbook/image-size.ts:7–12`, `tests/unit/handbook.test.ts:90–92`, `tests/unit/payload.test.ts:180`.

Filerna är `20261012_135131.webp`, `20261012_135336.webp` och `20261012_135340.webp` i `public/assets/figures/`. De fanns redan som ospårade filer före granskningen och har lämnats orörda.

Storleksläsaren stöder PNG/JPEG men inte WebP. Dessutom saknar de tre bilderna referenser i den byggda appen. Det ger tre byggvarningar och två fallerande enhetstester. Bilderna kopieras ändå till `dist/`.

Åtgärd: avgör vilka sidor bilderna ska användas på; koppla in dem där och komplettera storleksläsaren med WebP-stöd. Bilder som är arbetsmaterial hör hemma utanför den publicerade `public/`-katalogen. Detta är ett problem i aktuell arbetskopia, inte bevis för att den committade versionens CI är röd.

### 5. P2: Gamla manualbilder kan leva kvar efter bildrättningar

Plats: `astro.config.ts` (`tafh-scans`, CacheFirst, 365 dagar) och `src/build/build-id.ts` (`BUILD_INPUTS.skip`).

Skanningarna har stabila filnamn, en gemensam cache över versioner och CacheFirst med ett års maxålder. De undantas också från build-id. Om en skanning rättas under samma namn kan en återkommande användare därför fortsätta få den äldre bilden trots en appuppdatering.

**Kodbelagt; inte verifierat med två driftsatta bildversioner.**

Åtgärd: använd innehållsversionerade bild-URL:er eller en separat versionsidentifierare för skanningscachen. Undvik att tömma alla redan nedladdade manualbilder vid varje liten kodändring.

## Optimeringar med rimlig nytta

- **Offlinebudget och status:** `dist/data/warm.json` innehåller 355 resurser, totalt cirka 12,8 MB okomprimerade filer i denna build. Det är inte uppmätt överföringsstorlek och inkluderar inte hela precachen eller manuella skanningsnedladdningar. Sex parallella bakgrundshämtningar är redan begränsat, och Save-Data respekteras. Visa hur mycket som återstår, erbjud återförsök och överväg valbar fullständig offlineladdning. Knyt löftet “Ready to work offline” till vilka delar som faktiskt är klara; nu kommer meddelandet från shell-installationen före siduppvärmningen.
- **Sökning:** `DiagnoseSearch.svelte` beräknar resultat i alla fyra datamängder även när en enskild grupp är vald. Filtrera bort ointressanta grupper före sökning om profilering visar märkbar kostnad. Inför inte en Web Worker eller ett nytt sökbibliotek utan mätning på ägarens telefon.
- **Importdatum:** `cleanStatus`, `cleanSetup` och `isEvent` accepterar godtyckliga datumsträngar; flera merge-/sorteringsfunktioner jämför strängar. Normalisera accepterade tidpunkter till UTC-ISO och bestäm hur ogiltiga datum hanteras. Exempelvis är lexikografisk ordning inte kronologisk ordning för ISO-strängar med olika tidszonsförskjutning. Appens egna UTC-exporter undviker normalt problemet.
- **Underhåll:** `PlayfieldMap.svelte`, `Diagnose.svelte` och `PageViewer.svelte` är de största UI-filerna. Flytta ut avgränsad interaktionslogik när den ändå behöver ändras. Dela inte upp fungerande kod enbart för att minska radantalet.
- **CI-resurser:** ett gemensamt grundbygge återanvänds redan av enhets- och webbläsartester. Behåll det. Vid växande CI-kostnad: mät jobbtider först, lägg snabba kontroller tidigt och överväg en mindre PR-matris med full kontroll inför publicering. Bevara kontrollen av Pages-baspath och offline-/lagringsbeteende.

## Funktioner som är värda att lägga till

1. **Lokal servicejournal med foton:** fortsätt den befintliga M2-planen med IndexedDB, datamigrering och backup som även omfattar bilagorna. Detta ger tydlig nytta vid maskinen och en naturlig plats för transaktionell import.
2. **Backupstatus:** visa senaste skapade backup och om data ändrats sedan dess. En filnedladdning bevisar dock inte att användaren har sparat eller flyttat filen säkert.
3. **Offlineöversikt:** skilj på appskal, handbok och hämtade manualbilder; visa återstående nedladdning och återförsök. Det gör appens viktigaste löfte lättare att kontrollera.
4. **Dataverifiering:** följ upp de redan dokumenterade osäkerheterna i `kit-docs/KNOWN-ISSUES.md`, särskilt okontrollerade transkriptioner och komponentuppgifter. Detta kan ha större praktisk nytta än ytterligare UI-funktioner. Manualuppgifterna har inte faktagranskats här.

## Verifiering

| Kontroll                                              | Utfall                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`                                          | Passerar; tre varningar om WebP-bildernas storlek                                                                                      |
| `pnpm check`                                          | Passerar; 0 diagnostikfel/varningar                                                                                                    |
| `pnpm svelte-check`                                   | Passerar; 0 fel/varningar                                                                                                              |
| `pnpm lint`                                           | Passerar                                                                                                                               |
| `pnpm format:check`                                   | Passerar före rapporten skapades                                                                                                       |
| `pnpm test`                                           | 539 passerar, 2 fallerar; 42 testfiler passerar, 2 fallerar                                                                            |
| Playwright smoke + storage, phone-dark, två workers   | Alla 41 testfall rapporterade godkänt; processen fastnade vid avslut och stoppades manuellt, så körningen fick ingen normal slutstatus |
| Riktad Chromium-kontroll: enbart historik             | Fel reproducerat                                                                                                                       |
| Riktad Chromium-kontroll: partiell import vid kvotfel | Fel reproducerat                                                                                                                       |

Fullständig Playwright-matris, Dockerbygge, beroendesårbarhetsskanning, tvåversionsuppdatering och fysisk iPhone-kontroll kördes inte. Inga påståenden görs om att dessa passerar.

## Rekommenderad arbetsordning

Rätta historik/backup först, därefter partiell import och versionshantering för offlinecachen. Hantera bildfilerna inför nästa gröna leverans. Fortsätt sedan M2 och offlineöversikten. Gör ytterligare prestandaarbete först när en mätning på måltelefonen visar ett verkligt problem.
