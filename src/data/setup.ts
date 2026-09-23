/**
 * The machine setup guide: what to set after a move or a reset, in the order it should be done.
 * Presets overwrite individual adjustments, so they come first. Values are the owner's choice for
 * an office machine on free play; the manual is linked per item for the printed options.
 *
 * Edit this file when the advice changes; the page and the stored values follow the ids.
 */
export interface SetupItem {
  /** Stable key for storage; the menu code where one exists (`A.1 26`), else a slug. */
  id: string;
  name: string;
  /** Suggested value, empty for a task that is only ticked off. */
  suggested: string;
  why: string;
  /** Handbook heading code to link, when it differs from `id`. Empty string: no link. */
  find?: string;
  /** Alternatives worth knowing about, shown as a small note. */
  alt?: string;
}

export interface SetupStep {
  id: string;
  title: string;
  /** Menu path as the machine shows it. */
  menu: string;
  intro: string;
  items: SetupItem[];
  /** Shown after the items, e.g. a follow-up utility to run. */
  after?: string;
}

export const SETUP_INTRO =
  'Navigate with Begin Test → Enter, Up/Down to scroll, Enter to change and save, Escape to back out. Presets overwrite individual adjustments, so take them first and adjust afterwards.';

export const FACTORY_RESET_WARNING =
  'Avoid U.8 Factory Reset. It clears everything on this page, including the custom message and the high score table.';

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'presets',
    title: 'Presets',
    menu: 'U. Utilities → U.9 Presets',
    intro: 'Install the presets first; every later step adjusts on top of them.',
    items: [
      {
        id: 'U.9 02',
        name: 'Install Easy',
        suggested: 'Install',
        why: 'Gentler for people who play now and then: more extra balls, easier locks, and Million Plus carries over between balls.',
        alt: 'For a harder game take U.9 03 Install Medium, the factory setting.',
      },
      {
        id: 'U.9 10',
        name: 'Install Novelty',
        suggested: 'Install',
        why: 'Removes every free-game award. Replays, match and high-score credits mean nothing on free play and only give a loud knock; specials score points instead.',
        alt: 'U.9 08 Install Add-A-Ball gives an extra ball for replays and specials instead. More fun for the player, longer games when there is a queue.',
      },
    ],
  },
  {
    id: 'freeplay',
    title: 'Free play',
    menu: 'A. Adjustments → A.3 Pricing',
    intro: 'No coins in the office.',
    items: [
      {
        id: 'A.3 17',
        name: 'Free Play',
        suggested: 'YES',
        why: 'Starts a game on the Start button without credits.',
      },
    ],
  },
  {
    id: 'standard',
    title: 'Standard adjustments',
    menu: 'A. Adjustments → A.1 Standard Adjustments',
    intro: 'Check each one; Novelty already sets some of them.',
    items: [
      { id: 'A.1 01', name: 'Balls Per Game', suggested: '3', why: 'Standard, right for a queue.' },
      {
        id: 'A.1 02',
        name: 'Tilt Warnings',
        suggested: '3',
        why: 'Forgiving without being limitless.',
      },
      {
        id: 'A.1 19',
        name: 'Match Feature',
        suggested: 'OFF',
        why: 'Novelty sets this; confirm it.',
      },
      {
        id: 'A.1 20',
        name: 'Custom Message',
        suggested: 'YES',
        why: 'Shows the message set in U.5.',
      },
      { id: 'A.1 21', name: 'Language', suggested: 'English', why: '' },
      { id: 'A.1 22', name: 'Clock Style', suggested: '24 Hours', why: '' },
      { id: 'A.1 23', name: 'Date Style', suggested: 'Date/Month/Year', why: '' },
      {
        id: 'A.1 25',
        name: 'Allow Dim Illumination',
        suggested: 'NO',
        why: 'The machine has an LED kit. WPC dims the GI by chopping the mains half-waves, and LEDs flicker at the dim levels. NO keeps the GI steady.',
        alt: 'With incandescent bulbs YES keeps the GI lighting effects.',
      },
      {
        id: 'A.1 26',
        name: 'Tournament Play',
        suggested: 'YES',
        why: 'Fair when several people play against each other: multiball and jackpots do not carry over to the next player.',
      },
      {
        id: 'A.1 27',
        name: 'Euro. Scr. Format',
        suggested: 'YES',
        why: '1.000.000 with dots.',
      },
      {
        id: 'A.1 28',
        name: 'Minimum Volume Control',
        suggested: 'YES',
        why: 'Lets the sound be turned all the way off, useful during meetings.',
      },
      {
        id: 'A.1 29',
        name: 'GI Power Saver',
        suggested: '15 minutes',
        why: 'Dims the lamps when nobody has played for a while.',
        alt: 'With LEDs the saving is small and the dimmed GI may flicker. OFF is fine if it bothers anyone.',
      },
      {
        id: 'A.1 30',
        name: 'Power Saver Level',
        suggested: '5–6',
        why: 'How far it dims (4–7).',
      },
    ],
  },
  {
    id: 'hstd',
    title: 'High score table',
    menu: 'A. Adjustments → A.4 H.S.T.D.',
    intro:
      'Make the table reachable for colleagues, then reset it so it starts from your backup scores.',
    items: [
      { id: 'A.4 01', name: 'Highest Scores', suggested: 'ON', why: '' },
      {
        id: 'A.4 03',
        name: 'Champion H.S.T.D.',
        suggested: 'ON',
        why: 'Grand Champion is shown in attract mode.',
      },
      {
        id: 'A.4 04',
        name: 'Credits for high scores (A.4 04–08)',
        suggested: '00',
        why: 'Novelty sets these; confirm all five.',
      },
      {
        id: 'A.4 09',
        name: 'High Score Reset Every',
        suggested: 'OFF',
        why: 'OFF for an eternal table, or e.g. 2 000 games if the list should start over now and then.',
      },
      {
        id: 'A.4 10',
        name: 'Backup scores (A.4 10–14)',
        suggested: 'Lower than standard',
        why: 'Set them lower than the defaults so colleagues stand a chance. Adjust after a few weeks when you see what people score.',
      },
    ],
    after: 'Then run U.3 Reset H.S.T.D. so the table starts from your backup scores.',
  },
  {
    id: 'h4',
    title: 'H-4 ROM adjustments',
    menu: 'A. Adjustments → A.2 Feature Adjustments, after A.2 26',
    intro:
      'The manual lists A.2 01–26 for an older ROM. H-4 has six more, found in the ROM string table; their numbers are not printed anywhere, so look them up on the display after A.2 26 and note the number you find in the field.',
    items: [
      {
        id: 'h4-amode-sound',
        name: 'A-MODE SOUND',
        suggested: 'OFF',
        why: 'Otherwise the game makes noise while standing unused in the office.',
        find: '',
      },
      {
        id: 'h4-amode-music',
        name: 'A-MODE MUSIC',
        suggested: 'OFF',
        why: 'Same reason as A-MODE SOUND.',
        find: '',
      },
      {
        id: 'h4-freeplay-message',
        name: 'FREEPLAY MESSAGE',
        suggested: 'ON',
        why: 'Shows FREE PLAY in attract mode.',
        find: '',
      },
      {
        id: 'h4-gameover-kickout',
        name: 'GAMEOVER KICKOUT',
        suggested: 'Try it',
        why: 'Probably about kicking locked balls out after the game. Test how it behaves.',
        find: '',
      },
      {
        id: 'A.2 20',
        name: 'Disable THING',
        suggested: 'NO',
        why: 'Set YES only temporarily if the Thing hand misbehaves; the game stays playable.',
      },
      {
        id: 'A.2 21',
        name: 'Disable BOOKCASE',
        suggested: 'NO',
        why: 'Set YES only temporarily if the bookcase misbehaves; the game stays playable.',
      },
    ],
  },
  {
    id: 'utilities',
    title: 'Utilities after the move',
    menu: 'U. Utilities',
    intro: 'Clock, message and the Thing Flips calibration.',
    items: [
      { id: 'U.4', name: 'Set Time & Date', suggested: 'Current', why: '' },
      {
        id: 'U.5',
        name: 'Custom Message',
        suggested: 'EDUCATION FIRST / PINBALL SECOND',
        why: 'Two rows of 16 characters per frame.',
      },
      {
        id: 'U.12',
        name: 'New Location',
        suggested: 'Run once',
        why: 'Resets the Thing Flips calibration after the move.',
      },
      {
        id: 'thing-1',
        name: 'Thing Flips: remove the glass',
        suggested: '',
        why: 'The game learns by itself over time; these steps speed it up.',
        find: 'Thing Flips',
      },
      {
        id: 'thing-2',
        name: 'Thing Flips: send the ball up the side ramp (Super Jackpot) 4 times',
        suggested: '',
        why: '',
        find: '',
      },
      {
        id: 'thing-3',
        name: 'Thing Flips: press the left return lane rollover (Lite Thing Flips), then send the ball up the centre ramp. Thing tries to shoot for the swamp.',
        suggested: '',
        why: '',
        find: '',
      },
      {
        id: 'thing-4',
        name: 'Thing Flips: repeat the previous step at least 30 times',
        suggested: '',
        why: 'It should hit around 40 %, and 50–60 % after several hundred tries.',
        find: '',
      },
    ],
  },
  {
    id: 'upkeep',
    title: 'Upgrades and upkeep',
    menu: 'Power off, playfield up',
    intro:
      'Not menu settings, but the same kind of note: tick when done and the date is kept on this device. The first round of parts was ordered in September 2026.',
    items: [
      {
        id: 'led-kit',
        name: 'LED kit fitted, playfield and backbox',
        suggested: '',
        why: 'Then set A.1 25 Allow Dim Illumination to NO in step 3 so the GI does not flicker.',
        find: '',
      },
      {
        id: 'flipper-links',
        name: 'Flipper plungers and links replaced, A-10656 × 4',
        suggested: '',
        why: 'One per flipper: lower left, lower right, upper left, upper right. Check the coil stops and bushings while the flippers are open.',
        find: '',
      },
      {
        id: 'rubber-kit',
        name: 'Rubber kit fitted, red flipper rubbers and black rings',
        suggested: '',
        why: '',
        find: '',
      },
      {
        id: 'ramp-decals',
        name: 'Ramp covers, bookcase decals and Thing decal fitted',
        suggested: '',
        why: 'The ramp covers protect the plastic flaps at the ramp entrances, which crack first on this game.',
        find: '',
      },
      {
        id: 'batteries',
        name: 'Three AA batteries on the CPU board replaced',
        suggested: '',
        why: 'Fresh batteries hold the settings on this page for a few years, but replace them yearly and look at the holder for corrosion. NVRAM only if it starts to corrode. Tick again each time; the date shows here.',
        find: '',
      },
    ],
    after:
      'Later, only if needed: pinballs (a six-pack is about 300 kr; the four magnets magnetise them and they pick up grit), NVRAM if the battery holder corrodes, hole protectors at the Chair and Swamp kickouts if the wear there grows.',
  },
];

export const SETUP_ITEM_COUNT = SETUP_STEPS.reduce((n, s) => n + s.items.length, 0);
