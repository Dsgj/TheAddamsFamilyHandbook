import type { Plugin } from 'vitest/config';
import { COMPONENT_FUSES, COMPONENT_NOTES, COMPONENT_WIRES } from '../../data/ownerNotes';
import { translateKit } from './translate';

/*
 * Translates the kit's components.json to the app's English model when Vite loads it (build, dev
 * and vitest, which reads astro.config.ts through getViteConfig), so the module every importer gets
 * is the English one and the Swedish never reaches a page or an island. Runs before Vite's JSON
 * plugin and hands it JSON. The overlays and en.ts are read when the config loads: restart
 * `astro dev` after editing src/data/ownerNotes.ts or src/lib/data/en.ts.
 */

const KIT_COMPONENTS = /[\\/]src[\\/]data[\\/]kit[\\/]components\.json(\?.*)?$/;

export function kitPlugin(): Plugin {
  return {
    name: 'valvet-kit-components',
    enforce: 'pre',
    transform(code, id) {
      if (!KIT_COMPONENTS.test(id)) return null;
      const english = translateKit(
        JSON.parse(code),
        COMPONENT_NOTES,
        COMPONENT_FUSES,
        COMPONENT_WIRES,
      );
      return { code: JSON.stringify(english), map: null };
    },
  };
}
