# Den här maskinen

Fakta om ägarens exemplar, som ägaren själv uppgett (september 2026). Används som startdata för serviceloggen och maskinkortet. Datum är när det rapporterades, inte nödvändigtvis när det hände.

## Maskinkort

| Fält | Värde |
|---|---|
| Modell | Bally *The Addams Family*, WPC Fliptronics I, modell 20017 (standardutgåvan, inte Gold) |
| Plats | Kontoret; spelas av kollegor |
| Spel-ROM | Nuvarande version okänd. Filen `ADDAM_H4.ROM` (H-4, MD5 `2157560764b827af26d41d2d2efef949`) finns; planen är att bränna ett eget 27C040 (XGecu T48) och byta U6 |
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
```

## Öppna punkter

- Testa switch 32, 68, F1, F3 i T.1 och logga.
- Byt bumper plug / rebuild-kit på nedre flipprarna; justera EOS-gap på båda.
- Mät den misstänkta jeten.
- Bekräfta att custom message sparades och visas i attract mode.
- Gå igenom free play-inställningarna (KNOWLEDGE.md §4) och fyll i *Nuvarande* i appen **innan** ROM-bytet.
- Kolla landsbyglarna på CPU-kortet (europeiskt spel: W16 ut) och nätsäkringen (4 A trög) när backboxen ändå är öppen.
- LED-konvertering: senare projekt.
