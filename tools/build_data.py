import json, re, sys
S = sys.argv[1]
callouts = json.load(open(f"{S}/callouts.json"))

# ---------- Switch matrix wiring (Operator's Handbook p.9 / Ops manual 3-4) ----------
COLS = {1:("Grön-brun","Green-Brown","J206-1","U20-18"),2:("Grön-röd","Green-Red","J206-2","U20-17"),
        3:("Grön-orange","Green-Orange","J206-3","U20-16"),4:("Grön-gul","Green-Yellow","J206-4","U20-15"),
        5:("Grön-svart","Green-Black","J206-5","U20-14"),6:("Grön-blå","Green-Blue","J206-6","U20-13"),
        7:("Grön-violett","Green-Violet","J206-7","U20-12"),8:("Grön-grå","Green-Gray","J206-9","U20-11")}
ROWS = {1:("Vit-brun","White-Brown","J208-1","U18-11"),2:("Vit-röd","White-Red","J208-2","U18-9"),
        3:("Vit-orange","White-Orange","J208-3","U18-5"),4:("Vit-gul","White-Yellow","J208-4","U18-7"),
        5:("Vit-grön","White-Green","J208-5","U19-11"),6:("Vit-blå","White-Blue","J208-7","U19-9"),
        7:("Vit-violett","White-Violet","J208-8","U19-5"),8:("Vit-grå","White-Gray","J208-9","U19-7")}

# (num, switch part, assy, name, flags) flags: u=underside(†), n=not shown(*)
SW = """11|||Not Used|
12|||Not Used|
13||20-9663-1|Start Button|
14||20-6502-A|Plumb Bob Tilt|n
15|5647-09957-00|B-8925|Left Trough|
16|5647-09957-00|B-8925|Center Trough|
17|5647-12693-08|A-11680|Right Trough|
18|5647-12133-12|A-10417|Outhole|
21||27-1066|Slam Tilt|n
22||A-8630|Coin Door Closed|n
23|||Ticket Opto (Not Used)|n
24||A-8630|Always Closed|n
25|5647-12693-19|A-12688|Right Flipper Lane|
26|5647-12693-19|A-12688|Right Outlane|
27|5647-12693-04|A-11619|Ball Shooter|
28|||Not Used|
31|SW-11A-37|B-12030-2|Upper Left Jet|
32|SW-11A-37|B-12030-2|Upper Right Jet|
33|SW-11A-37|B-12030-2|Center Left Jet|
34|SW-11A-37|B-12030-2|Center Right Jet|
35|SW-11A-37|B-12030-2|Lower Jet|
36|SW-1A-114|B-8284-1|Left Slingshot|
37|SW-1A-120|A-11539-1|Right Slingshot|
38|5647-12693-19|A-12688|Upper Left Loop|
41||B-11696-1|Grave "G"|
42||B-11696-1|Grave "R"|
43|5647-12693-25|A-14962|Chair Kickout|u
44||B-11696-4 (2) / B-12583-4 (2)|Cousin It|
45||B-11696-15|Lower Swamp Million|
46|||Not Used|
47||B-11696-15|Center Swamp Million|
48||B-11696-15|Upper Swamp Million|
51|5647-12693-19|A-15372|Shooter Lane|
52|||Not Used|
53||A-15017/A-15018|Bookcase Opto 1|
54||A-15017/A-15018|Bookcase Opto 2|
55||A-15017/A-15018|Bookcase Opto 3|
56||A-15017/A-15018|Bookcase Opto 4|
57||A-14231/A-14232|Bumper Lane Opto|
58|5647-12693-21|A-14972|Right Ramp Exit|
61|5647-12693-11|A-14492|Left Ramp Enter|
62||B-11696-5|Train Wreck|
63|5647-12693-19|A-12688|Thing Eject Lane|
64|5647-12693-11|A-13627-2|Right Ramp Enter|
65|5647-12693-21|A-15047|Right Ramp Top|
66|5647-12693-21|A-15047|Left Ramp Top|
67|5647-12693-19|A-12688|Upper Right Loop|
68|5647-12693-08|A-15070|Vault|
71|5647-12693-25|A-14964|Swamp Lock Upper|u
72|5647-12693-25|A-14964|Swamp Lock Center|u
73|5647-12693-25|A-14964|Swamp Lock Lower|u
74|5647-12693-25|A-14964|Lockup Kickout|u
75|5647-12693-19|A-12688|Left Outlane|
76|5647-12693-19|A-12688|Left Flipper Lane 2|
77|5647-12693-25|A-15200|Thing Kickout|u
78|5647-12693-19|A-12688|Left Flipper Lane 1|
81|5647-12693-08|A-14970|Bookcase Open|u
82|5647-12693-08|A-14970|Bookcase Closed|u
83|||Not Used|
84||A-15285|Thing Down Opto|u
85||A-15285|Thing Up Opto|u
86||B-12583-1|Grave "A"|
87|5647-12133-11|A-9381-R|Thing Eject Hole|
88|||Not Used|"""

