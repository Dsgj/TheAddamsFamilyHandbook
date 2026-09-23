# Kunskapsbank: Bally The Addams Family (WPC, 1992)

Innehåll till appen. Allt märkt **[manual]** kommer från ägarens manualer (sidhänvisning anges). Allt märkt **[erfarenhet]** är allmän WPC-kunskap som inte står i manualen och ska visas som sådan i appen. Texten är skriven för att kunna användas rakt av i gränssnittet.

---

## 1. Så hänger maskinen ihop

**Kort i backboxen** [manual 1-46, 1-47, sektion 2]
- **CPU Board** (A-12742-20017): spel-ROM U6, RAM U8, ASIC U9, tre AA-batterier B1–B3 för CMOS-minnet, LED D19/D20/D21. Läser switchmatrisen (kolumner ut via U20, rader in via U18/U19) och de dedikerade switcharna (J205).
- **Power Driver Board** (A-12697): alla säkringar F101–F116, drivtransistorer för solenoider (Q20–Q82), lampmatris (rader Q83–Q90, kolumner Q91–Q98), GI-triacs (Q10–Q18), LED 1–7.
- **Fliptronics I** (Flipper Controller): flipperknappar (J805) och EOS-switchar (J806), driver de fyra flipperspolarna.
- **Extra Flipper Supply Board** (A-15416): matar de övre flipprarna, säkringar F901/F902.
- **WPC Audio Board** (A-12738-20017): ljud-ROM U14/U15/U18, säkringar F501/F502.
- **Dot Matrix Controller** (A-14039): displayens högspänning, säkringar F601/F602.

**Kretsar** [manual sektion 3, erfarenhet för spänningsvärdena]
- **Switchmatris** 8×8: kolumn = grön-X tråd från J206, rad = vit-X tråd till J208. Varje switch har en 1N4148-diod. Switchnummer = kolumn·10 + rad (32 = kolumn 3, rad 2). Flipperswitchar F1–F8 och dedikerade D1–D8 ligger utanför matrisen.
- **Lampmatris** 8×8: kolumn = gul-X (B+), rad = röd-X. Lampnummer på samma sätt. Matrisen skannas kolumn för kolumn; en LED syns på den läckström som en glödlampa inte märker (ghosting).
- **Solenoider**: 01–08 high power (50 V), 09–16 low power, 17–24 flasherkrets (20 V), 25–28 motorer/spolar på flasherdrivare. Varje spole har en diod över lindningen. Jordsidan styrs av en transistor på Power Driver; en kortsluten transistor = spolen "på" hela tiden och blir varm.
- **GI**: fem strängar 6,3 V växelström via triacs, med dimning i vissa lägen och attract mode. Största strömmen i spelet; kontakterna J120/J121 bränns med åren.
- **Magneter** (Left/Upper/Right, "The Power"): 12 V, egen 5 A trög säkring under spelplanen.

**Testmenyn** [manual 1-15 … 1-19]: Begin Test → Enter → T. Tests. T.1 Switch Edges, T.2 Switch Levels, T.3 Single Switch (Start visar tråd/kontakt/säkring), T.4 Solenoid, T.5 Flasher, T.6 GI, T.7 Sound, T.8 Single Lamp, T.9 All Lamps, T.10 Lamp & Flasher, T.11 Display, T.12 Thing (01 motor, 02 operation), T.13 Bookcase.

---

## 2. Displayens meddelanden och vad de betyder [manual 1-44, 1-45]

