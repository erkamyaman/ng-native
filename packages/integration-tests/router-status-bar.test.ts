/**
 * The app's status bar claim on Android, where react-native-screens sets the bar again each time
 * a screen appears: from the screen's own `statusBarStyle` and `statusBarHidden`, or, with none,
 * to light text and shown. So the claim rides on every screen without its own, and a screen that
 * has its own keeps it.
 */
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Type } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { ColorScheme, StatusBar, type Scheme, type StatusBarSource } from '@ng-native/device';
import { cleanup, render, settle, type FakeFabric, type FakeFabricNode } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

function flatten(nodes: FakeFabricNode[]): FakeFabricNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

async function idle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await settle();
}

const quiet = { setStyle() {}, setHidden() {}, setBackgroundColor() {}, setTranslucent() {} };

describe("the app's status bar claim on each screen", () => {
  let mod: Record<string, unknown>;
  let fabric: FakeFabric;
  let bar: StatusBar;
  let nav: NativeNavigation;
  let router: Router;
  let switchTo: (scheme: Scheme) => Promise<void>;

  /** The committed status bar props of each screen in the stack, bottom first. */
  const screens = () =>
    flatten(fabric.committed)
      .filter((node) => node.viewName === 'RNSScreen')
      .map((node) => ({
        style: node.props['statusBarStyle'] ?? undefined,
        hidden: node.props['statusBarHidden'] ?? undefined,
      }));

  const boot = async (screensSetBar: boolean) => {
    let scheme: Scheme = 'light';
    const listeners = new Set<(scheme: Scheme) => void>();
    const source: StatusBarSource = { ...quiet, height: undefined, screensSetBar };
    const app = await render(mod['Shell'] as Type<unknown>, {
      providers: [
        provideNativeRouter(mod['routes'] as Routes),
        { provide: StatusBar.SOURCE, useValue: source },
        {
          provide: ColorScheme.SOURCE,
          useValue: {
            current: () => scheme,
            subscribe: (listener: (next: Scheme) => void) => (
              listeners.add(listener),
              () => listeners.delete(listener)
            ),
          },
        },
      ],
    });
    switchTo = async (next) => {
      scheme = next;
      listeners.forEach((listener) => listener(next));
      await idle();
    };
    fabric = app.fabric;
    bar = app.componentRef.injector.get(StatusBar);
    nav = app.componentRef.injector.get(NativeNavigation);
    router = app.componentRef.injector.get(Router);
    await idle();
  };

  before(async () => {
    mod = await compileFixture('fixtures/status-bar-screens.ts');
  });

  afterEach(() => cleanup());

  describe('on Android', () => {
    beforeEach(() => boot(true));

    it("puts the app's style back on the screen in front after a light screen pops", async () => {
      bar.set({ style: 'auto' });
      await nav.push('/photo', { presentation: { statusBarStyle: 'light' } });
      await idle();
      assert.deepEqual(
        screens().map((one) => one.style),
        ['dark', 'light'],
        'the pushed screen keeps its own style',
      );

      nav.back();
      await idle();
      assert.equal(router.url, '/');
      assert.deepEqual(
        screens().map((one) => one.style),
        ['dark'],
      );
      await nav.push('/list');
      await idle();
      assert.deepEqual(
        screens().map((one) => one.style),
        ['dark', 'dark'],
        'a screen with no style of its own carries the claim, not the light fallback',
      );
    });

    it('keeps a hidden claim on every screen without its own', async () => {
      const show = bar.push({ hidden: true });
      await nav.push('/list');
      await idle();
      assert.deepEqual(
        screens().map((one) => one.hidden),
        [true, true],
      );

      show();
      await idle();
      assert.deepEqual(
        screens().map((one) => one.hidden),
        [undefined, undefined],
        'dropping the claim takes it off every screen',
      );
    });

    it('follows the claim as it changes and drops it when it goes', async () => {
      bar.set({ style: 'auto' });
      await nav.push('/list');
      await idle();
      const claim = bar.push({ style: 'light' });
      await idle();
      assert.deepEqual(
        screens().map((one) => one.style),
        ['light', 'light'],
      );

      claim();
      await idle();
      await switchTo('dark');
      assert.deepEqual(
        screens().map((one) => one.style),
        ['light', 'light'],
        "an 'auto' claim follows the color scheme",
      );

      bar.set({});
      await idle();
      assert.deepEqual(
        screens().map((one) => one.style),
        [undefined, undefined],
      );
    });

    it("leaves a page's own host bindings alone", async () => {
      bar.set({ style: 'auto', hidden: false });
      await nav.push('/video');
      await idle();
      assert.deepEqual(screens().at(-1), { style: 'light', hidden: true });

      bar.set({ style: 'light', hidden: false });
      await idle();
      bar.set({ style: 'dark', hidden: false });
      await idle();
      assert.deepEqual(screens(), [
        { style: 'dark', hidden: false },
        { style: 'light', hidden: true },
      ]);
    });
  });

  it('puts nothing on a screen where screens leave the bar alone', async () => {
    await boot(false);
    bar.set({ style: 'dark', hidden: true });
    await nav.push('/list');
    await idle();
    assert.deepEqual(screens(), [
      { style: undefined, hidden: undefined },
      { style: undefined, hidden: undefined },
    ]);
  });
});
