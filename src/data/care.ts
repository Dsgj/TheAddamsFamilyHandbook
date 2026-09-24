/**
 * Cleaning and upkeep by interval. Same shape as the setup guide so the page, the storage and the
 * backup file are shared: tick when done and the date stays on the device. Untick and tick again
 * next time.
 *
 * Sources: the manual's Maintenance Information page (Handbook → LEDs, fuses & maintenance) for
 * lubrication points, switch contacts and cleaners; the yearly inspection order and the
 * connector rules from the owner's service brief (Handbook appendix A7); the rest is common
 * practice for a Diamond Plate playfield. Edit this file when the advice changes.
 */
import type { SetupStep } from './setup';

export const CARE_INTRO =
  'Clean, dry, and look while you are in there. Tick an item when done; the date stays on this device so the next person sees when it was last done. Untick and tick again next time.';

export const CARE_WARNING =
  'Never oil or grease a coil plunger, coil sleeve or flipper. No WD-40 or 5-56 anywhere in the machine; the film attracts dust and gums up. The only grease is a dab on the slingshot arm pivots and the ball shooter lane feeder pivots, see Twice a year. Power off before touching connectors or boards. Contact cleaner is for intact contacts that are dirty; a browned, loose or melted connector is replaced, never sprayed. Look and measure first, clean second: Handbook appendix A7.';