| Meddelande | Betyder | Första åtgärd |
|---|---|---|
| **Check Switch ##** | Switchen satt fast "på" vid start, eller har inte aktiverats på 90 bollar (30 spel). Spelet kompenserar reglerna tills den lagas. | T.1 Switch Edges med en boll. Reagerar den är det falsklarm som försvinner efter några spel. Annars guide 8. |
| **Pinball Missing** | Spelet har två bollar men hittar bara en. Boll fast någonstans, eller trough-/shooter-switch felar. | Leta bollen (Thing-lådan, swamp-låset, under ramper). Lägg tillbaka via outhole. Sedan guide 3. |
| **xxxxx Sw. is Stuck On** | En switch som normalt är öppen är sluten vid start (myntswitch, slam tilt, plumb bob). | T.2 Switch Levels visar vilka som är slutna. Rätta mekaniskt. |
| **Ground Short Row-N, Wht-xxx** | En hel rad kortsluten mot jord: slam tilt-switch mot myntdörren, bladswitch mot jordad del, skadad kabel, eller alla switchar i raden slutna samtidigt. | T.2 Switch Levels. Lossa misstänkta kontakter en i taget. |
| **Factory Settings Restored** | CMOS-minnet tappat: batterier, hållare, dioderna D1/D2 på CPU-kortet. U8 pin 26 och 28 ska ha +5 V på, minst +4 V av. | Byt batterier, rengör hållaren. Upprepas det: D1 (0 Ω fram, oändligt bak), D2 (15 Ω fram). Överväg NVRAM. Guide 13. |
| **U6 Checksum Error** | Spel-ROM:en ogiltig. | Byt/bränn om U6. Se §5. |
| **Time and Date Not Set** | Klockan går inte. | U.4 Set Time & Date. Återkommer det: batterier. |
| **CPU-LED blinkar 1 / 2 / 3 gånger** | ROM U6 / RAM U8 / ASIC U9 | Vid start ska D19 och D21 tändas, sedan D19 släckas och D20 blinka. |
| **Ljudkortet piper 1 / 2 / 3 / 4 / 5** | OK / U9 RAM / U18 ROM / U15 ROM / U14 ROM | Byt eller sätt om den utpekade kretsen. |

---

## 3. Symptomguider

Varje steg: *gör* → *förvänta* → *om fel*. Komponentnummer hänvisar till `data/components.json`.

### Guide 1. Flipper svag, tappar bollen när knappen hålls, eller död

Berör: F1/F3 (nedre EOS), F5/F7 (övre EOS), F2/F4/F6/F8 (knappar), spolar FL-15411 (nedre), FL-11753/FL-11630 (övre), säkringar F101/F102 (nedre), F901/F902 (övre). [manual 2-16, 2-17, 3-10, 3-18]

1. **Död flipper.** Kolla säkringen: F101 nedre vänster, F102 nedre höger, F901 övre vänster, F902 övre höger. Går den igen direkt: kortsluten spole eller diod, guide 9. [manual 1-47]
2. **T.1 Switch Edges: tryck knappen.** Displayen ska visa F2/F4/F6/F8. Inget: knappen eller kabeln till Fliptronics J805. [manual 1-15]
3. **T.1: lyft flipperbladet för hand till toppläget.** Displayen ska visa F1/F3/F5/F7 (EOS). Inget: EOS-gap eller brända kontakter. Gap 0,062″ ± 0,015″ (≈1,2–2 mm), justeras minst 0,25″ från switchkroppen. [manual 2-16] Utan fungerande EOS vet Fliptronics inte när den ska gå från kraft- till hållström, och flippern blir svag eller tappar. [erfarenhet]
4. **Båda nedre EOS flaggade samtidigt men inte de övre** pekar på något mekaniskt och gemensamt: ombyggnad, fel switchtyp, slitage. Reservdelslistan anger SW-1A-194 (make) för de nedre och SW-1A-193 för de övre. [manual/reservdelslista, se KNOWN-ISSUES]
5. **Mekaniken (strömmen av).** Rör flippern för hand: ska gå lätt och fjädra tillbaka. Kolla i ordning: **bumper plug 23-6577** (gummistoppet i vevlänken; åker det ur en gång åker det ur igen), **coil stop** (A-12111, slits till en grop), **länk** (A-10656), **bussning** (03-7568), **fjäder** (10-364), lösa skruvar (ska sitta med Loctite 242). Byt hellre allt på en gång med ett flipper-rebuild-kit för Bally/Williams 02/1992–04/1993. [manual 2-16; kit: erfarenhet]
6. **Efter bumper plug-byte: justera flipperns viloläge** (lossa vevarmen på axeln, ställ bladet mot justermärket, dra åt). [manual 2-16]
7. **Spolen.** Mät resistansen (strömmen av) och jämför vänster/höger. FL-15411 har två lindningar (kraft + håll); en brun/bränd spole eller avvikande värde byts. Dioden på spolen: blå tråd till bandänden. [manual 2-16]
8. **Fortfarande svag med allt ovan OK:** transistor på Fliptronics-kortet, eller kontakterna J905/J906 – vanligare på övre flipprarna som drivs via Extra Flipper Supply Board. [erfarenhet]

### Guide 2. Spelet startar om, fryser eller "Factory Settings Restored" vid spolslag

