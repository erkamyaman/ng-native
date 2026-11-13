/**
 * Writes the Taiga UI icons the app draws, from `@taiga-ui/icons`, into `src/theme/taiga-icons.ts`
 * as their markup, for `tuiIconsProvider()` to give Taiga as `data:` URLs.
 *
 * Taiga draws an icon as a mask of `assets/taiga-ui/icons/<name>.svg`, which a browser fetches from
 * the server the page came from. A device has none, so the app bundles the SVGs it uses instead.
 * Run it (`pnpm icons`) after adding an icon to `ICONS` or changing the `@taiga-ui/icons` version
 * in package.json. It fails rather than writing icons from a version package.json does not pin.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** The icons the screen and Taiga's own components in it draw, by the name Taiga gives each. */
const ICONS = [
  // A checkbox's tick, and the dash of one that is neither: TUI_CHECKBOX_OPTIONS.
  'check',
  'minus',
  // An accordion's and a dropdown's chevron: TUI_CHEVRON.
  'chevron-down',
  // A notification's symbol, by its appearance, and the cross that closes one.
  'info',
  'circle-check',
  'circle-alert',
  'circle-x',
  'x',
  // The screen's own.
  'credit-card',
];

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const pinned = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).dependencies[
  '@taiga-ui/icons'
];
const installed = require('@taiga-ui/icons/package.json').version;
if (installed !== pinned) {
  throw new Error(
    `@taiga-ui/icons ${installed} is installed, but package.json pins ${pinned}: run pnpm install.`,
  );
}

const folder = join(dirname(require.resolve('@taiga-ui/icons/package.json')), 'src');
const entries = ICONS.map((name) => {
  // Each attribute on a line of its own, as the package writes them: one line of markup.
  const markup = readFileSync(join(folder, `${name}.svg`), 'utf8')
    .replace(/\s+/g, ' ')
    .trim();
  return `  '@tui.${name}': ${JSON.stringify(markup)},`;
});

writeFileSync(
  new URL('src/theme/taiga-icons.ts', root),
  `/** Taiga UI's icons the app draws, from @taiga-ui/icons ${installed}, written by ` +
    `scripts/build-icons.mjs. Do not edit: run pnpm icons. */\n` +
    `export const TAIGA_ICONS: Readonly<Record<string, string>> = {\n${entries.join('\n')}\n};\n`,
);
console.log(`src/theme/taiga-icons.ts: ${ICONS.length} icons from @taiga-ui/icons ${installed}`);