export const CARE_STEPS: SetupStep[] = [
  {
    id: 'weekly',
    title: 'Every week or so',
    menu: 'Glass off, five minutes',
    intro: 'The manual asks for this at every collection stop. For an office machine, weekly.',
    items: [
      {
        id: 'care-balls',
        name: 'Wipe the balls and look for pits, nicks or rust',
        suggested: '',
        why: 'The four magnets magnetise the balls and they carry grit across the playfield. A damaged ball sands the playfield; replace it, never polish it. Pinballs come in six-packs, see Setup step 7.',
        find: '',
      },
      {
        id: 'care-glass',
        name: 'Clean the playfield glass, both sides',
        suggested: '',
        why: 'Ammonia-free glass cleaner sprayed on the cloth, not on the glass, so nothing drips onto the playfield. Rest the glass on a soft surface, never on its edge on concrete.',
        find: '',
      },
      {
        id: 'care-dust',
        name: 'Dust the playfield with a dry microfibre cloth',
        suggested: '',
        why: 'Dry, no product. Dust and ball grit are what wear the playfield; a wipe takes most of it away before it does.',
        find: '',
      },
      {
        id: 'care-listen',
        name: 'Play a game and listen',
        suggested: '',
        why: 'A weak flipper, a slow kickout or a rattling ramp shows up long before an error message. Note it on the component card so the history is there.',
        find: '',
      },
    ],
  },
  {
    id: 'monthly',
    title: 'Every month',
    menu: 'Glass off, playfield down',
    intro:
      'Cleaning products: the playfield has a Diamond Plate clear coat, the plastics do not like solvents.',
    items: [
      {
        id: 'care-playfield',
        name: 'Clean the playfield with Novus 1 or a barely damp microfibre cloth',
        suggested: '',
        why: 'Novus 1 (or plain water) for routine cleaning. No alcohol, no Windex, no kitchen cleaners: ammonia and caustic cleaners dull the clear coat and the inserts. The manual: avoid excessive water, caustic and abrasive cleaners.',
        alt: 'Novus 2 only on haze or fine scratches in the clear coat, then Novus 1 to finish. Never on printed art that has lost its clear coat.',
        find: '',
      },
      {
        id: 'care-plastics',
        name: 'Wipe the plastics and ramps with Novus 1',
        suggested: '',
        why: 'The manual: no cleaners containing petroleum distillates on any plastic, they dissolve it or lift the art. Novus 1 is anti-static and safe. Novus 2 buffs ball trails out of the ramps if you care.',
        find: '',
      },
      {
        id: 'care-rubbers',
        name: 'Look at the rubbers and the flipper rubbers',
        suggested: '',
        why: 'Wipe with a damp cloth. Replace when hard, cracked or flat-spotted; a hard ring plays dead and a flat flipper rubber shoots wide.',
        find: '',
      },
      {
        id: 'care-vacuum',
        name: 'Vacuum the cabinet floor and the playfield edges',
        suggested: '',
        why: 'Soft brush attachment. Keep the nozzle away from wires, switches and the optos under the ramps.',
        find: '',
      },
      {
        id: 'care-switch-test',
        name: 'Run T.1 Switch Edges and walk every switch',
        suggested: '',
        why: 'Roll a ball over the rollovers, press the targets, wave a finger through the optos. A dirty or bent switch shows up here before the game reports Check Switch. A contact that misses gets card stock pulled through the closed switch, never a file or spray; a gap that is wrong gets bent at the blade, not at the contact. Optos are cleaned with a dry brush and a phone camera shows their LED glowing.',
        find: 'T.1',
      },
    ],
  },
  {
    id: 'halfyear',
    title: 'Twice a year',
    menu: 'Playfield up, power off',
    intro:
      'Wax, wear parts and the only two places that get grease. When cleaning around the plastics is no longer enough, the full strip-down is Handbook appendix A8.',
    items: [
      {
        id: 'care-wax',
        name: 'Wax the playfield',
        suggested: '',
        why: 'Pure carnauba paste wax (Blitz, P21S, Meguiar’s Gold Class paste). The manual allows carnauba wax used sparingly. No cleaner-wax and nothing with silicone; silicone soaks into the wood and nothing sticks later. Thin coat, buff off, let it cure an hour before playing.',
        find: '',
      },
      {
        id: 'care-sleeves',
        name: 'Check the coil sleeves and plungers, flippers first',
        suggested: '',
        why: 'Pull the plunger and look. A grey, gritty sleeve or a mushroomed plunger tip gets replaced, never lubricated. Flippers first, then slingshots and jet bumpers; they fire most. On the flippers, also look at the coil stop and the link: a worn stop lets the plunger over-travel and cracks the link, and a cracked link is a weak flipper before it is a dead one.',
        find: 'A6',
      },
      {
        id: 'care-pivots',
        name: 'A dab of grease on the slingshot arm pivots and the ball shooter lane feeder pivots',
        suggested: '',
        why: 'The manual’s two lubrication points: the kicker arm pivots and the feeder arm pivots take a switch target grease (Williams 20-8886, MBI Instrument Grease; any light instrument grease does). Pivots only, nothing near the plunger.',
        find: 'Maintenance Information',
      },
      {
        id: 'care-ramp-flaps',
        name: 'Look at the ramp flaps and the Thing hand ramp',
        suggested: '',
        why: 'Lifted or cracked flaps chip the playfield edge in front of them. The ramp covers from the first parts round protect the entrances.',
        find: '',
      },
      {
        id: 'care-under',
        name: 'Vacuum under the playfield and inside the backbox',
        suggested: '',
        why: 'Dust on the boards holds moisture. Soft brush, gently around the boards, no compressed air at the DMD face.',
        find: '',
      },
      {
        id: 'care-level',
        name: 'Check level and pitch',
        suggested: '',
        why: 'Spirit level across the playfield at the flippers; front to back about 6.5 degrees. Adjust the leg levellers, then the plumb bob tilt so it hangs centred in its ring.',
        find: '',
      },
    ],
  },
  {
    id: 'yearly',
    title: 'Every year',
    menu: 'Power off, backbox open',
    intro:
      'Inspection first, in this order, cleaning last. Each item is ordered by how expensive the fault is if missed. Appendix A7 in the Handbook has the connector rules and the products.',
    items: [
      {
        id: 'care-battery-area',
        name: 'Inspect the CPU board battery holder and the board around it for leakage',
        suggested: '',
        why: 'Priority 1. Alkaline leakage creeps under the solder mask and eats traces, vias and the reset circuit next to the holder. White or green crust, dark copper or eaten component leads means a corrosion repair, not a spray: neutralise, clean, repair, then think about a remote holder or NVRAM. Appendix A5 has the steps.',
        find: 'A5',
      },
      {
        id: 'care-tieback',
        name: 'Inspect J122 and both diode tieback groups, then continuity-test them',
        suggested: '',
        why: 'Priority 2. J122 feeds the Thing motor, Thing eject, bookcase motor and swamp release. Their flyback diodes tie back in two pairs: gray-yellow on pins 5 and 8 (25 and 27), violet-green on pins 6 and 9 (26 and 28), manual schematic 3-17. A lost tieback kills the driver transistor and can lock the load on. Look at the housing, the IDC terminals, the header pins, the board solder and the wire ends at the loads. Power off, J122 unplugged: the tieback wire itself reads close to 0 Ω pin to load; a reading through a winding is several ohms and is fine. Run the solenoid test on all four afterwards.',
        alt: 'A doubtful IDC terminal or a browned pin is replaced with a crimped Trifurcon terminal and a new header, not cleaned.',
        find: 'A2',
      },
      {
        id: 'care-gi',
        name: 'Inspect the GI connectors J115, J120 and J121 for heat',
        suggested: '',
        why: 'Priority 3. The 6.3 V AC strings pull amps through these three connectors and they brown with age. Look for a discoloured or melted housing, dark pins, weak terminal tension, a poor crimp, cracked solder at the header and heat marks on the board. Heat damage means both sides are replaced, terminals and header. Clean and tight means leave it alone.',
        find: 'A4',
      },
      {
        id: 'care-connectors',
        name: 'Look over the other connectors and every board, then clean and treat only what passed',
        suggested: '',
        why: 'Priorities 4 to 7. First the other high-current connectors: solenoid J122–J130, the flipper connectors, the power input, their headers and solder. Then every board for cracked solder, overheated components, corrosion, damaged traces and earlier repairs. Only the connectors that are intact, tight and merely dirty get pulled, a short burst of DeoxIT D5 or Kontakt 60 PLUS on the pins, and pushed back. Verify the circuit afterwards.',
        alt: 'Never spray the leaf switches, the EOS switches or the optos. Contacts are cleaned by closing them on clean card stock and pulling it through; IPA on the card if needed; gap 1/16 inch; never a file.',
        find: 'A7',
      },
      {
        id: 'batteries',
        name: 'Three AA batteries on the CPU board replaced',
        suggested: '',
        why: 'Same tick as Setup step 7. Look at the holder for corrosion while the batteries are out; NVRAM only if it starts.',
        find: '',
      },
      {
        id: 'care-fuses',
        name: 'Look at the fuses and fuse clips',
        suggested: '',
        why: 'A discoloured fuse or a loose clip runs hot. The right values are on the Fuses page; never go up a size.',
        find: 'Fuse List',
      },
      {
        id: 'care-mechs',
        name: 'Run the bookcase and Thing tests and listen for grinding',
        suggested: '',
        why: 'The bookcase motor and the Thing hand drive are the two mechanisms with gears. Grinding or hesitation means wear, not a call for oil; look at the gears and the optos.',
        find: '',
      },
      {
        id: 'care-report',
        name: 'Run the Test Report and paste it into Diagnose',
        suggested: '',
        why: 'Diagnose reads the codes and the component cards keep the history, so next year’s report has something to compare with.',
        find: 'Test Report',
      },
    ],
  },
];

export const CARE_ITEM_COUNT = CARE_STEPS.reduce((n, s) => n + s.items.length, 0);