[erfarenhet; LED-normalvärden manual 1-46]
1. Titta på **Power Driver LED 4 (+5 V)** och **CPU D21** under spel. Blinkar de till när en spole slår är 5 V-matningen svag.
2. Klassiska orsaker i ordning: **bryggliksriktaren BR2** och **kondensatorn C5** på Power Driver-kortet (5 V-kretsen), kalla lödningar på BR2:s ben, **kontakten J101/J114** mellan Power Driver och CPU. Byt BR2 och C5 tillsammans, löd om headerpinnarna.
3. Mät +5 V på CPU-kortet (t.ex. U8 pin 28 mot jord): ska vara 4,9–5,1 V och inte dippa under 4,75 V när flipprarna slår.
4. Batteriläckage på CPU-kortet ger också konstiga resets: inspektera runt B1–B3.
5. Uteslut enkelt fel först: nätsäkringen och nätsladdens kontakt i strömboxen, lös jordfläta.

### Guide 3. Boll saknas, "Pinball Missing", eller spelet matar inte fram bollar

Berör: trough 15/16/17, outhole 18, shooter lane 51/27, Ball Release sol 04, Outhole sol 05, Thing kickout 77, Swamp lock 71–73, Lockup kickout 74. [manual 2-35, 2-18, 2-19]
1. **Räkna bollarna.** Spelet har två. Leta i Thing-lådan, swamp-låset (tre lägen), under ramperna och vid bokhyllan. Lägg tillbaka via outhole.
2. **T.2 Switch Levels** med bollarna i trough: 15 och 16 (eller motsvarande) ska vara slutna. En trough-switch som inte sluts med boll = spelet tror bollen är borta. Justera bladet / mikroswitchen. [manual 1-15]
3. **T.4 Solenoid Test**: 04 Ball Release ska lyfta en boll till shooter lane, 05 Outhole ska kicka bollen från outhole till trough. Svagt slag: hylsa/plunger, guide 9. [manual 1-16]
4. **Shooter lane-switch 51** ska registrera bollen i T.1; annars startar spelet inte nästa boll.
5. **Bollen fastnar hos Thing** (kickout 77, eject hole 87): kör T.12 02 Operation Test med en boll i eject hole. Guide 4.
6. **Bollen fastnar i swamp-låset**: T.4 sol 28 Swamp Release och 08 Lockup Kickout; switchar 71–74 i T.2.

### Guide 4. Thing tar inte bollen, tappar den, eller står still

Berör: sol 25 Thing Motor, 06 Thing Magnet, 07 Thing Kickout, switchar 84 Thing Down Opto, 85 Thing Up Opto, 87 Thing Eject Hole, 77 Thing Kickout, 63 Thing Eject Lane; sammanställning A-14711 Hand Drive. [manual 2-27, 1-19, B]
1. **T.12 01 Motor Test**: motorn ska gå och nedersta displayraden visa optostatus växla mellan upp och ned. Går inte motorn: sol 25 i T.4, säkring F103, kontakt J122-1. [manual 1-19]
2. **Optostatus ändras inte**: opto 84/85 (A-15285). Optos behöver +12 V och jord; rengör sändare/mottagare, kolla att flaggan bryter strålen. [manual 1-44]
3. **T.12 02 Operation Test** med boll i eject hole: handen ska hämta bollen, lyfta den, släppa i lådan. Tappar den bollen: **magneten** (sol 06, A-12158-1) – mät att den drar, kolla dioden och kontakt J130-7. Handen kommer fel: mekanisk justering av armen/kammen. [manual 2-27]
4. **Bollen lämnar inte lådan**: sol 07 Thing Kickout (AE-23-800) och switch 77. T.4 sol 07.
5. **Spelet säger aldrig till Thing att hämta**: switch 87 Thing Eject Hole måste registrera bollen (T.1).
6. Tillfällig lösning: **A.2 20 Disable THING = YES** så går spelet att spela utan handen. Glöm inte att sätta tillbaka. [manual 1-36]

### Guide 5. Bokhyllan öppnar eller stänger inte

Berör: sol 27 Bookcase Motor, switchar 81 Open, 82 Closed, optos 53–56 (bokhyllans lägen), sammanställning A-14970. [manual 2-28, 2-29, 1-19]
1. **T.13 Bookcase Test**: Enter startar/stoppar motorn, displayen visar gränslägesswitcharna. [manual 1-19]
2. Motorn går inte: sol 27 (14-7969 12 V) i T.4, säkring F103, kontakt J122-3.
3. Motorn går men stannar fel: switch 81/82 (5647-12693-08) – justera armarna, kolla i T.1.
4. Bokhyllan känner inte bollen: optos 53–56 (A-15017/A-15018), +12 V och jord, rengöring.
5. Tillfällig lösning: **A.2 21 Disable BOOKCASE = YES**.

