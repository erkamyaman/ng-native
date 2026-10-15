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
import { Engine, registerHoist } from '@ng-native/fabric';
import { cleanup, createFakeFabric, render, settle, type FakeFabricNode } from '@ng-native/testing';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

const flatten = (nodes: FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

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

    const tab = flatten([outer]).find(
      (node) => node.viewName === 'RNSTabsScreenIOS' || node.viewName === 'RNSTabsScreenAndroid',
    );
    assert.ok(tab, 'the Library page is mounted in a tab screen');
    assert.deepEqual(
      flatten(tab.children)
        .filter((node) => node.viewName === 'RNSScreenStackHeaderConfig')
        .map((node) => node.props['nativeID']),
      ['library-bar'],
    );
  });
});

describe('a hoist registered again without stopAt', () => {
  it('hoists past the boundary the earlier registration stopped at', () => {
    registerHoist('stop-config', 'stop-host', { stopAt: ['stop-wall'] });
    registerHoist('stop-config', 'stop-host');

    const fabric = createFakeFabric();
    const engine = new Engine(fabric, 1);
    const host = engine.createElement('stop-host');
    const wall = engine.createElement('stop-wall');
    const config = engine.createElement('stop-config');
    engine.appendChild(engine.root, host);
    engine.appendChild(host, wall);
    engine.appendChild(wall, config);
    engine.commit();

    const committedHost = fabric.committed[0]!;
    assert.equal(committedHost.children.length, 2, 'the config commits beside the wall');
    assert.equal(committedHost.children[0]!.children.length, 0, 'and not inside it');
  });
});
