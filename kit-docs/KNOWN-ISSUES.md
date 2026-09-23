# Kända osäkerheter i datan

Sådant som appen ska visa som osäkert, eller som bör verifieras i nästa varv.

## Transkription

- **Sidorna 1-16, 1-17, 1-18 (PDF 26–28) och 1-21 (PDF 31)** i testmenyn skrevs av från OCR-texten med uppenbara fel rättade, men jämfördes inte mot bilderna av den som transkriberade. 1-21 har därefter kontrollerats mot bilden och stämmer; **26–28 är okontrollerade**. Läs dem mot `assets/pages/ops/26–28.png` en gång.
- Övriga 52 sidor transkriberades från bilderna. Inga `[?]` markerades, men enstaka siffror i täta tabeller (svårighets- och pristabellerna, PDF 32–36 och 50) bör stickprovskontrolleras.
- Manualens egna tryckfel är bevarade avsiktligt: `Single Switchs`, `more then one`, `Jumper Bumper`, `Match Award` numrerad `A.1 15` (samma som Special Award) på sidan 35, `U.0 04` i kolumnrubriken på sidan 32, omkastade Balls Per Game-värden i Install 5-Ball/3-Ball-kolumnerna på sidan 33.
- Justeringstabellerna innehåller på några ställen rader (`| Range | … |`) som är byggda från löptext, inte tryckta tabeller. Inga fabriksstandarder är påhittade; manualen trycker sällan defaults.

## Komponentdata

- **Flashers: 14 eller 15.** Solenoidtabellen (3-6) ger 6 flasherkretsar med sammanlagt 14 lampor (17–22 med (2)/(3)-markeringar); reservdelslistan summerar till 15 #906 (varav 3 på backboxens ovansida). Räkna i maskinen.
- **`fuse` på spolar 01–28** är härlett ur säkringslistan (F105 = solenoider 1–8 osv.), inte tryckt per spole.
- **`hint`-texterna** på switchar är erfarenhet, inte manual.
- **EOS-switchtyp:** reservdelslistan anger SW-1A-194 (make) för nedre flipprar och SW-1A-193 för övre; flippersidan 2-16 listar bara SW-1A-193 för basmodellen A-15205-R. Källorna motsäger varandra.
- **Callout-positioner** på kartorna utgår från handplacerade seeds som snappats till detekterade svarta diskar i skanningen (max avvikelse 21 px vid 300 dpi). Lampa 13 och 71 är enbart handplacerade. Cousin It (44a/44b) har fyra markeringar i originalet.
- **Vault (68)** är inte markerad som undersida i manualen; den sitter uppe till höger på spelplanen (tidigare felaktigt beskriven som undersida i chatten).
- **Check Switch-tröskeln** är 90 bollar / 30 spel (1-44), inte "60 spel".
- **H-4-justeringar utöver A.2 26** (A-MODE SOUND, A-MODE MUSIC, GAMEOVER KICKOUT, SPOT GREED/BALL, FREEPLAY MESSAGE, SPOT T-H-I-N-G) är hämtade ur ROM-filens strängtabell; nummer, ordning och valmöjligheter är inte verifierade mot en maskin.
- **Custom message-formatet** (2 rader × 16 tecken per frame) kommer från ägarens maskin, inte manualen. Antal frames okänt.

## Sektion 2–3

- Inte transkriberade. Reservdelstabellerna per sammanställning (2-2 … 2-38) och kabeltabellerna (3-16 … 3-20) finns bara som skanningar och OCR-text. Reservdelslistan (`data/parts.json`) täcker artikelnumren men inte manualens per-ritning-numrering.

## Prototypen

- Testloggen i prototypen lagras i artefaktens databas och `localStorage`; den följer inte med i det här paketet.
- Prototypens fritextsök använder transkriptionen för avskrivna sidor och OCR för övriga.