### Guide 6. En GI-sträng är död eller flimrar

Berör: GI 1–5, säkringar F106–F110, kontakter J120/J121, triacs Q10–Q18. [manual 1-47, 3-19, 1-17]
1. **T.6 General Illumination** tänder strängarna en i taget; se vilken som är död. [manual 1-17]
2. **Säkring**: GI1 F110, GI2 F106, GI3 F107, GI4 F109 (ej använd), GI5 F108. 5 A trög. Går den igen: kortsluten sockel eller skavd kabel i strängen.
3. **Kontakten J120/J121 på Power Driver**: missfärgade eller bruna pinnar = bränd header. Byt både header och honkontakt med nya krympstift; löd inte bara om. Det här är den vanligaste GI-orsaken på WPC. [erfarenhet]
4. Triac Q10–Q18 för strängen (en död triac = strängen alltid släckt; en kortsluten = alltid tänd, ingen dimning).
5. **Flimmer på hela GI:n** vid dimning med LED: normalt med billiga LEDs, se §8.

### Guide 7. Lampa, hel rad eller hel kolumn i matrisen död (eller alltid tänd)

Berör: lampmatrisen, J133/J137, Q83–Q98. [manual 3-2, 3-3, 1-18]
1. **T.9 All Lamps**: se mönstret. En lampa = glödlampa/sockel. En **rad** (samma sista siffra, t.ex. x2) = radtransistor Q83–Q90 eller tråd röd-X/J133. En **kolumn** (samma första siffra) = kolumntransistor Q91–Q98 eller tråd gul-X/J137. [manual 1-18]
2. **En lampa**: byt glödlampan, böj sockelns kontakter, kolla lödningarna på lamp-PCB:n (A-15110 m.fl.).
3. **Rad/kolumn alltid tänd**: kortsluten transistor. Alltid släckt: öppen transistor, kontakt eller tråd. Mät på Power Driver mot tabellen. [erfarenhet]
4. **Efter LED-byte**: svagt sken på släckta lampor = ghosting, se §8.

### Guide 8. Switch registrerar inte, eller en hel rad/kolumn saknas

Berör: switchmatrisen, J206/J208, U20 (kolumner), U18/U19 (rader). [manual 3-4, 3-5, 1-15, 1-16]
1. **T.1 Switch Edges**: aktivera med en boll (inte fingret) för att efterlikna spel. [manual 1-44]
2. **T.3 Single Switch → Start** visar tråd, kontakt och säkring för switchen. [manual 1-16]
3. **En switch**: bladgap/arm, smuts, lös tråd, **dioden 1N4148** på switchen (utan diod fungerar switchen men "spökar" i andra positioner). [erfarenhet]
4. **Flera switchar i samma kolumn** (samma första siffra): kolumntråd grön-X, kontakt J206-x, U20 på CPU. **Samma rad**: radtråd vit-X, J208-x, U18/U19. Kolla det gemensamma innan du justerar switcharna. [manual 3-4]
5. **Optos** (53–57, 84, 85): +12 V och jord till optokortet, rengör, kolla att inget blockerar. [manual 1-44]
6. **Jet bumper-switchar** (31–35): bladswitch under skirten (SW-11A-37, B-12030-2). Gapet ska slutas av en lätt knuff på skirten. Registrerar inte switchen skjuter inte bumpern. [manual 2-20]

### Guide 9. Spole går inte, slår svagt, låser sig, eller säkringen går

Berör: valfri solenoid 01–28, dess drivtransistor, säkringar F103/F104/F105/F111. [manual 3-6, 3-7, 1-16, 2-20 … 2-26]
1. **T.4 Solenoid Test**, Repeat-läge, jämför med en likadan spole (alla jets har AE-26-1200, båda slingshots AE-27-1200). **Start** visar tråd, transistor, kontakt, säkring. [manual 1-16]
2. **Slår inte alls**: säkringen (01–08 F105, 09–16 F104, 17–24 F111, 25–28 F103), sedan spolens diod, sedan transistorn.
3. **Svagt slag**: mekaniken. Spolhylsa (coil sleeve) sliten eller smält, svampad plunger, sliten länk/yoke, utsliten coil stop, lösa skruvar. Jet bumper: ringens stag har glidit ur armaturlänken (01-5492/01-5493), bakelitlänk sprucken. [manual 2-20]
4. **Låser sig "på" och blir varm**: kortsluten drivtransistor (TIP102/TIP36C-klassen) på Power Driver, ofta för att spolens diod gått först. Stäng av direkt; byt diod och transistor, kontrollera fördrivaren. [erfarenhet]
5. **Säkringen går direkt**: kortsluten spole (mät resistans, jämför), skavd kabel mot jord, felaktig diod.
6. **Mätning med multimeter (strömmen på, DC-läge, svart spets på jordflätan)**: båda spolens lödöron ska visa matningsspänning (~50 V high power, ~20 V flasher) i vila. 0 V på matningssidan = avbrott/säkring. 0 V på transistorsidan i vila = kortsluten transistor. **Kortslut aldrig de två öronen med spetsarna.** [erfarenhet]

