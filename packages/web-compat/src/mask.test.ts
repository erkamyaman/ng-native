/**
 * A box with a mask, as an icon library draws an icon: `background: currentColor` under
 * `mask-image: url(icon.svg)`, drawn as the SVG's shapes in that colour (see `mask.ts`). Where
 * each is placed is held to Chrome in `packages/integration-tests/web-compat-mask.test.ts`; this
 * is what comes and goes: a mask taken away, a token that names one, and the SVGs fetched.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Component, signal } from '@angular/core';
import { cleanup, compileCss, render, screen, settle } from '@ng-native/testing';
import { provideWebCompat } from './index.ts';

const SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">' +
  '<rect width="10" height="10" fill="black" /></svg>';
const DATA = `data:image/svg+xml,${encodeURIComponent(SQUARE)}`;
const BASE64 = `data:image/svg+xml;base64,${Buffer.from(SQUARE).toString('base64')}`;

const SHEET =
  '.icon { width: 10px; height: 10px; background: rgb(0, 128, 0); mask-repeat: no-repeat }' +
  '.icon { mask-image: var(--icon) } .bare { mask-image: none }';

@Component({
  template: `
    <div testID="a" [class]="classes()" [style.--icon]="icon()"></div>
    <div testID="b" class="icon" [style.--icon]="icon()"></div>
  `,
})
class Icons {
  readonly classes = signal('icon');
  readonly icon = signal<string | null>(`url(${DATA})`);
}

afterEach(cleanup);

const icons = async () => {
  const app = await render(Icons, {
    providers: [provideWebCompat({ url: 'https://shop.example/app/' })],
    globalStyles: compileCss(SHEET, 'library', { generated: true } as never),
  });
  await arrived();
  return app;
};

/** Whatever is fetched has arrived, and is drawn. */
async function arrived(): Promise<void> {
  await settle();
  await new Promise((done) => setTimeout(done, 5));
  await settle();
}

/** What a box draws of its mask: the paint of the drawing's shape, or nothing. */
function drawn(id: string): unknown {
  const box = screen.getByTestId(id);
  const svg = box.children[0]?.children[0]?.children[0];
  if (svg?.viewName !== 'RNSVGSvgView') return undefined;
  return (svg.children[0]?.props['fill'] as { payload?: unknown } | undefined)?.payload;
}

/** Answer a fetch of each URL from `answers`, noting what is asked; one not there never comes. */
function fetching(answers: Record<string, () => Promise<unknown>>) {
  const asked: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = ((url: string) => {
    asked.push(String(url));
    return answers[url]?.() ?? new Promise(() => {});
  }) as never;
  return { asked, restore: () => void (globalThis.fetch = real) };
}

const found = (text: string) => () =>
  Promise.resolve({ ok: true, text: () => Promise.resolve(text) });

describe('a box with a mask', () => {
  it('is its SVG in the colour of its background, which the box does not paint', async () => {
    await icons();
    assert.equal(drawn('a'), 'rgb(0, 128, 0)');
    assert.equal(screen.getByTestId('a').props['backgroundColor'] ?? undefined, undefined);
  });

  it('paints its own background again once its mask is none, and draws nothing', async () => {
    const app = await icons();
    app.instance.classes.set('icon bare');
    await arrived();
    assert.equal(screen.getByTestId('a').children.length, 0);
    assert.equal(screen.getByTestId('a').props['backgroundColor'], 'rgb(0, 128, 0)');
    app.instance.classes.set('icon');
    await arrived();
    assert.equal(drawn('a'), 'rgb(0, 128, 0)');
  });

  it('follows the token its image is bound to, a data URL in base 64 as well', async () => {
    const app = await icons();
    app.instance.icon.set(`url("${BASE64}")`);
    await arrived();
    assert.equal(drawn('a'), 'rgb(0, 128, 0)');
    // No icon: the token's initial value, which is no image.
    app.instance.icon.set(null);
    await arrived();
    assert.equal(drawn('a'), undefined);
  });

  it('fetches an SVG by its URL against the page, once for every box that names it', async () => {
    const net = fetching({ 'https://shop.example/app/icons/check.svg': found(SQUARE) });
    try {
      const app = await icons();
      app.instance.icon.set('url(icons/check.svg)');
      await arrived();
      assert.deepEqual(net.asked, ['https://shop.example/app/icons/check.svg']);
      assert.equal(drawn('a'), 'rgb(0, 128, 0)');
      assert.equal(drawn('b'), 'rgb(0, 128, 0)');
    } finally {
      net.restore();
    }
  });

  it('asks again for an SVG that was not found, and draws nothing for one that is no SVG', async () => {
    let missing = true;
    const net = fetching({
      'https://shop.example/app/late.svg': () =>
        missing ? Promise.resolve({ ok: false, text: () => Promise.resolve('') }) : found(SQUARE)(),
      'https://shop.example/app/photo.png': found('not a drawing'),
    });
    const warned: unknown[] = [];
    const warn = console.warn;
    console.warn = (...args: unknown[]) => void warned.push(args.join(' '));
    try {
      const app = await icons();
      app.instance.icon.set('url(late.svg)');
      await arrived();
      assert.equal(drawn('a'), undefined);
      missing = false;
      app.instance.icon.set('url( "late.svg" )');
      await arrived();
      assert.equal(drawn('a'), 'rgb(0, 128, 0)');
      assert.deepEqual(net.asked, [
        'https://shop.example/app/late.svg',
        'https://shop.example/app/late.svg',
      ]);
      app.instance.icon.set('url(photo.png)');
      await arrived();
      assert.equal(drawn('a'), undefined);
      assert.ok(warned.some((each) => String(each).includes('photo.png')));
    } finally {
      console.warn = warn;
      net.restore();
    }
  });

  it('fetches again in the next app, which keeps none of what the last one fetched', async () => {
    const net = fetching({ 'https://shop.example/app/check.svg': found(SQUARE) });
    try {
      const first = await icons();
      first.instance.icon.set('url(check.svg)');
      await arrived();
      cleanup();
      const second = await icons();
      second.instance.icon.set('url(check.svg)');
      await arrived();
      assert.equal(net.asked.length, 2);
    } finally {
      net.restore();
    }
  });
});
