# Uppdrag till Claude: generisk app och separata maskinprofiler

Status: implementationsunderlag, inte implementerad funktion. Läs AGENTS.md och repo-review före ändringar.

## Mål

Den publika appen ska vara en generisk referens för Bally The Addams Family (1992).
En namngiven maskinprofil ska beskriva ett enskilt spels installerade delar, modifieringar och servicehistorik.
Samma appversion ska kunna användas på GitHub Pages och i flera Docker-instanser utan separata kodforkar.

Ägaren vill kunna välja original/OEM eller eftermarknadsdelar med enkla kontroller.
Valet ska påverka relevant innehåll i guider, diagnos, komponentvyer och inköpslistor.
Användarens maskinval får aldrig skrivas tillbaka till den generiska referensdatan.

## Vad Docker gör i dag

- Dockerfile bygger en statisk Astro-app och serverar filerna via nginx.
- docker-compose.yml publicerar den på port 8080. Ingen aktiv databas eller skrivande API-tjänst finns.
- State ligger i användarens webbläsare via src/lib/storage.ts, inte i containern.
- En Docker-volym till nginx gör därför inte anteckningar och checklistor delade mellan enheter.
- Två webbläsare som öppnar samma instans har fortfarande separata lokala data.

Docker lämpar sig för självhosting hemma eller på en extern server, och för att tillhandahålla en
maskinspecifik standardprofil. Serverlagring och synk är en separat funktion som ska beslutas separat.
Aktivera inte den kommenterade PocketBase-tjänsten som en del av detta uppdrag.

## Nuvarande kopplingar att reda ut

- src/data/installedLeds.ts innehåller en specifik maskins Super Brite Kit och flashers.
- src/build/kit-plugin.ts lägger in INSTALLED_LEDS i komponentmodellen redan vid byggtid.
- src/data/ownerNotes.ts innehåller både referensrättelser och ägarspecifika observationer.
- src/data/setup.ts, src/data/verify.ts och handbokens appendix innehåller ytterligare maskinantaganden.
- src/data/kit ska fortsätta vara källdata med stabila komponent-ID:n.

Klassificera varje uppgift som OEM-referens, verifierad generell rättelse, produktspecifik information
eller observation om en viss maskin. Flytta inte alla ägarnoteringar till generisk OEM-data utan granskning.
Den publika appen får inte påstå att ett visst LED-kit eller kretskort sitter i alla spel.

## Arkitektur och datamodell

1. **Referensdata:** originalspecifikation, källhänvisningar och verifierade rättelser.
2. **Variantkatalog:** dokumenterade eftermarknadsprodukter, kompatibilitet och variantberoende innehåll.
3. **Maskinprofil:** stabilt id, visningsnamn, schemaVersion och val per del/system.
4. **Servicedata:** anteckningar, status, checklistor och historik, kopplade till profilens id.

Inför en gemensam funktion som härleder vad som gäller för aktiv profil. Komponenter och guider ska
använda samma härledning; sprid inte fristående LED-/LCD-villkor genom hela appen.
Bevara originalspecifikationen så att användaren kan jämföra med OEM även när en variant är vald.

Varje relevant system behöver minst `unknown`, `original` och `aftermarket` som installationsstatus.
`unknown` är viktigt: en generell OEM-referens är inte en inspektion av användarens faktiska maskin.
Eftermarknadsval ska kunna ange produkt/variant, modell, verifieringsstatus, källa och eventuell
installationsanteckning. Produktdetaljer ska vara valfria tills de faktiskt är kända.

Håll isär åtminstone:

- Individuella lampor i lampmatrisen, GI och flashers. En maskin kan ha blandade glöd-/LED-lampor.
- Original DMD, LED-baserad DMD och LCD-lösning, inklusive eventuell styrkort-/adaptervariant.
- CPU-, power/driver-, ljud-, display- och övriga kretskort, med modell och revision där det behövs.
- En utbytt OEM-kompatibel kortrevision och en produkt som ändrar funktion eller anslutningar.

En global knapp "LED installerat" får bara vara en genväg till ett uttryckligt dokumenterat paket.
Den ska visa vilka delval som ändras, bevara individuella avvikelser och kunna återställas.
Anta inte att alla eftermarknadsdelar använder samma säkringar, spänningar, kopplingar eller felsökningssteg.
Ange kompatibilitet från manual/tillverkardokumentation och markera sådant som saknar verifierad instruktion.
Originalmanualen ska finnas kvar som källa; byt de relevanta instruktionerna, inte hela handboken godtyckligt.

## Användarresa

