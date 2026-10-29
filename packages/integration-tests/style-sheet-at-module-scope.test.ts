/**
 * A component's sheet read at the top level of the module that declares it, as a library does
 * when it exports its global sheet: `export const themeStyles = styleSheetOf(ThemeStyles)`. The
 * module's own code runs as it loads, so the sheet has to be on the class by then, in a release
 * build and in a development one.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { Type } from '@angular/core';
import { cleanup, render, type FakeFabricNode } from '@ng-native/testing';
import { compileSource } from './compile.ts';

const flatten = (nodes: FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const SOURCE = `
import { Component } from '@angular/core';
import { View } from '../components/src/view.ts';
import { styleSheetOf } from '../fabric/src/css.ts';

@Component({ selector: 'lib-theme-styles', template: '', styleUrls: ['./tokens.css'] })
export class ThemeStyles {}

export const themeStyles = styleSheetOf(ThemeStyles);

@Component({
  selector: 'x-swatch',
  imports: [View],
  template: '<view class="swatch"></view>',
  styles: ['.swatch { background-color: var(--brand); width: 10px }'],
})
export default class Swatch {}

export const swatchStyles = styleSheetOf(Swatch);
`;

describe('a sheet read at the top level of its own module', () => {
  afterEach(cleanup);

  for (const dev of [false, true]) {
    it(`is the compiled sheet in a ${dev ? 'development' : 'release'} build`, async () => {
      // The stylesheet sits beside the source, which is read from where it is; the output goes
      // here, where its imports resolve.
      const dir = mkdtempSync(path.join(import.meta.dirname, '.module-scope-'));
      const hmr = globalThis.__angularNativeHmr;
      try {
        writeFileSync(path.join(dir, 'tokens.css'), ':root { --brand: rgb(1, 2, 3); }\n');
        const file = path.join(dir, 'theme.ts');
        const mod = await compileSource(
          SOURCE.replaceAll("'../", "'../../"),
          file,
          path.join(dir, 'theme.generated.ts'),
          { dev },
        );

        const ThemeStyles = mod['ThemeStyles'] as Record<string, unknown>;
        const Swatch = mod['default'] as Record<string, unknown>;
        assert.ok(mod['themeStyles'], 'the global sheet, read as the module loaded');
        assert.equal(mod['themeStyles'], ThemeStyles['ɵnativeStyles']);
        assert.ok(mod['swatchStyles'], 'a default-exported component, after another');
        assert.equal(mod['swatchStyles'], Swatch['ɵnativeStyles']);

        // What the report saw: the global sheet handed to mount() as it was exported, and a
        // token from it reaching the component that reads it.
        const { fabric } = await render(Swatch as unknown as Type<unknown>, {
          globalStyles: mod['themeStyles'] as never,
        });
        const swatch = flatten(fabric.committed).find((node) => node.props['width'] === 10);
        assert.equal(swatch?.props['backgroundColor'], 'rgb(1, 2, 3)');
      } finally {
        rmSync(dir, { recursive: true, force: true });
        if (hmr === undefined) delete globalThis.__angularNativeHmr;
        else globalThis.__angularNativeHmr = hmr;
      }
    });
  }
});

declare global {
  var __angularNativeHmr: unknown;
}
