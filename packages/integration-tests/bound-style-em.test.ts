/**
 * An `em` in a bound style declaration: `[style.width]="'2em'"`.
 *
 * A stylesheet's `em` is measured against the font size in scope. A bound one reached native as
 * the text `'2em'`, which native drops, so the view had no width at all.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Type } from '@angular/core';
import { cleanup, render, settle } from '@ng-native/testing';
import { compileFixture } from './compile.ts';

interface Em {
  font: { set(value: number | undefined): void };
  width: { set(value: string | number | undefined): void };
}
let app: Awaited<ReturnType<typeof render<Em>>>;
const props = (id: string) => app.getByTestId(id).props;

before(async () => {
  const mod = await compileFixture('fixtures/bound-style-em.ts');
  app = await render(mod['BoundEm'] as Type<Em>);
});

after(cleanup);

describe('an em in a bound style declaration', () => {
  it('is 16 points to the em where no font size is in scope', () => {
    assert.equal(props('plain')['width'], 32);
    assert.equal(props('plain')['height'], 32);
  });

  it("is measured against the element's own font size", () => {
    assert.equal(props('own')['width'], 20);
  });

  it('is measured against the font size it inherits', () => {
    assert.equal(props('inherited')['width'], 40);
  });

  it('measures a font size against the one inherited, and the rest against that', () => {
    assert.equal(props('font')['fontSize'], 30);
    assert.equal(props('font')['width'], 60);
  });

  it('is read in a style object too', () => {
    assert.equal(props('object')['width'], 8);
    assert.equal(props('object')['marginTop'], 16);
  });

  it('never reaches native as text', () => {
    for (const id of ['plain', 'own', 'inherited', 'font', 'follows', 'switching', 'object']) {
      const sent = Object.values(props(id)).filter((value) => /em$/.test(String(value)));
      assert.deepEqual(sent, [], id);
    }
  });

  it('follows the inherited font size when it changes, and when it goes', async () => {
    assert.equal(props('follows')['width'], 24);
    app.instance.font.set(15);
    await settle();
    assert.equal(props('follows')['width'], 30);
    app.instance.font.set(undefined);
    await settle();
    assert.equal(props('follows')['width'], 32, 'the 16 an em falls back to');
    app.instance.font.set(12);
    await settle();
    assert.equal(props('follows')['width'], 24);
  });

  it('gives way to a written value, and to none at all', async () => {
    assert.equal(props('switching')['width'], 48);
    app.instance.width.set(10);
    await settle();
    assert.equal(props('switching')['width'], 10);
    app.instance.width.set('1em');
    await settle();
    assert.equal(props('switching')['width'], 16);
    app.instance.width.set(undefined);
    await settle();
    assert.equal(props('switching')['width'] ?? undefined, undefined);
  });
});
