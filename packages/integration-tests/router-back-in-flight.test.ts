/**
 * `NativeNavigation.back()` called while the navigation that shows the page is still in flight: a
 * page that finds it should not be shown and leaves as it appears, from an effect in its
 * constructor. No outlet has anywhere to go back to yet, so the back waits for the navigation,
 * and past a guard's redirect, for the navigation the redirect starts.
 */
import assert from 'node:assert/strict';
import { afterEach, before, it } from 'node:test';
import { inject, type Type } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { cleanup, render, settle, type FakeFabricNode } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
let stack: Record<string, unknown>;
before(async () => {
  mod = await compileFixture('fixtures/gated-page.ts');
  stack = await compileFixture('fixtures/stack-app.ts');
});

const flatten = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

async function pushed(url: string) {
  const app = await render(mod['GateShell'] as Type<unknown>, {
    providers: [provideNativeRouter(mod['gateRoutes'] as Routes)],
  });
  await app.findByText('Home');
  await app.componentRef.injector.get(NativeNavigation).push(url);
  for (let turn = 0; turn < 8; turn++) await settle();
  const screens = flatten(app.fabric.committed).filter((node) => node.viewName === 'RNSScreen');
  return { url: app.componentRef.injector.get(Router).url, screens: screens.length };
}

for (const url of ['/effect', '/render']) {
  it(`goes back from a page that leaves as it appears (${url})`, async () => {
    (mod['allowed'] as { set(value: boolean): void }).set(false);
    assert.deepEqual(await pushed(url), { url: '/', screens: 1 });
  });
}

it('stays on a page whose effect does not ask to leave', async () => {
  (mod['allowed'] as { set(value: boolean): void }).set(true);
  assert.deepEqual(await pushed('/effect'), { url: '/effect', screens: 2 });
});

for (const guard of ['allows', 'redirects', 'redirects home'] as const) {
  it(`goes back once the navigation it was asked in lands, where a guard ${guard}`, async () => {
    // Held until the back is asked, so the back is asked mid-navigation however long settling takes.
    let release!: () => void;
    const routes: Routes = [
      { path: '', component: stack['Home'] as Type<unknown> },
      { path: 'login', component: stack['Modal'] as Type<unknown> },
      {
        path: 'admin',
        component: stack['Compose'] as Type<unknown>,
        canActivate: [
          () => {
            const router = inject(Router);
            const to =
              guard === 'allows' ? true : router.parseUrl(guard === 'redirects' ? '/login' : '/');
            return new Promise((resolve) => (release = () => resolve(to)));
          },
        ],
      },
    ];
    const app = await render(stack['Shell'] as Type<unknown>, {
      providers: [provideNativeRouter(routes)],
    });
    for (let turn = 0; turn < 8; turn++) await settle();
    const navigation = app.componentRef.injector.get(NativeNavigation);
    const pushing = navigation.push('/admin');
    await settle();
    navigation.back();
    release();
    await pushing;
    for (let turn = 0; turn < 8; turn++) await settle();
    assert.equal(app.componentRef.injector.get(Router).url, '/');
    // A redirect to the url showing is skipped: the back ends with it, not with the next push.
    await navigation.push('/login');
    for (let turn = 0; turn < 8; turn++) await settle();
    assert.equal(app.componentRef.injector.get(Router).url, '/login');
  });
}
