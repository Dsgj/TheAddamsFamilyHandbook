# Deploy och E2E: granskning 2026-10-26

## Utgångsläge

Flödet återanvänder redan ett grundbygge, installerar bara rätt webbläsare per jobb och har
omfattande kontroller för typning, kodstil, tillgänglighet, overflow, offlinebruk och länkar.
Docker och GitHub Pages har egna kontroller av baspath. Behåll dessa kvalitetsgränser.

Huvudkörning 40311390701 var grön, men E2E-jobben tog cirka 5:58 (mobil Chromium),
6:42 (desktop Chromium) och 14:21 (mobil WebKit), inklusive förberedelser.
Browserinstallation har i en tidigare PR tagit drygt 13 minuter i ett enda jobb.

JSON-rapporter från grön körning 40311903296 visar att de breda UI-svepen är dyrast:
WebKit lade ungefär 263 s på a11y.spec.ts, 224 s på layout-overflow.spec.ts och 164 s på axe.spec.ts.
Det är summerad testtid; parallella tester överlappar. Körningarna är baslinjer, inte en garanti om framtida tider.

## Ändringar

- Kör check, svelte-check, lint och formatering i build-jobbet före byggandet.
  Alla dyrare jobb väntar på detta jobb, så ett typ-/lintfel startar inte browserinstallationer och extra byggen.
- Enhetstester och befintliga artefaktbudgetar använder fortfarande samma grundbygge.
  Jobbet heter nu "unit tests and artifact checks"; motsvarande obligatoriska branchkontroll måste uppdateras.
- Sätt tidsgränser på alla jobb och på browserinstallationer. Fel och timeout förblir fel; inga kontroller ignoreras.
- Spara inte checkout-credentials i arbetskopiorna.
- Separera UI-svep från service workerns stora offlineladdning. De uttryckliga PWA-/offline- och
  navigationstesterna behåller riktig service worker. Inga rutter, assertions eller browserprojekt tas bort.
- Visa de långsammaste testfilerna och tid inklusive försök i jobbens befintliga sammanfattning.
- Spela i CI in trace vid första omkörningen i stället för för varje lyckat test. Behåll
  skärmbilder vid fel. Lokala körningar utan omkörningar behåller trace vid första felet.
- Stämpla det färdigtestade Pages-bygget med commit och SHA-256 för centrala sidor, PWA-filer och genererad JS/CSS.
  Efter publicering kontrolleras de faktiska filerna via Pages-URL:en samt att en okänd route ger HTTP 404.
  Kontrollen behöver varken pnpm-installation eller ett nytt bygge och väntar begränsat på CDN-uppdatering.

En misslyckad kontroll efter publicering gör deployment-jobbet rött. Den gör ingen automatisk rollback:
den redan publicerade sidan behöver då bedömas och vid behov ersättas genom en ny verifierad deployment.

## Resursval och fortsatt arbete

En lokal A/B-mätning av samma 38 axe-fall i WebKit med samma bygge och två workers gav
78,1 s före och 43,0 s efter att service workern stängdes av i UI-sviten. Alla 38 passerade i båda
körningarna. Detta är en enskild lokal mätning av just den sviten, inte en uppmätt minskning av hela CI-tiden.

Full browsermatris och tillgänglighetstäckning behålls. Varken dubblerade shards, större workers-pool,
generellt avstängda PWA-tester eller en extra Lighthouse-svit läggs till utan mätning.
Browsercache är inte förstahandsval: Playwright avråder generellt från det och Linux systemberoenden
måste ändå installeras. Se [Playwright CI](https://playwright.dev/docs/ci#caching-browsers).

Nästa beslut ska utgå från de nya jobbsammanfattningarna. Om tiden fortfarande är för hög:
undersök långa loopar av verkliga tangenttryckningar, ytterligare onödiga sidladdningar och eventuell
delning av den långsammaste sviten. Redovisa både väggtid, runner-tid och eventuell täckningsförändring.
Ett mindre PR-urval med full releasekontroll kräver en uttrycklig täckningsmodell; använd inte godtyckliga skips.

## Uppföljning: kombinera sidkontroller

Den slutliga main-körningen 40345653675 tog 36 s för enhetstestjobbet inklusive installation.
Browserjobben tog cirka 6,5–14 minuter inklusive installation. Antalet enhetstester är därför
inte den huvudsakliga kostnaden. Även långsamma Ubuntu-paketinstallationer har orsakat väntan
och timeout; färre assertions löser inte den delen.

Sidornas standardbredd, axe och 44 px klickytor laddade samma 32 rutter var för sig.
Axe och klickytor laddade dessutom samma fem interaktiva tillstånd separat. Nu körs dessa
kontroller i namngivna test.step på en gemensam sidladdning per rutt/tillstånd i axe.spec.ts.
Bredd mäts först, sedan axe, och sist klickytor eftersom den mätningen scrollar sidan.
Varje rutt och tillstånd har fortsatt ett eget isolerat browser context.

- Dessa svep går från 111 till 42 testfall per projekt, inklusive fem separata resultatbredder.
- Det tar bort 69 separata sidladdningar/context per projekt, totalt 207 över tre projekt.
- De tre berörda filerna går från 966 till 759 deklarerade testfall. Samtliga ursprungliga
  rutter, tillstånd, assertions, klickyteundantag och webbläsarprojekt behålls.
- Smala bredder, tangentbord, historik, lagring och PWA/offline behåller sina egna tester.
  De kräver andra förutsättningar och ska inte dela förändrad state mellan tester.

Lokalt passerade baslinjens 111 WebKit-fall och därefter alla 126 berörda fall över tre projekt.
Baslinjens lokala serveravslut behövde avbrytas manuellt efter testkörningen, så dess väggtid
används inte som jämförbar prestandamätning. Redovisa inte färre testfall som en uppmätt
procentuell minskning av hela CI-tiden. Arbete har också flyttats från a11y.spec.ts och
layout-overflow.spec.ts till axe.spec.ts; jämför svepens sammanlagda tid, inte bara en fil.

## Maskinspecifika instanser

Framtida generisk OEM-referens, maskinprofiler och Docker-konfiguration beskrivs i
[uppdraget till Claude](MACHINE-PROFILES-CLAUDE.md). Detta deployarbete implementerar inte den arkitekturändringen.
