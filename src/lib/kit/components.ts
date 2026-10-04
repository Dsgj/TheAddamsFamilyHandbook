import components from '~/data/kit/components.json';
import type { Components } from '~/lib/model/types';

/*
 * The kit's component data in the app's English model. src/build/kit-plugin.ts translates the JSON
 * when Vite loads it, so the import's type (the raw kit shape) is not the module's value: hence the
 * cast.
 * One of the three files that may import src/data/kit (structure lint, tests/unit/structure.test.ts).
 */
export const COMPONENTS = components as unknown as Components;

if (!COMPONENTS.fuses.every((f) => typeof f.key === 'string')) {
  throw new Error('kit plugin did not run on components.json');
}
