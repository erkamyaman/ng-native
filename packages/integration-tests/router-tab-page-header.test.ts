/**
 * A header written in a tab's page that has no stack of its own.
 *
 * The tab screen is not a stack screen, so there is no bar for that header to configure. It must
 * not reach out past the tab into the stack screen that holds the whole tab bar, where it would
 * sit beside, and ahead of, the tabs page's own `[hidden]="true"` header.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { cleanup, render, settle, type FakeFabricNode } from '@ng-native/testing';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

describe('a header in a tab page with no stack', () => {
  let mod: Record<string, unknown>;

  before(async () => {
    mod = await compileFixture('fixtures/tab-page-header.ts');
  });

  afterEach(() => cleanup());

  it('does not become a second header config of the stack screen around the tab bar', async () => {
    const app = await render(mod['Shell'] as Type<unknown>, {
      providers: [provideNativeRouter(mod['routes'] as Routes)],
    });
    await settle();

    // root view > RNSScreenStack > the RNSScreen the tabs page is in
    const outer = app.fabric.committed[0]!.children[0]!.children[0]! as FakeFabricNode;
    assert.equal(outer.viewName, 'RNSScreen');
    const configs = outer.children
      .filter((child) => child.viewName === 'RNSScreenStackHeaderConfig')
      .map((child) => child.props['nativeID']);

    // Android's Screen.headerConfig takes the first config child, so the tab page's header would
    // show a "Library" bar over the tab bar, on every tab, though the tabs page hid its bar.
    assert.deepEqual(configs, ['tabs-bar']);
  });
});
