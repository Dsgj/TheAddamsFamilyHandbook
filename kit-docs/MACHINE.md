# Den här maskinen

Fakta om ägarens exemplar, som ägaren själv uppgett (september 2026). Används som startdata för serviceloggen och maskinkortet. Datum är när det rapporterades, inte nödvändigtvis när det hände. Rader märkta *observerat 2026-09-24, foto* kommer från ägarens backbox-inspektion med sex foton (`kit-docs/photos/2026-09-24-backbox/01..06.jpg`).

## Maskinkort

| Fält | Värde |
|---|---|
| Modell | Bally *The Addams Family*, WPC Fliptronics I, modell 20017 (standardutgåvan, inte Gold) |
| Plats | Kontoret; spelas av kollegor |
| Spel-ROM | **L-4** på ST M27C2001-12F1 (2 Mbit = 256 KB) i U6, fabriksetikett "ADDAMS FAMILY U6 ROM 1 ©1991 MIDWAY", röd handskriven lapp "L-4" *(observerat 2026-09-24, foto)*. Filen `ADDAM_H4.ROM` (H-4, MD5 `2157560764b827af26d41d2d2efef949`) finns; planen att bränna ett eget 27C040 (XGecu T48) och byta U6 står fast och är värd det (L-4 saknar L-5:s Thing-award-fix, H-3:s slam tilt-hantering och alla Home-inställningar). Byglarna **W1 in / W2 ut ändras inte** (manual s. 2: samma läge för 2M och 4M EPROM) |
| RAM / CMOS | **anyPin NVRAM Battery Eliminator** (lila modul, lockwhenlit.com) i U8. Inga batterier behövs eller ska sättas i. Klockan går bara med spelet på, så datum/tid släpar efter varje avstängning → A.1 24 Show Date and Time = NO. Det svarta blocket under modulen ser ut som batterihållaren, täckt eller borttagen; bekräfta att inga gamla celler sitter kvar *(observerat 2026-09-24, foto)* |
| Kort och datumkoder | CPU A-12742-20017: 68B09EP 9209, ASIC 5410-12426-00 9206, bygelraden W11–W18 syns vid J204 (värden ej läsbara på fotot). Audio A-12738-20017: 68B09EP 9218, YM2151 9210. Power Driver A-12697-1: IC 9212, LM323K 5 V-regulator, stora kondensatorer ser original ut, F101–F105 hela vid syn. Fliptronics: TIP36C 9208 (original), **hela TIP102-raden 9910** → bytt tillsammans 1999, troligen efter ett flipperfel *(observerat 2026-09-24, foto)* |
| Tillverkning | Datumkoder 9206–9218 → korten byggda feb–maj 1992: tidigt exemplar, stämmer med manualen från januari 1992 *(observerat 2026-09-24, foto)* |
| Tidigare service | Kabelkontakterna är märkta med maskeringstejp och handskrivna J-nummer: korten har varit ute och satts tillbaka av tidigare ägare/tekniker. TIP102-raden på Fliptronics bytt 1999 *(observerat 2026-09-24, foto)* |
| Serienummer | Etikett "20017 …" delvis synlig på backboxen; hela numret ska läsas av *(observerat 2026-09-24, foto)* |
| Ljud-ROM | L-1 (enda versionen) |
| Prissättning | Free play via pris satt till 00 credits |
| Custom message | Under inmatning: `EDUCATION FIRST` / `··PINBALL SECOND`, ev. frame 2 `·BROUGHT TO YOU` / `·····BY LEO`. Displayen tar 2 rader × 16 tecken per frame |
| Manualer | Operations Manual jan 1992 (16-20017-101), Operator's Handbook jan 1991 (16-20017-103), WPC Schematic Manual jan 1992, fabrikens reservdelslista |

## Loggposter att importera