### Guide 10. Check Switch (det guidade flödet)

1. Skriv in numren från testrapporten.
2. Slå ihop orsaker: samma kolumn/rad/kontakt → ett gemensamt steg först.
3. Per switch: T.1 med boll → reagerar = falsklarm (försvinner efter några spel) / reagerar inte → guide 8, punkt 2–6.
4. EOS (F1/F3/F5/F7) → guide 1, punkt 3–6.
5. Optos → guide 8, punkt 5.
6. Logga resultatet per switch.

### Guide 11. Ghosting eller flimmer efter LED-byte

[erfarenhet]
1. Kör **T.8** i halvmörker: glöder släckta lampor svagt = ghosting. Berör bara lampmatrisen, inte GI.
2. Byt till **non-ghosting-LEDs** i de positioner som glöder (ofta bara vissa rader/kolumner).
3. DIY: ett motstånd parallellt **över lampan** i sockeln (inte över sockelns diod): börja med 1 kΩ ¼ W, gå ner till 680/470 Ω. Flashers: 2,2 kΩ ½ W, ner till 1 kΩ 1 W.
4. Många lampor: ett "LED OCD"-kort mellan Power Driver och matrisen löser alla på en gång.
5. **GI-flimmer vid dimning**: LEDs som inte tål triac-dimning; välj dimbara eller behåll glödlampor i GI (Addams GI-fade är en del av spelets känsla).

### Guide 12. Thing Flips missar för ofta

[manual sida B]
1. Rätt kalibrerad träffar den 50–60 %. Efter flytt: **U.12 New Location** (nollställer inlärningen) eller U.8 (nollställer allt, undvik).
2. Kontrollera switcharna kalibreringen bygger på: **57 Bumper Lane Opto** (över övre vänstra miniflippern), **45/47/48 Swamp-målen**, **71 Swamp Lock Upper**, samt övre vänstra flippern.
3. Snabbkalibrering med glaset av: 4 kast upp för sidorampen (Super Jackpot); sedan rollover i vänster returbana ("Lite Thing Flips") följt av mittrampen, minst 30 gånger. Flera hundra skott för full precision.
4. Lutning och nivå ska vara satta **på plats** innan kalibrering (6–7°). [manual 1-3]

### Guide 13. Klockan/inställningar tappas, "Factory Settings Restored"

[manual 1-45, erfarenhet]
1. Byt de tre AA-batterierna (strömmen **på** under bytet behåller inställningarna, om man vågar; annars anteckna inställningarna först via appens inställningssida).
2. Rengör hållaren; grönt/vitt pulver = läckage, rengör kortet med ättika/isopropanol och inspektera ledningsbanorna intill.
3. Mät U8 pin 28 mot jord: ≥ +4 V med strömmen av.
4. D1 och D2 på CPU-kortet enligt manualen.
5. Långsiktigt: flytta batterierna till en extern hållare med kabel, eller byt U8 mot NVRAM (ingen batteririsk alls).

### Guide 14. Inget ljud, brummar, eller pip vid start

[manual 1-45, 1-17]
1. Räkna pipen vid start: 1 = OK; 2 = U9 RAM; 3 = U18; 4 = U15; 5 = U14 på ljudkortet. Sätt om/byt kretsen.
2. Säkringar F501 (−25 V) och F502 (+25 V) på ljudkortet.
3. **A.1 28 Minimum Volume Control**: står den på YES kan volymen vara nedvriden till av. Volym upp med myntdörrsknappen.
4. T.7 Sound & Music Test.
5. Högtalarkontakterna i backbox och kabinett.

### Guide 15. Displayen är svart, har döda rader eller darrar

[manual 1-47, 1-19, erfarenhet]
1. F601 (+80 V) och F602 (+100 V) på Dot Matrix Controller (3/8 A trög). **Högspänning: låt kortet stå avslaget en stund innan du rör det.**
2. T.11 Display Test visar mönster; döda rader/kolumner = flatkabel eller displayglaset.
3. Kalla lödningar på högspänningsdelen av DMD-kortet är vanligt. Displayen är en slitdel (dimmar med åren).

