/**
 * Keeping a field clear of the keyboard in a sheet, and under a navigation bar.
 *
 * On iOS, React Native measures a view in a presented sheet from the sheet's own top, which the
 * shadow tree never hears of, while the keyboard's `screenY` counts from the top of the screen. A
 * sheet attached to the bottom of the screen starts the window's height less its own height down.
 * And a scroll view under a bar rests scrolled above zero, by the inset the bar adds.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { Keyboard, type KeyboardMetrics } from '@ng-native/device';
import { registerPlatformComponents } from '@ng-native/fabric';
import { cleanup, fireEvent, render, screen, settle, type FakeFabric } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
before(async () => {
  mod = await compileFixture('fixtures/reveal-in-sheet.ts');
});

/** An iPhone 17 Pro's window, and its keyboard up: 376 points tall, its top 498 down. */
const WINDOW = { width: 402, height: 874, colorScheme: 'light' as const };
const KEYBOARD = { height: 376, screenY: 498 };

function keyboardSource() {
  const listeners = new Set<(metrics: KeyboardMetrics) => void>();
  return {
    provider: {
      provide: Keyboard.SOURCE,
      useValue: {
        subscribe: (listener: (metrics: KeyboardMetrics) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        dismiss: () => {},
      },
    },
    raise: () => {
      for (const listener of listeners) listener(KEYBOARD);
    },
  };
}

/** The form, pushed or presented, with the keyboard up. */
async function form(how: 'push' | 'formSheet' | 'pageSheet' | 'modal' | 'containedModal') {
  const keyboard = keyboardSource();
  const app = await render(mod['RevealShell'] as Type<unknown>, {
    conditions: WINDOW,
    providers: [provideNativeRouter(mod['revealRoutes'] as Routes), keyboard.provider],
  });
  await settle();
  const navigation = app.componentRef.injector.get(NativeNavigation);
  if (how === 'push') await navigation.push('/form');
  else await navigation.present('/form', { as: how });
  await settle();
  keyboard.raise();
  return app;
}

const scrolls = (fabric: FakeFabric) =>
  fabric.commands.filter((command) => command.name === 'scrollTo').map((command) => command.args);

async function focusSecond(fabric: FakeFabric, field: { y: number }, content = { y: 0 }) {
  fabric.frames.set('form', { x: 0, y: 0, width: 402, height: 812 });
  fabric.frames.set('View', { x: 0, y: content.y, width: 402, height: 2000 });
  fabric.frames.set('second', { x: 16, y: field.y, width: 370, height: 44 });
  await fireEvent(screen.getByTestId('second'), 'focus', {});
  return scrolls(fabric);
}

describe('revealing a field in a sheet on iOS', () => {
  for (const how of ['formSheet', 'pageSheet', 'modal'] as const) {
    it(`takes the ${how}'s top off the keyboard's, which measures from the top of the screen`, async () => {
      const { fabric } = await form(how);
      // The sheet starts 62 points down the screen, and measures as starting at 0.
      fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 812 });
      // The field ends at 444 in the sheet, 506 on the screen: behind the keyboard's top at 498,
      // which is 436 in the sheet.
      const done = await focusSecond(fabric, { y: 400 });
      assert.deepEqual(done, [[0, 444 + 16 - (498 - 62), true]]);
    });
  }

  it('takes the top off for a stack laid out below the top of what holds it', async () => {
    // What the sheet holds measures 20 points further down than the sheet's top: the stack's
    // own place, which UIKit does not put it at. The sheet starts 62 down the screen all the same.
    const { fabric } = await form('formSheet');
    fabric.frames.set('RNSScreen', { x: 0, y: 20, width: 402, height: 812 });
    const done = await focusSecond(fabric, { y: 420 });
    assert.deepEqual(done, [[0, 464 + 16 - (498 - 62 + 20), true]]);
  });

  it('takes nothing off where the size of the window is not known', async () => {
    const keyboard = keyboardSource();
    const app = await render(mod['RevealShell'] as Type<unknown>, {
      providers: [provideNativeRouter(mod['revealRoutes'] as Routes), keyboard.provider],
    });
    await settle();
    await app.componentRef.injector.get(NativeNavigation).present('/form', { as: 'formSheet' });
    await settle();
    keyboard.raise();
    app.fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 812 });
    const done = await focusSecond(app.fabric, { y: 470 });
    assert.deepEqual(done, [[0, 514 + 16 - 498, true]]);
  });

  it("takes the top of React Native's own modal off, presented as a page sheet", async () => {
    const keyboard = keyboardSource();
    const { fabric } = await render(mod['RevealModalForm'] as Type<unknown>, {
      conditions: WINDOW,
      providers: [keyboard.provider],
    });
    keyboard.raise();
    // A modal host measures from where it is written, which is not where it is shown: what it
    // holds measures from its own top, the sheet's.
    fabric.frames.set('ModalHostView', { x: 0, y: 200, width: 402, height: 812 });
    const done = await focusSecond(fabric, { y: 400 });
    assert.deepEqual(done, [[0, 444 + 16 - (498 - 62), true]]);
  });

  it('takes the sheet off for a screen pushed in a stack inside it', async () => {
    const keyboard = keyboardSource();
    const { fabric } = await render(mod['RevealModalShell'] as Type<unknown>, {
      conditions: WINDOW,
      providers: [provideNativeRouter(mod['revealModalRoutes'] as Routes), keyboard.provider],
    });
    await settle();
    keyboard.raise();
    fabric.frames.set('ModalHostView', { x: 0, y: 0, width: 402, height: 812 });
    // The pushed screen is not where the sheet starts; the sheet around it is.
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 500 });
    const done = await focusSecond(fabric, { y: 400 });
    assert.deepEqual(done, [[0, 444 + 16 - (498 - 62), true]]);
  });

  it('takes the sheet off for a screen pushed in it as a push by name', async () => {
    const keyboard = keyboardSource();
    const { fabric, componentRef } = await render(mod['RevealModalShell'] as Type<unknown>, {
      conditions: WINDOW,
      providers: [provideNativeRouter(mod['revealModalPushRoutes'] as Routes), keyboard.provider],
    });
    await settle();
    await componentRef.injector
      .get(NativeNavigation)
      .push('/form', { presentation: { stackPresentation: 'push' } });
    await settle();
    keyboard.raise();
    fabric.frames.set('ModalHostView', { x: 0, y: 0, width: 402, height: 812 });
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 500 });
    const done = await focusSecond(fabric, { y: 400 });
    assert.deepEqual(done, [[0, 444 + 16 - (498 - 62), true]]);
  });

  it('leaves a screen presented over what it covers, short of the bottom of the screen', async () => {
    // A contained modal covers its presenter, which can stop above a tab bar: it ends there, not
    // at the bottom of the screen.
    const { fabric } = await form('containedModal');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 791 });
    assert.deepEqual(await focusSecond(fabric, { y: 430 }), []);
  });

  it('leaves a pushed page measured from the top of the screen, short as a tab bar leaves it', async () => {
    const { fabric } = await form('push');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 791 });
    // Clear of the keyboard's top at 498, less the margin.
    assert.deepEqual(await focusSecond(fabric, { y: 430 }), []);
  });

  it('leaves a sheet short enough to sit above the keyboard as it measures', async () => {
    // At a medium detent the sheet may have risen over the keyboard, or not: nothing says which,
    // and taking its top as the window's height less its own would scroll a keyboard's height too
    // far if it has.
    const { fabric } = await form('formSheet');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 437 });
    assert.deepEqual(await focusSecond(fabric, { y: 380 }), []);
  });

  it('leaves a sheet narrower than the window, which is not attached to its bottom', async () => {
    // An iPad's form sheet, centred, or one floating at a partial detent on iOS 26.
    const { fabric } = await form('formSheet');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 370, height: 812 });
    assert.deepEqual(await focusSecond(fabric, { y: 400 }), []);
  });

  it('leaves a sheet on Android, where the sheet is in the shadow tree', async () => {
    registerPlatformComponents('android');
    try {
      const { fabric } = await form('formSheet');
      fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 812 });
      assert.deepEqual(await focusSecond(fabric, { y: 400 }), []);
    } finally {
      registerPlatformComponents('ios');
    }
  });
});

describe('revealing a field in a scroll view under a bar', () => {
  it('scrolls from where the bar leaves it at rest, not from zero', async () => {
    const { fabric } = await form('push');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 874 });
    // At rest 70 points above zero, under the bar: the content starts 70 down the scroll view. The
    // field is 6 points short of clear, which is 64 above zero, not zero, 70 points on.
    const done = await focusSecond(fabric, { y: 444 }, { y: 70 });
    assert.deepEqual(done, [[0, -70 + (444 + 44 + 16 - 498), true]]);
  });

  it('still stops at zero scrolling back up from below it', async () => {
    const { fabric } = await form('push');
    fabric.frames.set('RNSScreen', { x: 0, y: 0, width: 402, height: 874 });
    // Scrolled 30 down, with the field above the top: as far up as zero, where nothing says the
    // content can go further.
    const done = await focusSecond(fabric, { y: -100 }, { y: -30 });
    assert.deepEqual(done, [[0, 0, true]]);
  });
});