TYPE_HINT = {
 "opto": "Optosensor (sändare + mottagare). Kolla +12V och jord till optokortet, och att inget blockerar strålen.",
 "jet": "Bladswitch under jet-bumperns skirt. Justera bladgapet så att en lätt knuff på skirten stänger kontakten.",
 "sling": "Bladswitchar bakom slingshot-gummit. Kontrollera gap och att bladen inte är brända.",
 "target": "Stationärt mål (target). Kolla att bladen sluter när målet träffas och att dioden är hel.",
 "rollover": "Rollover-switch med trådarm. Kolla att armen går fritt och att mikroswitchen klickar.",
 "trough": "Trough-switch. Om spelet tappar räkningen på bollar, kolla dessa först.",
 "micro": "Mikroswitch med arm. Kolla att bollen trycker ner armen hela vägen.",
 "coin": "Myntdörrs-/kabinettswitch. Dedikerad eller matris enligt tabellen.",
}
def hint(name, part, assy):
    n = name.lower()
    if "opto" in n: return TYPE_HINT["opto"]
    if "jet" in n: return TYPE_HINT["jet"]
    if "sling" in n: return TYPE_HINT["sling"]
    if "trough" in n or "outhole" in n: return TYPE_HINT["trough"]
    if assy.startswith("B-11696") or assy.startswith("B-12583"): return TYPE_HINT["target"]
    if "tilt" in n or "coin" in n or "start" in n or "always" in n: return TYPE_HINT["coin"]
    if part.startswith("5647-12693") or part.startswith("5647-12133") or part.startswith("5647-09957"): return TYPE_HINT["rollover"] if assy in ("A-12688","A-15372","A-11619") else TYPE_HINT["micro"]
    return ""

sw_loc = {}
for c in callouts["97"]:
    sw_loc.setdefault(c["label"].rstrip("ab"), []).append({"x": c["x"], "y": c["y"], "l": c["label"]})

switches = []
for line in SW.splitlines():
    num, part, assy, name, fl = line.split("|")
    n = int(num); col, row = n // 10, n % 10
    unused = "Not Used" in name
    switches.append(dict(
        id=num, name=name, part=part, assy=assy, col=col, row=row,
        colWire=COLS[col][0], colWireEn=COLS[col][1], colPin=COLS[col][2], colIc=COLS[col][3],
        rowWire=ROWS[row][0], rowWireEn=ROWS[row][1], rowPin=ROWS[row][2], rowIc=ROWS[row][3],
        under="u" in fl, notShown="n" in fl, unused=unused,
        hint="" if unused else hint(name, part, assy),
        loc=sw_loc.get(num, [])))