---

## 4. Rekommenderade inställningar för free play på kontoret

Ordning: presets först (de skriver över enskilda värden), sedan justeringar. Undvik **U.8 Factory Reset** – den nollställer även custom message och topplistan. [manual 1-21 … 1-43]

### Presets (U. Utilities → U.9)

| Preset | Varför |
|---|---|
| **U.9 02 Install Easy** | Snällare för sällanspelare (fler extra bollar, lättare lås, Million Plus sparas). Alternativ: **U.9 03 Install Medium** = fabrik. |
| **U.9 10 Install Novelty** | Tar bort gratisspelsbelöningar (replay, match, high score-credits) som är meningslösa på free play. Special ger poäng. |
| *(alternativ)* **U.9 08 Install Add-A-Ball** | Replays och specials ger extra boll i stället. Roligare, men längre spel om det är kö. |

### A.3 Pricing

| Inställning | Värde |
|---|---|
| **A.3 17 Free Play** | **YES** |

### A.1 Standard Adjustments

| Inställning | Förslag | Motiv |
|---|---|---|
| A.1 01 Balls Per Game | 3 | lagom vid kö |
| A.1 02 Tilt Warnings | 3 | |
| A.1 19 Match Feature | OFF | Novelty sätter det |
| A.1 20 Custom Message | YES | |
| A.1 21 Language | English | |
| A.1 22 Clock Style | 24 Hours | |
| A.1 23 Date Style | Date/Month/Year | |
| A.1 24 Show Date and Time | valfritt | |
| A.1 25 Allow Dim Illumination | YES | behåller GI-effekterna |
| A.1 26 Tournament Play | YES | multiball/jackpots förs inte över mellan spelare |
| A.1 27 Euro. Scr. Format | YES | 1.000.000 |
| A.1 28 Minimum Volume Control | YES | ljudet kan stängas av helt vid möten |
| A.1 29 GI Power Saver | 15 min | dimmar när ingen spelat |
| A.1 30 Power Saver Level | 5–6 | (4–7) |

### A.2 Feature Adjustments

Lämna enligt presetet. Kontrollera **A.2 20 Disable THING = NO** och **A.2 21 Disable BOOKCASE = NO**.

**Finns bara i ROM H-4/6.0H, ej i manualen** [hämtat ur ROM-filen]: `A-MODE SOUND`, `A-MODE MUSIC` (stäng av på kontor), `GAMEOVER KICKOUT`, `SPOT GREED/BALL`, `FREEPLAY MESSAGE` (visar "FREE PLAY" i attract mode), `SPOT T-H-I-N-G`. De ligger efter A.2 26 i menyn. Exakt nummer och beskrivning måste läsas av på displayen.

### A.4 H.S.T.D.

| Inställning | Förslag |
|---|---|
| A.4 01 Highest Scores | ON |
| A.4 03 Champion H.S.T.D. | ON |
| A.4 04–08 Credits | 00 (Novelty) |
| A.4 09 High Score Reset Every | OFF (evig lista) eller t.ex. 2 000 |
| A.4 10–14 Backup-poäng | sänk så kollegor kommer in på listan; justera efter några veckor |

Kör sedan **U.3 Reset H.S.T.D.**

### Utilities efter flytt

| Funktion | Varför |
|---|---|
| U.4 Set Time & Date | |
| U.5 Custom Message | se §9 |
| U.12 New Location | nollställer Thing Flips-kalibreringen |

---

## 5. ROM och EPROM

**Versioner** [ROM-historik från ipdb/community]: L-1 (jan 1992) … L-5 (dec 1992, sista rena operatörsversionen), L-6 (bara Tyskland, trasig buy-in), H-3 (maj 1993, Home-inställningar + ny slam tilt-hantering), **H-4 (maj 1994, rekommenderad)**, 6.0H (feb 1995, = H-4 med ny numrering). L-2 fixade trasig Thing-hand, L-3 Tunnel Hunt-logik.

**Filen** `ADDAM_H4.ROM`: 524 288 byte (512 KB) → **27C040** (4 Mbit). MD5 `2157560764b827af26d41d2d2efef949`. Innehåller strängarna `REV. H-4`, `EPROM H-4`, `PROGR. H-4`. Checksumman i ROM:en är korrekt: 16-bitars summa av alla byte = `$FB06` = ordet på `$FFEE`; `$FFEC` är utjämningsordet. Koden ligger i bank 0E–1F (288 KB); bank 00–0D är tomma (`$FF`), så filen kan inte krympas till 27C020.

