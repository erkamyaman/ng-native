/**
 * A setting that changes while the startup read is still on its way.
 *
 * React Native reports the accessibility settings asynchronously, and the change events are
 * subscribed before the answer arrives. An event in that gap is the newer value; the startup
 * answer was read before it and must not put the old one back.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Injector } from '@angular/core';
import { Accessibility, type AccessibilitySettings, watchConditions } from '@ng-native/device';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A source whose startup read resolves only when the test says so. */
function lateSource(startup: AccessibilitySettings) {
  let listener: (change: Partial<AccessibilitySettings>) => void = () => {};
  let answer: () => void = () => {};
  return {
    change: (value: Partial<AccessibilitySettings>) => listener(value),
    answer: () => answer(),
    value: {
      current: () =>
        new Promise<AccessibilitySettings>((resolve) => (answer = () => resolve(startup))),
      subscribe: (fn: typeof listener) => ((listener = fn), () => {}),
      announce: () => {},
    },
  };
}

describe('an accessibility change before the startup read answers', () => {
  it('keeps the change, and takes the startup answer for the settings that did not change', async () => {
    const source = lateSource({
      screenReader: true,
      reduceMotion: true,
      boldText: false,
      fontScale: 1.5,
    });
    const settings = Injector.create({
      providers: [
        { provide: Accessibility.SOURCE, useValue: source.value },
        { provide: Accessibility, useClass: Accessibility, deps: [] },
      ],
    }).get(Accessibility);

    source.change({ reduceMotion: false });
    source.answer();
    await settle();

    assert.equal(settings.reduceMotion(), false, 'the event came after the read began');
    assert.equal(settings.screenReader(), true);
    assert.equal(settings.fontScale(), 1.5);
  });

  it("keeps the engine's reduced motion at the change", async () => {
    let reduceMotionChanged: (value: boolean) => void = () => {};
    let answer: () => void = () => {};
    const subscription = { remove: () => {} };
    const native = {
      AccessibilityInfo: {
        isScreenReaderEnabled: () => Promise.resolve(false),
        isReduceMotionEnabled: () =>
          new Promise<boolean>((resolve) => (answer = () => resolve(true))),
        isBoldTextEnabled: () => Promise.resolve(false),
        addEventListener: (event: string, handler: (value: boolean) => void) => {
          if (event === 'reduceMotionChanged') reduceMotionChanged = handler;
          return subscription;
        },
      },
      AppState: { currentState: 'active', addEventListener: () => subscription },
      Appearance: { getColorScheme: () => 'light', addChangeListener: () => subscription },
      Dimensions: {
        get: () => ({ width: 390, height: 844 }),
        addEventListener: () => subscription,
      },
      I18nManager: { isRTL: false },
      PixelRatio: { get: () => 3, getFontScale: () => 1 },
    };
    const updates: { reducedMotion?: boolean }[] = [];
    const engine = {
      root: 'root',
      updateConditions: (conditions: { reducedMotion?: boolean }) => updates.push(conditions),
      addClass: () => {},
      removeClass: () => {},
    };

    const host = globalThis as Record<string, unknown>;
    host['require'] = (id: string) => (id === 'react-native' ? native : undefined);
    host['nativeFabricUIManager'] = {};
    let stop = () => {};
    try {
      stop = watchConditions(engine);
      reduceMotionChanged(false);
      await settle();
      answer();
      await settle();
      assert.equal(updates.at(-1)?.reducedMotion, false, 'the event came after the read began');
    } finally {
      stop();
      delete host['require'];
      delete host['nativeFabricUIManager'];
    }
  });
});