# Dedicated & flipper switches
dedicated = [
 ("D1","Left Coin Chute","Orange-Brown","Orange-brun","J205-1"),
 ("D2","Center Coin Chute","Orange-Red","Orange-röd","J205-2"),
 ("D3","Right Coin Chute","Orange-Black","Orange-svart","J205-3"),
 ("D4","4th Coin Chute","Orange-Yellow","Orange-gul","J205-4"),
 ("D5","Service Credits / Escape","Orange-Green","Orange-grön","J205-6"),
 ("D6","Volume Down / Down","Orange-Blue","Orange-blå","J205-7"),
 ("D7","Volume Up / Up","Orange-Violet","Orange-violett","J205-8"),
 ("D8","Begin Test / Enter","Orange-Gray","Orange-grå","J205-9"),
]
flipsw = [
 ("F1","Right Flipper End of Stroke","Black-Green","Svart-grön","J906-1"),
 ("F2","Right Flipper Button","Blue-Violet","Blå-violett","J905-1"),
 ("F3","Left Flipper End of Stroke","Black-Blue","Svart-blå","J906-3"),
 ("F4","Left Flipper Button","Blue-Gray","Blå-grå","J905-2"),
 ("F5","Upper Right Flipper End of Stroke","Black-Violet","Svart-violett","J906-4"),
 ("F6","Upper Right Flipper Button","Black-Yellow","Svart-gul","J905-3"),
 ("F7","Upper Left Flipper End of Stroke","Black-Gray","Svart-grå","J906-5"),
 ("F8","Upper Left Flipper Button","Black-Blue","Svart-blå","J905-5"),
]
# NOTE: handbook prints J806-x / J805-x for flipper switches
for lst, kind in ((dedicated, "ded"), (flipsw, "flip")):
    for sid, name, wen, wsv, pin in lst:
        if kind == "flip": pin = pin.replace("J9", "J8")
        switches.append(dict(id=sid, name=name, part="", assy="", col=None, row=None,
            wire=wsv, wireEn=wen, pin=pin, kind=kind, under=False, notShown=True, unused=False,
            hint=("EOS (End of Stroke) på flippermekanismen under spelplanen. Kontaktgap 0,062\" ±0,015\" (ca 1,2–2 mm), justeras minst 0,25\" (6 mm) från switchkroppen. "
                  "Reservdelslistan anger SW-1A-194 (make) för de nedre flipprarna och SW-1A-193 för de övre; flippersidan i manualen listar bara SW-1A-193 för grundmodellen." if "End of Stroke" in name else
                  "Flipperknapp i kabinettsidan." if "Button" in name else "Dedikerad switch på myntdörren."),
            loc=[]))

# ---------- Lamps ----------
LCOLS = {1:("Gul-brun","Yellow-Brown","J137-1","Q98"),2:("Gul-röd","Yellow-Red","J137-2","Q97"),
         3:("Gul-orange","Yellow-Orange","J137-3","Q96"),4:("Gul-svart","Yellow-Black","J137-4","Q95"),
         5:("Gul-grön","Yellow-Green","J137-5","Q94"),6:("Gul-blå","Yellow-Blue","J137-6","Q93"),
         7:("Gul-violett","Yellow-Violet","J137-7","Q92"),8:("Gul-grå","Yellow-Gray","J138-9","Q91")}
LROWS = {1:("Röd-brun","Red-Brown","J133-1","Q90"),2:("Röd-svart","Red-Black","J133-2","Q89"),
         3:("Röd-orange","Red-Orange","J133-4","Q88"),4:("Röd-gul","Red-Yellow","J133-5","Q87"),
         5:("Röd-grön","Red-Green","J133-6","Q86"),6:("Röd-blå","Red-Blue","J133-7","Q85"),
         7:("Röd-violett","Red-Violet","J133-8","Q84"),8:("Röd-grå","Red-Gray","J133-9","Q83")}
