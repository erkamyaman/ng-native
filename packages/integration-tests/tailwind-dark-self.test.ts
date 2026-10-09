/**
 * `dark:` on the view that wears `dark` itself, through both presets and the real CLI.
 *
 * The Variants page tells an app with its own theme switch to put `dark` on its own root view.
 * With the variant written as `.dark &`, that root's own `dark:bg-zinc-950` never applied, since
 * a view is not beneath itself. Tailwind's class-based dark mode, `&:where(.dark, .dark *)`,
 * matches the element and everything inside it, at no extra specificity.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type StyleSheet } from '@ng-native/fabric';
import { createFakeFabric } from '@ng-native/testing';
import { build, buildV3, committedProps } from './tailwind-cli.ts';

const require = createRequire(import.meta.url);
const { flattenTailwind } = require('@ng-native/tailwind') as {
  flattenTailwind(css: string): string;
};
const { compileCss } = require('@ng-native/metro/css/compile.cjs') as {
  compileCss(css: string, context: string, options: object): StyleSheet;
};

const sheetOf = (css: string) =>
  compileCss(flattenTailwind(css), 'tailwind', { onUnsupported: () => {} });

/** A view wearing `outer` under the root, around a child wearing `inner`: both paddingTops. */
function paddings(sheet: StyleSheet, outer: string, inner: string) {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: sheet });
  const parent = engine.createElement('view');
  const child = engine.createElement('view');
  engine.setClasses(parent, outer);
  engine.setClasses(child, inner);
  engine.appendChild(engine.root, parent);
  engine.appendChild(parent, child);
  engine.commit();
  return [committedProps(fabric, parent), committedProps(fabric, child)].map(
    (props) => props['paddingTop'],
  );
}

for (const [name, css] of [
  ['Tailwind 4', () => build('native', 'dark pt-1 dark:pt-5')],
  ['Tailwind 3', () => buildV3('dark pt-1 dark:pt-5')],
] as const) {
  describe(`dark: with ${name}`, () => {
    let sheet: StyleSheet;
    before(() => {
      sheet = sheetOf(css());
    });

    it('applies to the view that wears dark, and to the one inside it', () => {
      assert.deepEqual(paddings(sheet, 'dark pt-1 dark:pt-5', 'pt-1 dark:pt-5'), [20, 20]);
    });

    it('wins over the plain utility whichever order the classes are written in', () => {
      assert.deepEqual(paddings(sheet, 'dark:pt-5 pt-1 dark', 'dark:pt-5 pt-1'), [20, 20]);
    });

    it('does nothing with no dark on the view or above it', () => {
      assert.deepEqual(paddings(sheet, 'pt-1 dark:pt-5', 'dark:pt-5 pt-1'), [4, 4]);
    });
  });
}
