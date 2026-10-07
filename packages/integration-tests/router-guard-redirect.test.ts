/**
 * A reset or a replace to a page whose guard sends the user somewhere else: signing out to a home
 * page that sends a signed-out user to the sign-in page. The router starts a new navigation for
 * the redirect, and the stack does to it what the first one asked for.
 */
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Type } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import {
  cleanup,
  render,
  settle,
  type FakeFabricNode,
  type RenderResult,
} from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
before(async () => {
  mod = await compileFixture(
    fileURLToPath(new URL('./fixtures/guard-redirect.ts', import.meta.url)),
  );
});

beforeEach(() => {
  (mod['session'] as { signedIn: boolean }).signedIn = false;
});

const flatten = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const turns = async () => {
  for (let turn = 0; turn < 6; turn++) await settle();
};

/** The app with `A` and `B` on the stack. */
async function twoDeep() {
  const app = await render(mod['GuardedShell'] as Type<unknown>, {
    providers: [provideNativeRouter(mod['guardedRoutes'] as Routes)],
  });
  const nav = app.componentRef.injector.get(NativeNavigation);
  const router = app.componentRef.injector.get(Router);
  await app.findByText('A');
  await nav.push('/b');
  await turns();
  return { app, nav, router };
}

const screens = (app: RenderResult<unknown>) =>
  flatten(app.fabric.committed).filter((node) => node.viewName === 'RNSScreen');

const pages = (app: RenderResult<unknown>) =>
  screens(app).map((screen) =>
    flatten([screen])
      .map((node) => node.props['text'])
      .find((text) => typeof text === 'string'),
  );

it('resets the stack to the page a guard redirects a reset to', async () => {
  const { app, nav, router } = await twoDeep();
  assert.equal(await nav.reset('/home'), true);
  await turns();
  assert.equal(router.url, '/login');
  assert.deepEqual(pages(app), ['Login']);
});

it('replaces the top screen with the page a guard redirects a replace to', async () => {
  const { app, nav, router } = await twoDeep();
  assert.equal(await nav.replace('/home'), true);
  await turns();
  assert.equal(router.url, '/login');
  assert.deepEqual(pages(app), ['A', 'Login']);
});

it('resets and replaces as before where the guard lets the navigation through', async () => {
  (mod['session'] as { signedIn: boolean }).signedIn = true;
  const replaced = await twoDeep();
  await replaced.nav.replace('/home');
  await turns();
  assert.deepEqual(pages(replaced.app), ['A', 'Home']);
  cleanup();

  const reset = await twoDeep();
  await reset.nav.reset('/home');
  await turns();
  assert.equal(reset.router.url, '/home');
  assert.deepEqual(pages(reset.app), ['Home']);
});

it('presents the page a guard redirects a presentation to, the way it was asked for', async () => {
  const { app, nav, router } = await twoDeep();
  await nav.present('/home', { as: 'formSheet' });
  await turns();
  assert.equal(router.url, '/login');
  assert.deepEqual(pages(app), ['A', 'B', 'Login']);
  assert.equal(screens(app)[2]!.props['stackPresentation'], 'formSheet');
});

it('leaves a later navigation of its own to do what it asks', async () => {
  const { app, nav, router } = await twoDeep();
  await nav.reset('/home');
  await turns();
  await router.navigateByUrl('/a');
  await turns();
  assert.equal(router.url, '/a');
  assert.deepEqual(pages(app), ['Login', 'A'], 'pushed, not a second reset');
  await router.navigateByUrl('/home');
  await turns();
  assert.equal(router.url, '/login');
  assert.deepEqual(pages(app), ['Login'], 'a plain navigation back to a kept page, not a push');
});

it("keeps the intent through a route config's own redirect", async () => {
  const replaced = await twoDeep();
  await replaced.nav.replace('/sign-in');
  await turns();
  assert.equal(replaced.router.url, '/login');
  assert.deepEqual(pages(replaced.app), ['A', 'Login']);
  cleanup();

  const reset = await twoDeep();
  await reset.nav.reset('/sign-in');
  await turns();
  assert.deepEqual(pages(reset.app), ['Login']);
});
