/**
 * English renderings of the few Swedish strings in the kit's data files.
 * The owner chose English throughout the app. Manual text is never translated;
 * these are the assistant's own hints and labels (see kit-docs/DATA-SCHEMA.md).
 *
 * Build-time input only: src/lib/kit/translate.ts applies these once, when Vite loads the kit's
 * components.json, and src/lib/handbook/render.ts applies HANDBOOK_ATTR to the kit's handbook
 * html, so no island imports this file. The translation is closed-world: every value a dictionary
 * field takes in the kit is a key here, the English ones mapped to themselves (`same`), and a
 * value missing from its dictionary fails the build.
 */

/** Kit values that are already English, listed so the closed-world translation knows them. */
const same = (...s: string[]): Record<string, string> => Object.fromEntries(s.map((x) => [x, x]));

const COLOUR: Record<string, string> = {
  brun: 'Brown',
  röd: 'Red',
  orange: 'Orange',
  gul: 'Yellow',
  grön: 'Green',
  blå: 'Blue',
  violett: 'Violet',
  grå: 'Grey',
  svart: 'Black',
  vit: 'White',
};

/** `Blå-grön` → `Blue-Green`; throws on a colour word it does not know. */
export function wireEn(sv: string): string {
  return sv
    .split('-')
    .map((w) => {
      const key = w.trim().toLowerCase();
      const v = Object.hasOwn(COLOUR, key) ? COLOUR[key] : undefined;
      if (v === undefined) throw new Error(`no English for wire colour ${JSON.stringify(w)}`);
      return v;
    })
    .join('-');
}

export const BOARD: Record<string, string> = {
  Linjefilter: 'Line filter',
  'Undersidan spelplan': 'Under the playfield',
  ...same('Power Driver', 'Audio', 'Dot Matrix Controller', 'Extra Flipper Supply'),
};

export const FUSE_CIRCUIT: Record<string, string> = {
  Magneter: 'Magnets',
  // The fuse list prints `G.I. #2 Wht-Vio`; the app writes GI and spells the colours out (CP2-15).
  'G.I. #1 Wht-Brn': 'GI 1, White-Brown',
  'G.I. #2 Wht-Vio': 'GI 2, White-Violet',
  'G.I. #3 Wht-Yel': 'GI 3, White-Yellow',
  'G.I. #4 Wht-Orn': 'GI 4, White-Orange',
  'G.I. #5 Wht-Grn': 'GI 5, White-Green',
  ...same(
    'Lower Left Flipper',
    'Lower Right Flipper',
    'Solenoids 25–28',
    'Solenoids 9–16',
    'Solenoids 1–8',
    'Flasher Secondary',
    'Solenoid Secondary',
    '+5V Logic',
    '+18V Lamp Matrix',
    '+12V Switch Matrix',
    '+12V Secondary',
    '−25V Circuit',
    '+25V Circuit',
    '+80V A.C.',
    '+100V A.C.',
    'Upper Left Flipper',
    'Upper Right Flipper',
    'Domestic Game',
    'Foreign Game',
  ),
};

export const LED_NORMAL: Record<string, string> = {
  'Tänd vid start, släckt i drift': 'On at power-up, off in operation',
  'Släckt vid start, blinkar i drift': 'Off at power-up, blinks in operation',
  Tänd: 'On',
  'Normalt tänd': 'Normally on',
  'Normalt släckt': 'Normally off',
};

export const LED_WHAT: Record<string, string> = {
  ...same('Blanking', 'Diagnostic', '+5 VDC'),
  '+12 VDC, switchkrets': '+12 VDC, switch circuit',
  'Hög/låg nätspänningssensor': 'High/low line-voltage sensor',
  '+5 VDC, digitalkrets': '+5 VDC, digital circuit',
  '+20 VDC, flasherkrets': '+20 VDC, flasher circuit',
  '+18 VDC, lampkrets': '+18 VDC, lamp circuit',
  '+12 VDC, kraftkrets (motorer, reläer)': '+12 VDC, power circuit (motors, relays)',
};

export const HINT: Record<string, string> = {
  'Bladswitch under jet-bumperns skirt. Justera bladgapet så att en lätt knuff på skirten stänger kontakten.':
    'Leaf switch under the jet bumper skirt. Adjust the blade gap so a light nudge on the skirt closes the contact.',
  'Bladswitchar bakom slingshot-gummit. Kontrollera gap och att bladen inte är brända.':
    'Leaf switches behind the slingshot rubber. Check the gap and that the blades are not burnt.',
  'Dedikerad switch på myntdörren.': 'Dedicated switch on the coin door.',
  'EOS (End of Stroke) på flippermekanismen under spelplanen. Kontaktgap 0,062" ±0,015" (ca 1,2–2 mm), justeras minst 0,25" (6 mm) från switchkroppen. Reservdelslistan anger SW-1A-194 (make) för de nedre flipprarna och SW-1A-193 för de övre; flippersidan i manualen listar bara SW-1A-193 för grundmodellen.':
    'EOS (End of Stroke) on the flipper mechanism under the playfield. Contact gap 0.062″ ± 0.015″ (about 1.2–2 mm), adjusted at least 0.25″ (6 mm) from the switch body (p. 2-16). The parts list gives SW-1A-194 (make) for the lower flippers and SW-1A-193 for the upper ones; the flipper page in the manual lists only SW-1A-193 for the base model. The sources disagree.',
  'Flipperknapp i kabinettsidan.': 'Flipper button in the cabinet side.',
  'Mikroswitch med arm. Kolla att bollen trycker ner armen hela vägen.':
    'Microswitch with an actuator arm. Check that the ball pushes the arm all the way down.',
  'Myntdörrs-/kabinettswitch. Dedikerad eller matris enligt tabellen.':
    'Coin door / cabinet switch. Dedicated or matrix according to the table.',
  'Optosensor (sändare + mottagare). Kolla +12V och jord till optokortet, och att inget blockerar strålen.':
    'Opto sensor (transmitter + receiver). Check +12 V and ground to the opto board, and that nothing blocks the beam.',
  'Rollover-switch med trådarm. Kolla att armen går fritt och att mikroswitchen klickar.':
    'Rollover switch with a wire actuator. Check that the wire moves freely and the microswitch clicks.',
  'Stationärt mål (target). Kolla att bladen sluter när målet träffas och att dioden är hel.':
    'Stationary target. Check that the blades close when the target is hit and that the diode is intact.',
  'Trough-switch. Om spelet tappar räkningen på bollar, kolla dessa först.':
    'Trough switch. If the game loses count of balls, check these first.',
};

/** Attribute text in the kit's handbook html (the menu map's submenu marker). */
export const HANDBOOK_ATTR: Record<string, string> = { 'Har undermeny': 'Has a submenu' };

export const COIL_NOTE: Record<string, string> = {
  'Magnetsäkring 5A S.B. sitter på undersidan av spelplanen.':
    'Magnet fuse 5A S.B. sits on the underside of the playfield.',
  'Flasher #6 (b ovanpå backboxen)': 'Flasher #6 (b on top of the backbox)',
  ...same('Flasher #1 (2)', 'Flasher #2 (2)', 'Flasher #3 (2)', 'Flasher #4', 'Flasher #5'),
};