```
2026-09-22  session   Testrapport: Check Switch 32 (Upper Right Jet), 68 (Vault), F1 (R. Flipper EOS), F3 (L. Flipper EOS)
            status    32: ej testad · 68: ej testad · F1: ej testad · F3: ej testad
            plan      T.1 Switch Edges på alla fyra; F1+F3 delar kontakt J806 → misstänkt gemensam mekanisk orsak (EOS-gap/bumper plug)

2026-09-22  repair    Nedre vänster flipper: spolen/länken hade lossnat från gummibussningen (bumper plug 23-6577). Tryckt tillbaka.
            todo      Bumper plug kommer troligen lossna igen → byt 23-6577, helst flipper-rebuild-kit ×2 (nedre). Justera viloläge + EOS efteråt.
            komponenter: flipper LLF, switch F3

2026-09-22  note      Misstänkt "trött" jet bumper nere till vänster (sol 13 Lower Jet eller 11 Center Left Jet). Ej bekräftad. Mätning planerad: resistans mot grannjet, matning på båda lödöronen.

2026-09-22  settings-change  Free play aktiverat (pris 00 credits). Notering: fyra tryck på Start startade fyra spelare.

2026-09-22  settings-change  A.1 20 Custom Message → YES; U.5 text inmatad (se maskinkortet). Kontrollera att "Message Stored" visades.

2026-09-23  parts     Inköpsförslag (status: förslag): flipper-rebuild-kit Bally/Williams 02/1992–04/1993 ×2; bumper plug 23-6577 ×2;
                      EiKO #44 10-pack, #555 10-pack ×2, #906 10-pack (pinballshop.nl); ST M27C4001-10F1 ×2 + XGecu T48 + UV-raderare;
                      testlampor: T15/906 HighFlow Super Flux flasher 1× kallvit 1× röd, några HighFlow Super Flux T10/BA9 och Frosted; BriteRings ×1 provmontering jet 31.

2026-09-24  note      Backbox-inspektion (foto 01–06, kit-docs/photos/2026-09-24-backbox/). Spel-ROM L-4 på ST M27C2001-12F1 i U6 (röd lapp "L-4").
                      U8: anyPin NVRAM Battery Eliminator, inga batterier. Fliptronics: TIP36C 9208 original, hela TIP102-raden 9910 (bytt 1999).
                      CPU 68B09EP 9209 / ASIC 9206, Audio 68B09EP 9218 / YM2151 9210, Power Driver A-12697-1 IC 9212, LM323K, F101–F105 hela.
                      Kontakter tejpmärkta med J-nummer (tidigare service). Etikett "20017 …" delvis synlig.
            källa     observerat 2026-09-24, foto
            komponenter: CPU U6, CPU U8, Fliptronics
            todo      ta bort ev. gamla celler under NVRAM-modulen · läs W11–W18 (W16 ut = European) · läs hela serienumret · sätt A.1 24 = NO
```

## Öppna punkter

- Testa switch 32, 68, F1, F3 i T.1 och logga.
- Byt bumper plug / rebuild-kit på nedre flipprarna; justera EOS-gap på båda.
- Mät den misstänkta jeten.
- Bekräfta att custom message sparades och visas i attract mode.
- Gå igenom free play-inställningarna (KNOWLEDGE.md §4) och fyll i *Nuvarande* i appen **innan** ROM-bytet.
- Kolla landsbyglarna på CPU-kortet (europeiskt spel: W16 ut; bygelraden W11–W18 vid J204 syntes på fotot men inte värdena) och nätsäkringen (4 A trög) när backboxen ändå är öppen.
- Bekräfta att inga gamla batterier sitter kvar i eller under hållaren under NVRAM-modulen (U8). *(observerat 2026-09-24, foto)*
- Läs hela serienumret på etiketten "20017 …" på backboxen.
- Sätt A.1 24 Show Date and Time = NO (klockan går bara med spelet på, NVRAM utan batteri).
- Vid F1/F3-fel: inspektera lödningarna på TIP102-raden på Fliptronics (bytt 1999).
- LED-konvertering: senare projekt.