LAMP = """11|24-8768|A-15114|Thing Multiball|#555|
12|24-8768|A-15114|Extra Ball|#555|
13|24-8768|A-15114|Jackpot (2)|#555|
14|24-6549|A-11754|Grave "A"|#44|
15|24-6549|A-11754|Stars|#44|
16|24-6549|A-11754|Super Jackpot|#44|
17|24-6549|A-11754|Grave "V"|#44|
18|24-6549|A-11271|Upper Swamp Million|#44|
21|24-8768|A-11199|Upper Left Jet|#555|
22|24-8768|A-11199|Upper Right Jet|#555|
23|24-8768|A-11199|Center Left Jet|#555|
24|24-8768|A-11199|Center Right Jet|#555|
25|24-8768|A-11199|Lower Jet|#555|
26|24-8768|A-15113|Cousin It (2)|#555|
27|24-8768|A-15113|2 Bear Kicks|#555|
28|24-8768|A-15113|Thing Flips|#555|
31|24-8768|A-15112|G-R-E-E-D "G"|#555|
32|24-8768|A-15112|G-R-E-E-D "R"|#555|
33|24-8768|A-15112|G-R-E-E-D "E"-1|#555|
34|24-8768|A-15112|G-R-E-E-D "E"-2|#555|
35|24-8768|A-15112|G-R-E-E-D "D"|#555|
36|24-8768|A-15111|5X Graveyard|#555|
37|24-8768|A-15111|Center Swamp Million|#555|
38|24-8768|A-15111|Lower Swamp Million|#555|
41|||Not Used||
42|24-6549|A-11271|Advance X|#44|
43|24-6549|A-11754|Grave "G"|#44|
44|24-6549|A-11271|Grave "R"|#44|
45|24-6549|A-11271|The Mamushka|#44|
46|24-6549|A-11271|Swamp Lock|#44|
47|24-8768||Electric Chair Red|#555|
48|24-6549|A-11271|Grave "E"|#44|
51|24-8768|A-15110|Thing|#555|
52|24-8768|A-15110|Raise The Dead|#555|
53|24-8768|A-15110|Lite Extra Ball|#555|
54|24-8768|A-15110|House 6 Million|#555|
55|24-8768|A-15110|Quick Multiball|#555|
56|24-8768|A-15110|Fester's Tunnel Hunt|#555|
57|24-8768|A-15110|House Seance|#555|
58|24-8768|A-15110|Hit Cousin It|#555|
61|24-6549|A-11271|Left Special|#44|
62|24-6549|A-11271|Lite Thing Flips|#44|
63|24-6549|A-11271|Lite 2 Bear Kicks|#44|
64|24-8768||Electric Chair Yellow|#555|
65|24-6549|A-11271|House "?"|#44|
66|24-6549|A-11754|House 9 Million|#44|
67|24-8768|A-15110|Graveyard At Max|#555|
68|24-8768|A-15110|House 3 Million|#555|
71|24-6549|A-11271|Lite Advance X|#44|
72|24-6549|A-11271|Right Special|#44|
73|24-6549|A-11754|Shoot Again|#44|
74|24-8768|A-12887-B|Vault Green|#555|
75|24-8768|A-12887-B|Vault Red|#555|
76|||Not Used||
77|24-8768||Thing Yellow|#555|
78|24-8768||Thing Green|#555|
81|24-8768|D-12501|*Thing* "*"-1|#555|s
82|24-8768|D-12501|*Thing* "T"|#555|s
83|24-8768|D-12501|*Thing* "H"|#555|s
84|24-8768|D-12501|*Thing* "I"|#555|s
85|24-8768|D-12501|*Thing* "N"|#555|s
86|24-8768|D-12501|*Thing* "G"|#555|s
87|24-8768|D-12501|*Thing* "*"-2|#555|s
88||20-9663-1|Credit Button||"""
lamp_loc = {}
for c in callouts["98"]:
    lamp_loc.setdefault(c["label"], []).append({"x": c["x"], "y": c["y"], "l": c["label"]})
lamps = []
for line in LAMP.splitlines():
    num, bulb, assy, name, btype, fl = line.split("|")
    n = int(num); col, row = n // 10, n % 10
    lamps.append(dict(id=num, name=name, bulbPart=bulb, assy=assy, bulb=btype, col=col, row=row,
        colWire=LCOLS[col][0], colWireEn=LCOLS[col][1], colPin=LCOLS[col][2], colQ=LCOLS[col][3],
        rowWire=LROWS[row][0], rowWireEn=LROWS[row][1], rowPin=LROWS[row][2], rowQ=LROWS[row][3],
        speaker="s" in fl, unused="Not Used" in name, loc=lamp_loc.get(num, [])))

