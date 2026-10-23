/**
 * A screen in a tab's own stack that hides the tab bar while it is in front, through its header's
 * `tabBarHidden`: the real `Router` over the real outlets.
 *
 * react-native-screens has no per-screen prop for it, only `tabBarHidden` on the tabs host, so the
 * bar is hidden while the screen asking for it is in front and shown again as soon as it is not.
 * Every way a screen comes in front or goes behind has to reach the host: a push, a back, a swipe
 * back, a tab switch, a link, a launch on the page, a reset, and the page changing its mind.
 */
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import type { Signal, WritableSignal, Type } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  settle,
  type FakeFabric,
  type FakeFabricNode,
} from '@ng-native/testing';
import { registerPlatformComponents } from '@ng-native/fabric';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { registerScreenComponents } from '../router/src/screens.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

const flatten = (nodes: FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const turns = async () => {
  for (let turn = 0; turn < 6; turn++) await settle();
};

describe("a header's tabBarHidden", () => {
  let mod: Record<string, unknown>;
  let fabric: FakeFabric;
  let router: Router;
  let nav: NativeNavigation;
  let provenance = 0;

  const host = () =>
    flatten(fabric.committed).find((node) => /^RNSTabsHost(IOS|Android)$/.test(node.viewName))!;
  /** What the tabs host was last committed with: null once a prop is taken away. */
  const hidden = () => host().props['tabBarHidden'] ?? false;
  /** The screens of the stack in the Customers tab, oldest first. */
  const customerScreens = () => {
    const tab = flatten(fabric.committed).find(
      (node) =>
        /^RNSTabsScreen(IOS|Android)$/.test(node.viewName) &&
        node.props['screenKey'] === 'customers',
    )!;
    const stack = flatten(tab.children).find((node) => node.viewName === 'RNSScreenStack')!;
    return stack.children.filter((node) => node.viewName === 'RNSScreen');
  };
  const tap = async (key: string) => {
    await fireEvent(host(), 'tabSelected', {
      selectedScreenKey: key,
      provenance: ++provenance,
      actionOrigin: 'user',
    });
    await turns();
  };
  const signalOf = <T>(name: string) => mod[name] as WritableSignal<T> & Signal<T>;

  const start = async (routes = mod['routes'] as Routes) => {
    const app = await render(mod['Shell'] as Type<unknown>, {
      providers: [provideNativeRouter(routes)],
    });
    fabric = app.fabric;
    router = app.componentRef.injector.get(Router);
    nav = app.componentRef.injector.get(NativeNavigation);
    await turns();
  };

  before(async () => {
    mod = await compileFixture('fixtures/tab-bar-hidden.ts');
  });

  beforeEach(() => {
    signalOf<boolean | undefined>('detailHidesBar').set(true);
    signalOf<boolean>('detailHasHeader').set(true);
    signalOf<boolean | undefined>('barHidden').set(undefined);
  });

  afterEach(() => {
    cleanup();
    signalOf<boolean | undefined>('detailHidesBar').set(true);
    signalOf<boolean>('detailHasHeader').set(true);
    signalOf<boolean | undefined>('barHidden').set(undefined);
  });

  it('hides the bar for a pushed screen, and shows it again on a back', async () => {
    await start();
    assert.equal(router.url, '/customers');
    assert.equal(hidden(), false, 'the list leaves the bar showing');

    assert.equal(await nav.push('/customers/1'), true);
    await turns();
    assert.ok(screen.getByText('detail'));
    assert.equal(hidden(), true, 'the detail page hides it');
    const configs = flatten(fabric.committed).filter(
      (node) => node.viewName === 'RNSScreenStackHeaderConfig',
    );
    assert.ok(
      configs.every((config) => !('tabBarHidden' in config.props)),
      'which is no prop of its header',
    );

    nav.back();
    await turns();
    assert.equal(router.url, '/customers');
    assert.equal(hidden(), false, 'and the pop shows it again');
  });

  it('shows the bar again when the screen is swiped away', async () => {
    await start();
    await nav.push('/customers/1');
    await turns();
    assert.equal(hidden(), true);

    await fireEvent(customerScreens().at(-1)!, 'dismissed', { dismissCount: 1 });
    await turns();
    assert.equal(router.url, '/customers');
    assert.equal(hidden(), false);
  });

  it('shows the bar on another tab, and hides it again on the way back', async () => {
    await start();
    await nav.push('/customers/1');
    await turns();
    assert.equal(hidden(), true);

    await nav.push('/settings');
    await turns();
    assert.equal(router.url, '/settings');
    assert.equal(hidden(), false, 'the Settings tab is in front, and does not hide the bar');

    await tap('customers');
    assert.equal(router.url, '/customers/1', 'the tab comes back on the detail page');
    assert.equal(hidden(), true);
  });

  it('hides the bar for a page a link opens, and one the app launches on', async () => {
    await start();
    await nav.push('/settings');
    await turns();
    assert.equal(await router.navigateByUrl('/customers/2'), true);
    await turns();
    assert.equal(hidden(), true, 'a link into the tab');
    cleanup();

    await start(mod['launchedOnDetail'] as Routes);
    assert.equal(router.url, '/customers/1');
    assert.equal(hidden(), true, 'a launch straight on the detail page');
  });

  it('follows a reset, to the list and to a detail page', async () => {
    await start();
    await nav.push('/customers/1');
    await turns();

    assert.equal(await nav.reset('/customers'), true);
    await turns();
    assert.equal(router.url, '/customers');
    assert.equal(hidden(), false, 'reset to the list');

    assert.equal(await nav.reset('/customers/3'), true);
    await turns();
    assert.equal(router.url, '/customers/3');
    assert.equal(customerScreens().length, 1, 'the detail page alone');
    assert.equal(hidden(), true, 'reset to a detail page');
  });

  it('follows the page changing its mind, and its header going away', async () => {
    await start();
    await nav.push('/customers/1');
    await turns();
    assert.equal(hidden(), true);

    signalOf<boolean | undefined>('detailHidesBar').set(false);
    await turns();
    assert.equal(hidden(), false, 'false shows it');

    signalOf<boolean | undefined>('detailHidesBar').set(true);
    await turns();
    assert.equal(hidden(), true, 'true hides it again');

    signalOf<boolean | undefined>('detailHidesBar').set(undefined);
    await turns();
    assert.equal(hidden(), false, 'unset shows it');

    signalOf<boolean | undefined>('detailHidesBar').set(true);
    await turns();
    signalOf<boolean>('detailHasHeader').set(false);
    await turns();
    assert.equal(hidden(), false, 'a header taken away no longer hides it');
  });

  it("leaves the bar's own barHidden in force, whatever the screen in front asks", async () => {
    await start();
    signalOf<boolean | undefined>('barHidden').set(true);
    await turns();
    assert.equal(hidden(), true, 'the outlet hides it on the list');

    await nav.push('/customers/1');
    await turns();
    signalOf<boolean | undefined>('barHidden').set(false);
    await turns();
    assert.equal(hidden(), true, 'the detail page still hides it');

    nav.back();
    await turns();
    assert.equal(hidden(), false, 'and the outlet shows it once the page is gone');
  });

  it("hides Android's bottom navigation bar the same way", async () => {
    registerPlatformComponents('android');
    registerScreenComponents();
    try {
      await start();
      assert.equal(host().viewName, 'RNSTabsHostAndroid');
      await nav.push('/customers/1');
      await turns();
      assert.equal(hidden(), true);
      nav.back();
      await turns();
      assert.equal(hidden(), false);
    } finally {
      cleanup();
      registerPlatformComponents('ios');
      registerScreenComponents();
    }
  });

  it('does not hide the bar for a screen pushed over the whole bar', async () => {
    await start();
    await nav.push('/over');
    await turns();
    assert.ok(screen.getByText('over'));
    assert.equal(hidden(), false, 'it is in no tab, and the bar under it is left alone');
  });
});