**Byte av U6** [manual p2 för byglar, 1-45 för checksumfel; övrigt erfarenhet]
1. Anteckna alla inställningar först (appens inställningssida). Byte nollställer justeringar, bokföring och topplista.
2. Ström av, sladden ur. Notera skårans riktning. Bänd U6 jämnt från båda ändar.
3. Byglar: **W1 in, W2 ut** för 1M/2M/4M EPROM (27C040). Landsbyglar: European = W16 ut, övriga in; American = alla in.
4. Nytt chip: ST **M27C4001**-10F1 (UV-raderbart, fönster) eller AT27C040 (OTP). Programmerare: **XGecu T48** (Xgpro på Windows, `minipro` på Linux). Vpp 12,75 V. Blank check → Program → Verify. Etikett + ljusskydd över fönstret.
5. Starta: spelet upptäcker ny kod och återställer fabriksinställningar. Kör **U.9 INSTALL HOME**-presetet (finns i H-versionerna) och lägg tillbaka inställningarna.
6. Ljud-ROM (U14/U15/U18 på ljudkortet) berörs inte. Sound-ROM L-1 är den enda versionen.
7. Passa på: batterihållaren/NVRAM, GI-kontakter.

**Att modifiera ROM:en** är tekniskt möjligt (6809-assembler, bankväxlad, PinMAME för test, checksum måste räknas om) men ett stort projekt, och koden är Williams/Planetary Pinballs upphovsrätt. Ändringar bör stanna i den egna maskinen. De flesta önskemål (free play, svårighet, ball save-liknande) finns redan som justeringar i H-4.

---

## 6. Flipprar [manual 2-16, 2-17]

| Flipper | Sammanst. | Spole | EOS (reservdelslista) | Säkring |
|---|---|---|---|---|
| Nedre vänster | A-15205-L-4 | FL-15411 (orange) | SW-1A-194 | F101 3A S.B. |
| Nedre höger | A-15205-R-4 | FL-15411 (orange) | SW-1A-194 | F102 3A S.B. |
| Övre vänster (mini) | A-15205-L-1 | FL-11753 (gul) | SW-1A-193 | F901 3A S.B. |
| Övre höger | A-15205-R | FL-11630 (röd) | SW-1A-193 | F902 3A S.B. |

- EOS-gap 0,062″ ± 0,015″, justering ≥ 0,25″ från switchkroppen. Spetsen ska röra sig 0,150″ (+0,010/−0) innan kontakterna öppnar helt med flippern i toppläge (så manualen skriver; gapet gäller i viloläge).
- Slitdelar: coil stop A-12111, länk A-10656, bussning 03-7568, fjäder 10-364, **bumper plug 23-6577**, flipperbladet 20-9250-6 (nedre) / 20-9264-6 (övre), gummi 23-6519-4 / 23-6553-4.
- Loctite 242 på flipperstopp, solenoidfäste och bussning.
- Spolens diod: blå heltråd till bandänden, spårad tråd till den andra.

## 7. Jet bumpers och slingshots [manual 2-20, 2-21]

