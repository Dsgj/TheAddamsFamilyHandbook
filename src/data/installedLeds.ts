/**
 * The LEDs installed in this machine, an owner overlay keyed `lamp:<matrix number>` like the
 * other overlays. Transcribed from the lamp-location sheet that came with the Super Brite Kit;
 * the kit's data never carries this, so it lives here and not in `src/data/kit`. The kit plugin
 * folds it into `Lamp.led`, and the build stops on a key that names no lamp in use.
 *
 * The strings are the kit's own names (base, colour, type), which is what you order
 * when one fails. Lamps 41 and 76 are not used and have no entry.
 */
export const LED_KIT_SOURCE = 'Super Brite Kit, The Quick Shopping Cart Team (lamp-location sheet)';

export const INSTALLED_LEDS: Record<string, string> = {
  // Column 1
  'lamp:11': '555 Warm Super',
  'lamp:12': '555 Orange Super',
  'lamp:13': '555 Red Super',
  'lamp:14': '44 Blue Super Flex',
  'lamp:15': '44 Orange Super Flex',
  'lamp:16': '44 Red HP',
  'lamp:17': '44 Blue Super Flex',
  'lamp:18': '44 Orange Super',
  // Column 2
  'lamp:21': '555 Red 4+1',
  'lamp:22': '555 Cool 4+1',
  'lamp:23': '555 Blue 4+1',
  'lamp:24': '555 Yellow 4+1',
  'lamp:25': '555 Orange 4+1',
  'lamp:26': '555 Cool Super',
  'lamp:27': '555 Cool Super',
  'lamp:28': '555 Orange Super',
  // Column 3
  'lamp:31': '555 Cool Super',
  'lamp:32': '555 Cool Super',
  'lamp:33': '555 Cool Super',
  'lamp:34': '555 Cool Super',
  'lamp:35': '555 Cool Super',
  'lamp:36': '555 Orange Super',
  'lamp:37': '555 Orange Super',
  'lamp:38': '555 Orange Super',
  // Column 4 (41 not used)
  'lamp:42': '44 Cool Super',
  'lamp:43': '44 Blue Super Flex',
  'lamp:44': '44 Blue Super Flex',
  'lamp:45': '44 Orange Super',
  'lamp:46': '44 Orange Super',
  'lamp:47': '555 Red Frosted',
  'lamp:48': '44 Blue Super Flex',
  // Column 5
  'lamp:51': '555 Green Super',
  'lamp:52': '555 Warm Super',
  'lamp:53': '555 Red Super',
  'lamp:54': '555 Cool Super',
  'lamp:55': '555 Green Super',
  'lamp:56': '555 Orange Super',
  'lamp:57': '555 Warm Super',
  'lamp:58': '555 Warm Super',
  // Column 6
  'lamp:61': '44 Red Super',
  'lamp:62': '44 Orange 4+1',
  'lamp:63': '44 Cool Super',
  'lamp:64': '555 Yellow Frosted',
  'lamp:65': '44 Red Super',
  'lamp:66': '44 Cool Super',
  'lamp:67': '555 Warm Super',
  'lamp:68': '555 Cool Super',
  // Column 7 (76 not used)
  'lamp:71': '44 Cool Super',
  'lamp:72': '44 Red Super',
  'lamp:73': '44 Orange Flex',
  'lamp:74': '555 Green Frosted',
  'lamp:75': '555 Red Frosted',
  'lamp:77': '555 Yellow Frosted',
  'lamp:78': '555 Green Frosted',
  // Column 8
  'lamp:81': '555 Warm Super',
  'lamp:82': '555 Warm Super',
  'lamp:83': '555 Warm Super',
  'lamp:84': '555 Warm Super',
  'lamp:85': '555 Warm Super',
  'lamp:86': '555 Warm Super',
  'lamp:87': '555 Warm Super',
  'lamp:88': '555 Warm Super',
};

export interface InstalledFlasher {
  where: string;
  led: string;
}

/** The flasher LEDs from the same kit, as the sheet groups them. */
export const INSTALLED_FLASHERS: InstalledFlasher[] = [
  { where: 'Under playfield, 19a and 19b', led: '2 × 906 White' },
  { where: 'Domes', led: '4 × 906 White' },
  { where: 'Domes', led: '3 × 906 Red' },
  { where: 'Cloud topper', led: '3 × Blue' },
  { where: 'Power', led: '3 × Orange' },
];
