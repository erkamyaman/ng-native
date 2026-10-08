/**
 * A permission refused for good is turned on in Settings, and neither platform restarts the app for
 * that. So a no is never final here: `ensure()` checks it again, which shows nothing, and coming
 * back to the front checks it again so a "go to Settings" screen can change by itself.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Injector, runInInjectionContext, type EnvironmentInjector } from '@angular/core';
import { Permission, type ForegroundEvents, type PermissionResponse } from '@ng-native/expo';
import { Location, type NativeLocation } from '@ng-native/expo/location';
import { servicesWith } from './injected.ts';

const blocked: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };
const askable: PermissionResponse = { status: 'denied', granted: false, canAskAgain: true };
const granted: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true };

function platform(initial: PermissionResponse) {
  const state = {
    answer: initial,
    checks: 0,
    dialogs: 0,
    get: async () => {
      state.checks++;
      return state.answer;
    },
    request: async () => {
      state.dialogs++;
      return state.answer;
    },
  };
  return state;
}

function foreground() {
  const listeners = new Set<() => void>();
  const events: ForegroundEvents = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return { events, listeners, return: () => listeners.forEach((listener) => listener()) };
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

describe('a permission the person turns on in Settings', () => {
  it('is granted the next time ensure() is called, without a dialog', async () => {
    let platform = blocked;
    let dialogs = 0;
    const permission = Permission.of(
      async () => platform,
      async () => {
        dialogs++;
        return platform;
      },
    );

    assert.equal(await permission.ensure(), false);
    assert.equal(permission.blocked(), true);

    platform = granted;
    assert.equal(await permission.ensure(), true, 'granted in Settings, still refused here');
    assert.equal(permission.blocked(), false);
    assert.equal(dialogs, 0);
  });

  it('keeps a granted answer, so ensure() asks the platform nothing more', async () => {
    const native = platform(granted);
    const permission = Permission.of(native.get, native.request);

    assert.equal(await permission.ensure(), true);
    assert.equal(await permission.ensure(), true);
    assert.equal(await permission.ensure(), true);
    assert.equal(native.checks, 1);
    assert.equal(native.dialogs, 0);
  });

  it('still shows the dialog for a no the platform will ask about again, and only that', async () => {
    const native = platform(askable);
    const permission = Permission.of(native.get, native.request);

    assert.equal(await permission.ensure(), false);
    assert.equal(native.dialogs, 1);

    native.answer = blocked;
    assert.equal(await permission.ensure(), false);
    assert.equal(native.dialogs, 1, 'no dialog once the platform has stopped showing one');
  });

  it('checks a no again when the app comes back to the front', async () => {
    const native = platform(blocked);
    const app = foreground();
    const injector = Injector.create({
      providers: [{ provide: Permission.FOREGROUND, useValue: app.events }],
    }) as EnvironmentInjector;
    const permission = runInInjectionContext(injector, () =>
      Permission.of(native.get, native.request),
    );

    app.return();
    await settled();
    assert.equal(native.checks, 0, 'nothing is asked before something has asked');

    await permission.check();
    assert.equal(permission.blocked(), true);

    native.answer = granted;
    app.return();
    await settled();
    assert.equal(permission.blocked(), false, 'the Settings screen can go away by itself');
    assert.equal(permission.granted(), true);
    assert.equal(native.checks, 2);

    app.return();
    await settled();
    assert.equal(native.checks, 2, 'a yes is not asked about again');
    assert.equal(native.dialogs, 0);

    injector.destroy();
    assert.equal(app.listeners.size, 0, 'the listener goes with the injector');
  });

  it('keeps its last answer when the check on coming back fails', async () => {
    const native = platform(blocked);
    const app = foreground();
    const permission = runInInjectionContext(
      Injector.create({ providers: [{ provide: Permission.FOREGROUND, useValue: app.events }] }),
      () => Permission.of(() => native.get(), native.request),
    );
    await permission.check();

    let failedChecks = 0;
    native.get = async () => {
      failedChecks++;
      throw new Error('the module went away');
    };
    app.return();
    await settled();
    assert.equal(failedChecks, 1);
    assert.equal(permission.blocked(), true);
  });

  it('keeps a yes recorded while a check on coming back was still out', async () => {
    const native = platform(blocked);
    const app = foreground();
    const permission = runInInjectionContext(
      Injector.create({ providers: [{ provide: Permission.FOREGROUND, useValue: app.events }] }),
      () => Permission.of(() => native.get(), native.request),
    );
    await permission.check();

    let answerLateCheck = (_: PermissionResponse) => {};
    native.get = () => new Promise((resolve) => (answerLateCheck = resolve));
    app.return();
    await settled();

    native.answer = granted;
    assert.equal(await permission.request(), true);
    answerLateCheck(blocked);
    await settled();
    assert.equal(permission.granted(), true, 'an older check replaced a newer yes');
    assert.equal(permission.blocked(), false);
  });

  it('works without foreground events, as in Node or a build without React Native', async () => {
    const native = platform(blocked);
    const permission = runInInjectionContext(
      Injector.create({ providers: [{ provide: Permission.FOREGROUND, useValue: null }] }),
      () => Permission.of(native.get, native.request),
    );
    assert.equal(await permission.ensure(), false);
    native.answer = granted;
    assert.equal(await permission.ensure(), true);
  });

  it('lets Location read a position once the person allows it in Settings', async () => {
    let answer = blocked;
    const native: NativeLocation = {
      getForegroundPermissionsAsync: async () => answer,
      requestForegroundPermissionsAsync: async () => answer,
      getCurrentPositionAsync: async () => ({
        coords: {
          latitude: 51.5,
          longitude: -0.12,
          altitude: null,
          accuracy: 5,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1000,
      }),
      watchPositionAsync: async () => ({ remove: () => {} }),
    };
    const app = foreground();
    const location = servicesWith(
      [
        [Location.SOURCE, native],
        [Permission.FOREGROUND, app.events],
      ],
      () => new Location(),
    );

    assert.equal(await location.current(), null);
    assert.equal(location.permission.blocked(), true);

    answer = granted;
    app.return();
    await settled();
    assert.equal(location.permission.blocked(), false);
    assert.equal((await location.current())?.latitude, 51.5);
  });
});
