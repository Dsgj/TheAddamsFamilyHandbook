/**
 * The LEDs installed in this machine, keyed by lamp-matrix number (the same ids as
 * `components.json` lamps). Transcribed from the lamp-location sheet that came with the
 * Super Brite Kit; the kit's data never carries this, so it lives here and not in `src/data/kit`.
 *
 * The strings are the kit's own names (base, colour, type), which is what you order
 * when one fails. Lamps 41 and 76 are not used and have no entry.
 */
export const LED_KIT_SOURCE = 'Super Brite Kit, The Quick Shopping Cart Team (lamp-location sheet)';

export const INSTALLED_LEDS: Record<string, string> = {
  // Column 1
  '11': '555 Warm Super',
  '12': '555 Orange Super',
  '13': '555 Red Super',
  '14': '44 Blue Super Flex',
  '15': '44 Orange Super Flex',
  '16': '44 Red HP',
  '17': '44 Blue Super Flex',
  '18': '44 Orange Super',
  // Column 2
  '21': '555 Red 4+1',
  '22': '555 Cool 4+1',
  '23': '555 Blue 4+1',
  '24': '555 Yellow 4+1',
  '25': '555 Orange 4+1',
  '26': '555 Cool Super',
  '27': '555 Cool Super',
  '28': '555 Orange Super',
  // Column 3
  '31': '555 Cool Super',
  '32': '555 Cool Super',
  '33': '555 Cool Super',
  '34': '555 Cool Super',
  '35': '555 Cool Super',
  '36': '555 Orange Super',
  '37': '555 Orange Super',
  '38': '555 Orange Super',
  // Column 4 (41 not used)
  '42': '44 Cool Super',
  '43': '44 Blue Super Flex',
  '44': '44 Blue Super Flex',
  '45': '44 Orange Super',
  '46': '44 Orange Super',
  '47': '555 Red Frosted',
  '48': '44 Blue Super Flex',
  // Column 5
  '51': '555 Green Super',
  '52': '555 Warm Super',
  '53': '555 Red Super',
  '54': '555 Cool Super',
  '55': '555 Green Super',
  '56': '555 Orange Super',
  '57': '555 Warm Super',
  '58': '555 Warm Super',
  // Column 6
  '61': '44 Red Super',
  '62': '44 Orange 4+1',
  '63': '44 Cool Super',
  '64': '555 Yellow Frosted',
  '65': '44 Red Super',
  '66': '44 Cool Super',
  '67': '555 Warm Super',
  '68': '555 Cool Super',
  // Column 7 (76 not used)
  '71': '44 Cool Super',
  '72': '44 Red Super',
  '73': '44 Orange Flex',
  '74': '555 Green Frosted',
  '75': '555 Red Frosted',
  '77': '555 Yellow Frosted',
  '78': '555 Green Frosted',
  // Column 8
  '81': '555 Warm Super',
  '82': '555 Warm Super',
  '83': '555 Warm Super',
  '84': '555 Warm Super',
  '85': '555 Warm Super',
  '86': '555 Warm Super',
  '87': '555 Warm Super',
  '88': '555 Warm Super',
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
