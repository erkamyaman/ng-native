import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Type } from '@angular/core';
import { ColorScheme, type Scheme } from '@ng-native/device';
import { cleanup, render } from '@ng-native/testing';
import { compileSource } from './compile.ts';

interface GuideTheme {
  readonly className: () => string;
  choose(preference: 'light' | 'dark' | 'system'): void;
}

function themeExample(markdown: string): string {
  const blocks = [...markdown.matchAll(/```ts\n([\s\S]*?)\n```/g)].map((match) => match[1]!);
  const block = blocks.find((source) => source.includes('export class Theme'));
  assert.ok(block, 'no ts block declaring Theme in the theming guide');
  return block;
}

describe("the theming guide's Theme service, extracted and compiled for real", () => {
  let Theme: Type<GuideTheme>;
  let Harness: Type<unknown>;

  before(async () => {
    const markdown = readFileSync(
      fileURLToPath(
        new URL('../../apps/documentation/src/content/guide/theming.md', import.meta.url),
      ),
      'utf8',
    );
    const file = fileURLToPath(new URL('./fixtures/theming-guide.ts', import.meta.url));
    const out = fileURLToPath(new URL('./fixtures/theming-guide.generated.ts', import.meta.url));
    const mod = await compileSource(themeExample(markdown), file, out);
    Theme = mod['Theme'] as Type<GuideTheme>;

    const harness = await compileSource(
      "import { Component } from '@angular/core';\n" +
        "@Component({ selector: 'theming-guide-harness', template: '' })\n" +
        'export class Harness {}\n',
      fileURLToPath(new URL('./fixtures/theming-guide-harness.ts', import.meta.url)),
      fileURLToPath(new URL('./fixtures/theming-guide-harness.generated.ts', import.meta.url)),
    );
    Harness = harness['Harness'] as Type<unknown>;
  });

  afterEach(() => cleanup());

  async function theme(system: Scheme) {
    const listeners = new Set<(scheme: Scheme) => void>();
    const { componentRef } = await render(Harness, {
      providers: [
        {
          provide: ColorScheme.SOURCE,
          useValue: {
            current: () => system,
            subscribe: (listener: (scheme: Scheme) => void) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          },
        },
      ],
    });
    const turn = (scheme: Scheme) => listeners.forEach((listener) => listener(scheme));
    return { theme: componentRef.injector.get(Theme), turn };
  }

  it('follows the system until a preference is chosen', async () => {
    const { theme: t, turn } = await theme('light');
    assert.equal(t.className(), '');
    turn('dark');
    assert.equal(t.className(), 'dark');
  });

  it('keeps a chosen preference over the system, and follows it again for system', async () => {
    const { theme: t } = await theme('dark');
    t.choose('light');
    assert.equal(t.className(), '');
    t.choose('system');
    assert.equal(t.className(), 'dark');
  });
});
