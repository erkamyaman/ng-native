/**
 * A push into a tab nobody has opened goes to the tab's first screen first. A guard on that first
 * screen that redirects among the tabs makes the push resolve false, with the page not shown.
 */
import assert from 'node:assert/strict';
import { afterEach, before, it } from 'node:test';
import { inject, type Type } from '@angular/core';
import { Router, type Route, type Routes } from '@angular/router';
import { cleanup, render, screen, settle } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
before(async () => {
  mod = await compileFixture('fixtures/tab-stacks.ts');
});

/** The fixture's routes, with the Library tab's first screen sending the user to Search. */
function guarded(): Routes {
  const [bar, ...rest] = mod['routes'] as Routes;
  const children = bar!.children!.map((child): Route => {
    if (child.path !== 'library') return child;
    return {
      ...child,
      children: child.children!.map((page) =>
        page.path === ''
          ? { ...page, canActivate: [() => inject(Router).parseUrl('/search')] }
          : page,
      ),
    };
  });
  return [{ ...bar!, children }, ...rest];
}

it("resolves false, showing nothing, when the tab's first screen redirects the push away", async () => {
  const app = await render(mod['Shell'] as Type<unknown>, {
    providers: [provideNativeRouter(guarded())],
  });
  await settle();
  const router = app.componentRef.injector.get(Router);
  const nav = app.componentRef.injector.get(NativeNavigation);
  assert.equal(router.url, '/home');

  const pushed = await nav.push('/library/7');
  for (let turn = 0; turn < 6; turn++) await settle();

  assert.equal(pushed, false, 'the push resolves false');
  assert.equal(screen.queryByText('album'), null, 'and the page is not shown');
  assert.equal(router.url, '/search');
});