Lägg "Din maskin" i Workshop med ett synligt namn för aktiv profil och val att skapa, byta och exportera profil.
Visa tydligt skillnaden mellan "OEM-referens" och "Installerat i din maskin".
Använd val för "Okänt / Original / Eftermarknad" och visa produktväljare först när det behövs.
En vanlig av/på-switch räcker för ett entydigt modifieringsval, men inte för tre tillstånd eller flera produkter.
Följ befintligt tema, tangentbordsstöd, fokus och skärmläsarnamn. Ge en kort förklaring av vad varje val ändrar.

Ett profilbyte ska omedelbart uppdatera berörda komponenter, guider, diagnos och inköpsförslag.
Valda installationer får inte framstå som verifierade om användaren bara provat ett alternativ.
Erbjud återställning per system utan att radera anteckningar eller andra profiler.

## GitHub Pages och Docker

GitHub Pages ska kunna köra appen utan server, konfigurationsfil eller konto. Personliga profiler sparas lokalt.
Separata Docker-instanser ska kunna ha en standardprofil via en **read-only runtime-konfiguration**, till
exempel en monterad JSON-fil. Samma image ska kunna användas för flera maskiner utan ombyggnad.
En miljövariabel till nginx ändrar inte automatiskt en redan byggd frontend; lös konfigurationsinläsningen uttryckligt.

Standardprofilen från servern och användarens lokala ändringar ska hållas isär. Dokumentera konfliktregler och
visa när lokal profil avviker från instansens standard. En konfigurationsfil som serveras till webbläsaren är offentlig:
lägg inga hemligheter eller privata serviceanteckningar i den.

Nycklar i browserlagringen ska inkludera profil-id även om flera profiler delar origin.
Bestäm hur instans-id och profilrevision påverkar service worker och cache. Gamla cacheposter får inte blanda
en annan maskins profil med aktuellt innehåll. Spara senast giltiga profil för offlinebruk och hantera saknad,
trasig eller inkompatibel runtime-konfiguration med ett begripligt reservläge.

Delad, beständig servicedata mellan telefon och dator kräver en separat skrivande backend med lagring,
åtkomstskydd och backup. Beskriv det som en senare etapp; implementera inte en halv synklösning i denna etapp.

## Migration och arbetsordning

1. Kartlägg hårdkodade maskinantaganden och deras källor. Skriv ner oklara uppgifter.
2. Definiera och validera profiler/varianter samt en gemensam härledning. Börja med belysning och display.
3. Extrahera den nuvarande maskinens kända installationer till en separat profil. Låt den generiska appen visa
   OEM-referensen utan att förlora ägarens information eller hävda att alla installationer är kända.
4. Inför profilval och koppla om berörda vyer. Hantera även förgenererad HTML så att den inte visar en annan
   maskins installation innan klientkoden startat. OEM-referens kan visas under inläsning, tydligt märkt.
5. Migrera nuvarande browserdata utan att skriva över den. Äldre data utan profil-id ska kunna knytas till
   "Befintlig maskin". Anpassa backupformat med versionering och import av tidigare exporter.
6. Lägg till runtime-konfiguration för Docker samt exempel på två instanser med olika profiler.
7. Dokumentera det som återstår för eventuell serverlagring/synk separat.

## Acceptans och verifiering

- Publik standardvisning påstår inte att ägarens LED-kit, LCD eller kretskort är installerat generellt.
- En profil med blandade lampor visar rätt OEM-referens och valt ersättningsförslag för varje relevant del.
- Display-/kortval ändrar bara dokumenterat relevant innehåll. Saknad variantinformation syns tydligt.
- Två profiler på samma origin delar inte servicedata av misstag.
- Äldre status, anteckningar och backupfiler går att migrera/importera utan förlust.
- Två Docker-instanser använder samma image men olika runtime-profiler.
- Saknad/felaktig konfiguration och offline-start fungerar med ett tydligt reservläge.
- Val och profilbyte fungerar med tangentbord, skärmläsare och appens befintliga teman.
- Kör berörda enhetstester, pnpm check, pnpm svelte-check, pnpm lint och pnpm build.
- Lägg fokuserade E2E-fall för OEM, blandad profil, eftermarknad, profilbyte, migration och offlinebruk.
  Återanvänd fixturer; kör inte alla varianter över alla sidor och webbläsare utan ett tydligt täckningsbehov.

Leverera en PR med datamodell, migrationsbeskrivning, konfigurationsexempel och verifieringsresultat.
Redovisa produkt-/maskinuppgifter som fortfarande saknar källstöd. Inför ingen AI-tjänst eller API-nyckel i appen.