# ---------- Solenoids / flashers ----------
# (no, function, type, wire(en), connection, driver, part, assy(ops 2-41), desc flag)
SOL = """01|Chair Kickout|High Power|Vio-Brn|J130-1|Q82|AE-26-1200|A-15115|u
02|Thing Knocker|High Power|Vio-Red|J132-2|Q80|AE-23-800|A-15267|c
03|Ramp Diverter|High Power|Vio-Orn|J130-4|Q78|AE-26-1500|A-15040|
04|Ball Release|High Power|Vio-Yel|J130-5|Q76|AE-26-1200|B-9362-L-2|
05|Outhole|High Power|Vio-Grn|J130-6|Q64|AE-27-1200|A-8039-3|
06|Thing Magnet|High Power|Vio-Blu|J130-7|Q66|A-12158-1|A-12158-1|
07|Thing Kickout|High Power|Vio-Blk|J130-8|Q68|AE-23-800|A-15200|u
08|Lockup Kickout|High Power|Vio-Gry|J130-9|Q70|AE-26-1200|A-14107|u
09|Upper Left Jet|Low Power|Brn-Blk|J127-1|Q58|AE-26-1200|A-9415-2|
10|Upper Right Jet|Low Power|Brn-Red|J127-3|Q56|AE-26-1200|A-9415-2|
11|Center Left Jet|Low Power|Brn-Org|J127-4|Q54|AE-26-1200|A-9415-2|
12|Center Right Jet|Low Power|Brn-Yel|J127-5|Q52|AE-26-1200|A-9415-2|
13|Lower Jet|Low Power|Brn-Grn|J127-6|Q50|AE-26-1200|A-9415-2|
14|Left Slingshot|Low Power|Brn-Blu|J127-7|Q48|AE-27-1200|A-14369-L|
15|Right Slingshot|Low Power|Brn-Vio|J127-8|Q46|AE-27-1200|A-14369-L|
16|Left Magnet|Low Power|Brn-Gry|J127-9|Q44|20-9247 12V||u
17|Telephone/Upper Right Ramp|Flasher|Blk-Brn|J126-1 / J125-1|Q42|#906||
18|Train/Upper Left Ramp|Flasher|Blk-Red|J126-2 / J125-2|Q40|#906||
19|Lower Ramp/Jet Bumpers (2)|Flasher|Blk-Org|J126-3 / J125-3|Q38|#906|A-12336-1|
20|Left Lightning Bolt/Mini Flipper|Flasher|Blk-Yel|J126-4 / J125-5|Q36|#906|A-12336-1|
21|Right Lightning Bolt/Swamp|Flasher|Blu-Grn|J126-5 / J125-6|Q28|#906|A-12336-1|
22|The Power/Backbox Clowd (3)|Flasher|Blu-Blk|J126-6 / J125-7|Q30|#906|A-12336-1|
23|Upper Magnet|Low Power|Blu-Vio|J126-7 / J125-8|Q34|20-9247 12V||u
24|Right Magnet|Low Power|Blu-Gry|J126-8 / J125-9|Q32|20-9247 12V||u
25|Thing Motor|Flasher|Blu-Brn|J122-1|Q26|14-7966 12V|A-14711|
26|Thing Eject Hole|Flasher|Blu-Red|J122-2|Q24|AE-30-2000|A-15368|
27|Bookcase Motor|Flasher|Blu-Org|J122-3|Q22|14-7969 12V|A-14970|
28|Swamp Release|Flasher|Blu-Yel|J122-4|Q20|AE-30-2000|A-15367|u"""
WIRE_SV = {"Vio":"Violett","Brn":"Brun","Red":"Röd","Orn":"Orange","Org":"Orange","Yel":"Gul","Grn":"Grön","Blu":"Blå","Blk":"Svart","Gry":"Grå"}
def wsv(w): return "-".join(WIRE_SV.get(p, p) for p in w.split("-")).capitalize()
def sol_fuse(n):
    if n <= 8: return "F105 (3A S.B.)"
    if n <= 16: return "F104 (3A S.B.)"
    if n <= 24: return "F111 Flasher Secondary (5A S.B.)"
    return "F103 (3A S.B.)"
sol_loc = {}
for c in callouts["99"]:
    k = re.sub(r"[ab]$", "", c["label"]).zfill(2)
    sol_loc.setdefault(k, []).append({"x": c["x"], "y": c["y"], "l": c["label"]})
FLASH_NAMES = {"17":"Flasher #1 (2)","18":"Flasher #2 (2)","19":"Flasher #3 (2)","20":"Flasher #4","21":"Flasher #5","22":"Flasher #6 (b ovanpå backboxen)"}
coils = []
for line in SOL.splitlines():
    no, fn, typ, wire, conn, q, part, assy, fl = line.split("|")
    n = int(no)
    coils.append(dict(id=no, name=fn, type=typ, wireEn=wire, wire=wsv(wire), pin=conn, driver=q,
        part=part, assy=assy, under=fl == "u", cabinet=fl == "c", fuse=sol_fuse(n),
        note=("Magnetsäkring 5A S.B. sitter på undersidan av spelplanen." if "Magnet" in fn and fn != "Thing Magnet" else
              FLASH_NAMES.get(no, "")),
        loc=sol_loc.get(no, [])))