- Fem jets: sol 09 Upper Left, 10 Upper Right, 11 Center Left, 12 Center Right, 13 Lower; spole AE-26-1200; switchar 31–35 (SW-11A-37); lampor 21–25 (#555). Säkring F104.
- Spolsammanställning A-9415-2: fäste B-7417, stål-/bakelitlänk 01-5492/01-5493, plunger 02-3406-1, fjäder 10-326, hylsa 03-7066. Bumperkropp 03-7443-5, ring A-4754, fjäder 10-7, röda lock ("red wafer").
- Slingshots: sol 14/15, AE-27-1200, switchar 36/37, kicker arm B-12665.

## 8. Lampor och LED

**Antal glödlampor i spelet** [reservdelslistan + manual 2-40]

| Var | Typ | Antal |
|---|---|---|
| Inserts, lampmatris | #555 | 37 (+7 "Thing"-lampor i högtalarpanelen = 44) |
| Inserts, lampmatris | #44 | 19 |
| GI spelplan | #44 | 21 |
| GI backbox (Insert House/People) | #555 | 23 |
| Blinkande i backbox | #455 (självblinkande) | 7 |
| Flashers | #906 | 14 enligt solenoidtabellen, 15 enligt reservdelslistan |

Glödlampsartiklar: #555 = 24-8768, #44 = 24-6549, #455 = 24-6591, #906 = 24-8802.

**Vid LED-byte** [erfarenhet]
- Matrisen: **non-ghosting** krävs. Riktade ("top view"/Super Flux) under inserts.
- GI: vanliga 6,3 V AC/DC non-polar räcker; **varmvit** (3000–3500 K) för originalkänsla. Spelets GI-fade försvinner med de flesta LEDs; många ägare behåller glödlampor i GI.
- Flashers: 20 V-krets. Dedikerade pinball-flashers märkta "12–13 V" är gjorda för det. Bil-LED 12 V blir varm om flashern hålls tänd; 24 V-version blir dimmare (25–65 % beroende på konstruktion). Rundstrålande (5× Super Flux / 8 SMD) under kupoler.
- #455: måste ersättas med **självblinkande** LED, annars slutar blixtarna i backglaset blinka.
- Pop bumper-kit: kropp 03-7443-5 med #555-sockel → BriteRings (limmas i originallocket) eller BriteCaps EVO (+5 mm höjd, kolla utrymmet under vänstra rampen vid jet 31/32). BriteCaps Classic passar inte (bajonett).

**Butiker** [läge sept 2026]: pinballshop.nl (EiKO-glödlampor 4,95 €/10, HighFlow Super Flux 0,80 €, Frosted 0,75 €, T15/906 Super Flux flasher 2,95 €, Bee blinker 2,50 €), Pinball Center (Noflix, reservdelar, brända ROM:ar), Ministry of Pinball, A.u.S. coinoperatorshop.com (blinkande #455 3,55 €, färgade diffusa LED), PA LED paledbulb.com (non-ghosting 19,99 $/10, lager i FR/UK), Comet Pinball (färdigt Addams-kit 134,99 $).

## 9. Custom message [manual 1-20, 1-30; format från ägarens maskin]

- **A.1 20 Custom Message = YES**, sedan **U.5**: Up/Down bokstäver, **Start** skiljetecken, Enter låser tecknet, bakåtpil (efter 9, före mellanslag) raderar. **Håll Enter** tills "Message Stored".
- Format på den här maskinen: **2 rader × 16 tecken per frame**, flera frames. Endast engelska tecken.
- Visas i attract mode tillsammans med high scores och replay-nivå.
- Vald text: `EDUCATION FIRST` / `··PINBALL SECOND` (två inledande mellanslag så att D hamnar längst till höger); frame 2: `·BROUGHT TO YOU` / `·····BY LEO`.

## 10. Säkringar: var de sitter [manual 1-47]

- **Power Driver (backbox)**: F116 uppe till vänster (liggande); F101–F105 i rad uppe i mitten; F111–F114 i kolumn till höger; F115 mitt till vänster; F106–F110 nere till vänster.
- **Ljudkortet**: F501/F502. **DMD-kortet**: F601/F602. **Extra Flipper Supply Board**: F901/F902.
- **Nätsäkring** i strömboxen vid nätsladden: **europeiskt spel 4 A trög** (amerikanskt 8 A normal).
- **Magnetsäkring 5 A trög** på spelplanens undersida.
- Byt aldrig till större värde. En hel säkring behöver inte bytas. Kolla hållarnas clips (glapp = värme).

## 11. Servicelista (vad som är värt att byta vid en genomgång)

Slitdelar: alla gummiringar (2-42), flipper-rebuild-kit ×4 (minst ×2 nedre), kulor, jet-rebuild ×5, spolhylsor på kickers/slingshots.
Förebyggande: batterier → extern hållare eller NVRAM; GI-headrar J120/J121; BR2 + C5; spel-ROM H-4; reservsäkringar i rätt värden i kassaboxen.
Addams-specifikt: rengör optos (Thing 84/85, bokhylla 53–56, bumper lane 57), kör T.12 och T.13, kolla Thing-magnet och motorer.
Kan vänta: LED, plaster, kosmetik.

## 12. Mätning med multimeter (säkert)

- Resistans alltid med strömmen av. Jämför alltid med en likadan komponent i samma maskin.
- Spänning med svart spets på jordflätan under spelplanen, DC-läge 200 V. 50 V solenoid, 20 V flasher, 18 V lampmatris, 12 V switch/opto, 5 V logik, GI 6,3 V AC (växelspänningsläge).
- Kortslut aldrig en spoles båda lödöron. Rör inte DMD-kortets högspänningsdel med ström på.
- En multimeter ser inte en 30 ms spolpuls; du mäter matning, inte slagkraft.
