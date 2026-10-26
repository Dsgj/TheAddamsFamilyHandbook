# PR- och CodeQL-granskning 2026-10-26

## Omfattning

Öppna PRs vid start: #5 och #7–#13. Ingen av dem hade olösta inline-kommentarer eller inskickade reviews.
Samla kompatibla uppdateringar i en verifierad integrations-PR för att undvika åtta fulla CI-körningar
och upprepade uppdateringar av basbranchen. Stäng ursprungs-PR:erna som ersatta när integrationen är mergad.

| PR                   | Hantering                                                             |
| -------------------- | --------------------------------------------------------------------- |
| #5 Pillow 13         | Redan införd av #6; inga nya ändringar behövs.                        |
| #7 Docker            | Nya digest-pins för Node 24 och nginx. Behåll Node-majoren.           |
| #8 Python            | NumPy 2.5.4 och Markdown 3.11.2.                                      |
| #9 Actions           | Uppdaterade commit-pins för setup-node samt upload/download-artifact. |
| #10 npm-grupp        | Uppdatera gruppen, med undantaget Astro nedan.                        |
| #11 Astro-formatter  | Uppdatera till 1.1.2 och anpassa formatering.                         |
| #12 Svelte-formatter | Uppdatera till 4.1.1 och anpassa formatering.                         |
| #13 ESLint           | Uppdatera till 10.13.0 och verifiera befintliga lintregler.           |

## Kompatibilitetsbeslut

Astro 7.4.2 gav oanvända CSS-filer och fick den befintliga artefaktkontrollen att fallera, både i
ursprungs-PR:ens CI och lokalt. Behåll Astro **7.3.4**, lås den versionen och ignorera specifikt
7.4.2 i Dependabot. En senare version ska utvärderas mot samma kontroller; ta inte bort budgetar
eller ge oanvända filer en generell dispens för att få uppdateringen grön.

Den nyare axe-versionen hittar etiketter där synlig text inte ingår sammanhängande i det tillgängliga namnet.
Sidväljarens namn ändras till "Go to page 97 of 124" utan parenteser. Kartans räknade lagerknappar
namnges med den synliga etiketten och antalet först; solenoidlagret behåller upplysningen om flashers.
Uppdatera den explicita etikettförväntningen i handbokstestet. Inga axe-regler stängs av.

@vite-pwa/astro 1.2.0 har fortfarande ett peer-intervall som slutar vid Astro 5; det är ett befintligt
upstream-intervall och senaste paketversionen vid granskningen. Dölj inte varningen med en falsk
kompatibilitetsdeklaration. Verifiera den använda kombinationen med bygge, PWA- och offline-tester.

## CodeQL-baslinje

Baslinjen innehöll 22 öppna fynd. Inga analysregler eller skannade sökvägar undantas.

Python-fixarna dokumenteras separat i tools/local-patches.json med ursprunglig och ändrad checksumma.
Den ursprungliga sync-manifesten ändras inte. Kit-testet verifierar de granskade verktygspatcharna
samt fortsatt byte-identisk data, manualtext och bilder. Synkskriptet får inte skriva över lokala patchar.

| Fynd    | Bedömning och åtgärd                                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1      | Ta bort oanvänd json-import i assemble.py.                                                                                                                                                                                                           |
| #2–#14  | Stäng Python-filhandtag med context managers vid läsning och skrivning. Stäng även Pillow-bilder efter användning.                                                                                                                                   |
| #15     | Gör testets script-taggmatchning oberoende av skiftläge.                                                                                                                                                                                             |
| #16     | Falskt positivt säkerhetsfynd: icons.mjs läser det versionshanterade, genererade splash-name.svg från en fast lokal sökväg. Kommentarborttagningen är inte ett skydd för externt HTML-innehåll. Ingen användar-/nätverksindata passerar denna punkt. |
| #17     | Falskt positivt säkerhetsfynd: copy.test.ts använder kommentarborttagning för textanalys av repo-/testfiler. Resultatet renderas eller exekveras inte som HTML och funktionen är ingen HTML-sanitizer.                                               |
| #18     | Avkoda ampersand sist så att entiteter avkodas en gång. Lägg till ett regressionsfall för bokstavlig entitetstext.                                                                                                                                   |
| #19     | Ersätt testets handskrivna glob-till-regex-omvandling med Node 24:s matchesGlob.                                                                                                                                                                     |
| #20–#21 | Rätta dubbla escapes i regex-konstruktorn och behandla klassnamn som litteral text.                                                                                                                                                                  |
| #22     | Skapa scroll-dictionaryn med Object.fromEntries så att även särskilda nyckelnamn blir egna dataproperties.                                                                                                                                           |

Avsluta #16 och #17 med motiveringen "false positive" och en specifik kommentar på respektive fynd.
Om koden senare börjar hantera externt HTML-innehåll måste bedömningen göras om.
Övriga fynd ska stängas genom verifierade kodändringar, inte genom mass-dismissal.

## Leveranskontroll

Kör typkontroller, lint, formatering, samtliga enhetstester, den fulla browsermatrisen,
Pages-baspath och Docker-kontrollen. CodeQL och beroendegranskning ska vara gröna.
Behåll branchskyddet och uppdatera enbart det omdöpta check-namnet när det nya jobbet faktiskt har passerat.
Verifiera den publicerade artefakten och öppna PR-/review-/alert-listor efter merge.

CI-optimering och lokal före/efter-mätning dokumenteras i [deploygranskningen](CI-DEPLOY-REVIEW-2026-10-26.md).
Den framtida uppdelningen mellan generisk referens och maskininstanser finns i
[Claude-underlaget](MACHINE-PROFILES-CLAUDE.md); den funktionen implementeras separat.