gi = [
 dict(id="GI 1", name="Left Playfield String", wire="Brun", pin="J120-1", driver="Q18", bulb="#44", fuse="F110 (5A S.B.)"),
 dict(id="GI 2", name="Insert House String", wire="Orange", pin="J120-2", driver="Q10", bulb="#555", fuse="F106 (5A S.B.)"),
 dict(id="GI 3", name="Insert People String", wire="Gul", pin="J120-3", driver="Q14", bulb="#555", fuse="F107 (5A S.B.)"),
 dict(id="GI 4", name="Not Used", wire="Grön", pin="J121-5", driver="Q16", bulb="", fuse="F109 (5A S.B.)"),
 dict(id="GI 5", name="Right Playfield String", wire="Violett", pin="J121-6", driver="Q12", bulb="#44", fuse="F108 (5A S.B.)"),
]
flippers = [
 dict(id="ULF", name="Upper Left Flipper", wire="Grå-gul", pin="J109-5", coil="FL-11753", assy="A-15205-L-1", fuse="F901 (3A S.B., Extra Flipper Supply Board)"),
 dict(id="URF", name="Upper Right Flipper", wire="Blå-gul", pin="J109-7", coil="FL-11630", assy="A-15205-R", fuse="F902 (3A S.B., Extra Flipper Supply Board)"),
 dict(id="LLF", name="Lower Left Flipper", wire="Grå-gul", pin="J109-5", coil="FL-15411", assy="A-15205-L-4", fuse="F101 (3A S.B.)"),
 dict(id="LRF", name="Lower Right Flipper", wire="Blå-gul", pin="J109-7", coil="FL-15411", assy="A-15205-R-4", fuse="F102 (3A S.B.)"),
]
fuses = [
 ("F101","Power Driver","Lower Left Flipper","3A S.B."),("F102","Power Driver","Lower Right Flipper","3A S.B."),
 ("F103","Power Driver","Solenoids 25–28","3A S.B."),("F104","Power Driver","Solenoids 9–16","3A S.B."),
 ("F105","Power Driver","Solenoids 1–8","3A S.B."),("F106","Power Driver","G.I. #2 Wht-Vio","5A S.B."),
 ("F107","Power Driver","G.I. #3 Wht-Yel","5A S.B."),("F108","Power Driver","G.I. #5 Wht-Grn","5A S.B."),
 ("F109","Power Driver","G.I. #4 Wht-Orn","5A S.B."),("F110","Power Driver","G.I. #1 Wht-Brn","5A S.B."),
 ("F111","Power Driver","Flasher Secondary","5A S.B."),("F112","Power Driver","Solenoid Secondary","5A S.B."),
 ("F113","Power Driver","+5V Logic","5A S.B."),("F114","Power Driver","+18V Lamp Matrix","8A N.B."),
 ("F115","Power Driver","+12V Switch Matrix","3/4A S.B."),("F116","Power Driver","+12V Secondary","3A S.B."),
 ("F501","Audio","−25V Circuit","3A S.B."),("F502","Audio","+25V Circuit","3A S.B."),
 ("F601","Dot Matrix Controller","+80V A.C.","3/8A S.B."),("F602","Dot Matrix Controller","+100V A.C.","3/8A S.B."),
 ("F901","Extra Flipper Supply","Upper Left Flipper","3A S.B."),("F902","Extra Flipper Supply","Upper Right Flipper","3A S.B."),
 ("—","Linjefilter","Domestic Game","8A N.B."),("—","Linjefilter","Foreign Game","4A S.B."),
 ("—","Undersidan spelplan","Magneter","5A S.B."),
]
fuses = [dict(id=a, board=b, circuit=c, rating=d) for a, b, c, d in fuses]
leds = [
 ("CPU D19","Blanking","Tänd vid start, släckt i drift"),
 ("CPU D20","Diagnostic","Släckt vid start, blinkar i drift"),
 ("CPU D21","+5 VDC","Tänd"),
 ("PD LED 1","+12 VDC, switchkrets","Normalt tänd"),
 ("PD LED 2","Hög/låg nätspänningssensor","Normalt tänd"),
 ("PD LED 3","Hög/låg nätspänningssensor","Normalt släckt"),
 ("PD LED 4","+5 VDC, digitalkrets","Normalt tänd"),
 ("PD LED 5","+20 VDC, flasherkrets","Normalt tänd"),
 ("PD LED 6","+18 VDC, lampkrets","Normalt tänd"),
 ("PD LED 7","+12 VDC, kraftkrets (motorer, reläer)","Normalt tänd"),
]
leds = [dict(id=a, what=b, normal=c) for a, b, c in leds]

data = dict(switches=switches, lamps=lamps, coils=coils, gi=gi, flippers=flippers, fuses=fuses, leds=leds,
            swCols={k: list(v) for k, v in COLS.items()}, swRows={k: list(v) for k, v in ROWS.items()},
            lCols={k: list(v) for k, v in LCOLS.items()}, lRows={k: list(v) for k, v in LROWS.items()})
json.dump(data, open(f"{S}/site/data.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(switches), len(lamps), len(coils), "missing loc:",
      [s["id"] for s in switches if not s["loc"] and not s["unused"] and not s["notShown"] and s.get("kind") is None],
      [l["id"] for l in lamps if not l["loc"] and not l["unused"]],
      [c["id"] for c in coils if not c["loc"]])
