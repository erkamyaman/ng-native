/**
 * The copy a page's route gets at the root's presented outlet, so `present()` can show a page of
 * one tab over another: what it keeps of the routes the page sat inside, and which configs it
 * leaves alone.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEnvironmentInjector,
  inject,
  InjectionToken,
  Injector,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import {
  DefaultUrlSerializer,
  type CanActivateFn,
  type Route,
  type Router,
  type Routes,
} from '@angular/router';
import { PRESENTED, presentedCommands } from '../router/src/presented-route.ts';

class Bar {}
class Stack {}
class List {}
class Detail {}

const signedIn = () => true;
const mayRead = () => true;
const owner = () => true;

const serializer = new DefaultUrlSerializer();
const ROOT = createEnvironmentInjector([], Injector.NULL as EnvironmentInjector);
const routerWith = (config: Routes) =>
  ({ config, parseUrl: (url: string) => serializer.parse(url) }) as unknown as Router;

/** The copy's routes from the root of the presented outlet down to the page. */
function levels(copy: Route): Route[] {
  return copy.children ? [copy, ...levels(copy.children[0]!)] : [copy];
}
const pageOf = (copy: Route) => levels(copy).at(-1)!;

/**
 * Runs the copy's `canActivate` guards as Angular does: each route's in an injector made of its
 * providers, under the one above it, a token as what that injector gives for it.
 */
function runGuards(copy: Route): void {
  let scope = ROOT;
  for (const route of levels(copy)) {
    if (route.providers?.length) scope = createEnvironmentInjector(route.providers, scope);
    for (const guard of route.canActivate ?? []) {
      if (typeof guard === 'function') {
        runInInjectionContext(scope, () => (guard as CanActivateFn)(null!, null!));
      } else {
        (scope.get(guard) as { canActivate(): boolean }).canActivate();
      }
    }
  }
}

const tabs = (): Routes => [
  {
    path: '',
    component: Bar,
    canActivate: [signedIn],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'invoices',
        component: Stack,
        canActivateChild: [mayRead],
        providers: [{ provide: 'feature', useValue: 'invoices' }],
        data: { section: 'billing' },
        children: [
          { path: '', component: List },
          { path: ':id', component: Detail, canActivate: [owner], data: { kind: 'detail' } },
        ],
      },
    ],
  },
];

describe('the route a presented page gets at the root', () => {
  it("runs an ancestor's guard with the providers down to its route, not a page's below", async () => {
    const POLICY = new InjectionToken<string>('policy');
    const seen: string[] = [];
    const strict: CanActivateFn = () => (seen.push(inject(POLICY)), true);
    const router = routerWith([
      {
        path: 'admin',
        component: Stack,
        canActivate: [strict],
        providers: [{ provide: POLICY, useValue: 'strict' }],
        children: [
          { path: 'users', component: List, providers: [{ provide: POLICY, useValue: 'lenient' }] },
        ],
      },
    ]);
    await presentedCommands(router, '/admin/users');
    runGuards(router.config.at(-1) as Route);
    assert.deepEqual(seen, ['strict']);
  });

  it("runs an ancestor's guard given as a token, from the providers down to its route", async () => {
    const GUARD = new InjectionToken<{ canActivate(): boolean }>('guard');
    const seen: string[] = [];
    const router = routerWith([
      {
        path: 'admin',
        component: Stack,
        canActivate: [GUARD],
        providers: [{ provide: GUARD, useValue: { canActivate: () => (seen.push('ran'), true) } }],
        children: [{ path: 'users', component: List, providers: [{ provide: 'x', useValue: 1 }] }],
      },
    ]);
    await presentedCommands(router, '/admin/users');
    runGuards(router.config.at(-1) as Route);
    assert.deepEqual(seen, ['ran']);
  });

  it('is the page under its whole path, inside the guards, providers and data above it', async () => {
    const router = routerWith(tabs());
    assert.deepEqual(await presentedCommands(router, '/invoices/7'), [
      { outlets: { [PRESENTED]: ['invoices', '7'] } },
    ]);
    const copy = router.config.at(-1) as Route;
    assert.equal(copy.outlet, PRESENTED);
    assert.equal(copy.path, 'invoices/:id');
    // A route for each one the page sat inside, so each has its own injector as in the tab.
    const [bar, stack, page] = levels(copy) as [Route, Route, Route];
    assert.equal(page.component, Detail, 'the page, and neither the bar nor the tab s stack');
    for (const route of [bar, stack]) {
      assert.equal(route.component, undefined);
    }
    for (const route of [stack, page]) {
      assert.equal(route.path, '', 'inside the route that takes the path');
      assert.equal(route.outlet, PRESENTED, 'so the router puts the page in the presented outlet');
    }
    assert.deepEqual(bar.canActivate, [signedIn]);
    assert.deepEqual(stack.canActivateChild, [mayRead]);
    assert.deepEqual(stack.providers, [{ provide: 'feature', useValue: 'invoices' }]);
    assert.deepEqual(stack.data, { section: 'billing' });
    assert.deepEqual(page.canActivate, [owner]);
    assert.deepEqual(page.data, { kind: 'detail' });
  });

  it('is made once for a path, however many times a page of it is presented', async () => {
    const router = routerWith(tabs());
    await presentedCommands(router, '/invoices/7');
    await presentedCommands(router, '/invoices/8');
    assert.equal(router.config.length, 2);
    await presentedCommands(router, '/invoices');
    assert.equal(router.config.length, 3, 'and once more for a page under another path');
  });

  it('is made though a route of the primary outlet has the same path', async () => {
    const router = routerWith([...tabs(), { path: 'invoices/:id', component: List }]);
    await presentedCommands(router, '/invoices/7');
    const copy = router.config.at(-1) as Route;
    assert.equal(copy.outlet, PRESENTED);
    assert.equal(pageOf(copy).component, Detail);
  });

  it('is made from the routes in place when they are reset while lazy children load', async () => {
    let release: () => void = () => {};
    const loaded = new Promise<void>((resolve) => (release = resolve));
    const lazy = (guard: () => boolean): Routes => [
      {
        path: '',
        component: Bar,
        children: [
          {
            path: 'orders',
            canActivate: [guard],
            loadChildren: () => loaded.then(() => [{ path: ':id', component: Detail }]),
          },
        ],
      },
    ];
    const router = routerWith(lazy(signedIn));
    const presenting = presentedCommands(router, '/orders/7');
    router.config = lazy(owner);
    release();
    assert.deepEqual(await presenting, [{ outlets: { [PRESENTED]: ['orders', '7'] } }]);
    assert.equal(router.config.length, 2);
    assert.deepEqual(levels(router.config.at(-1) as Route)[1]?.canActivate, [owner]);
  });

  it('is the first screen of a tab, for the tab s own url', async () => {
    const router = routerWith(tabs());
    await presentedCommands(router, '/invoices');
    assert.equal(pageOf(router.config.at(-1) as Route).component, List);
    assert.equal((router.config.at(-1) as Route).path, 'invoices');
  });

  it('is a page inside a lazily loaded route, whose routes it loads to find it', async () => {
    let loads = 0;
    const load = async () => {
      loads++;
      return { default: [{ path: ':id', component: Detail, data: { kind: 'detail' } }] };
    };
    const router = routerWith([
      {
        path: '',
        component: Bar,
        children: [{ path: 'orders', loadChildren: load, canActivate: [signedIn] }],
      },
    ]);
    for (const id of ['7', '8']) {
      assert.deepEqual(await presentedCommands(router, `/orders/${id}`), [
        { outlets: { [PRESENTED]: ['orders', id] } },
      ]);
    }
    const copy = router.config.at(-1) as Route;
    assert.equal(copy.path, 'orders/:id');
    assert.equal(pageOf(copy).component, Detail);
    assert.equal(pageOf(copy).loadChildren, undefined);
    assert.deepEqual(levels(copy)[1]?.canActivate, [signedIn]);
    assert.equal(loads, 1, 'loaded once for the copy, however many times it is presented');
    assert.equal(router.config.length, 2);
  });

  it('leaves alone lazy routes that are not plain routes, or that fail to load', async () => {
    class FeatureModule {}
    for (const loadChildren of [
      async () => FeatureModule,
      async () => {
        throw new Error('offline');
      },
    ]) {
      const router = routerWith([{ path: 'lazy', loadChildren }] as Routes);
      assert.equal(await presentedCommands(router, '/lazy/1'), null);
      assert.equal(router.config.length, 1);
    }
  });

  it('leaves alone a page whose route, or one above it, has a canMatch guard', async () => {
    const allowed = () => false;
    for (const config of [
      [{ path: 'admin', canMatch: [allowed], children: [{ path: ':id', component: Detail }] }],
      [{ path: 'admin', children: [{ path: ':id', component: Detail, canMatch: [allowed] }] }],
      // A later route that would match is not taken in its place: the guard decides that.
      [
        { path: 'admin/:id', component: Detail, canMatch: [allowed] },
        { path: ':section/:id', component: List },
      ],
    ] as Routes[]) {
      const router = routerWith(config);
      assert.equal(await presentedCommands(router, '/admin/1'), null);
      assert.equal(router.config.length, config.length, 'and adds nothing');
    }
  });

  it('leaves alone a url it cannot follow through the config', async () => {
    for (const config of [
      [{ path: 'old', redirectTo: 'new' }],
      [{ path: '**', component: Detail }],
      [{ matcher: () => null, component: Detail }],
      [{ path: 'other', component: Detail }],
    ] as Routes[]) {
      const router = routerWith(config);
      const path = `/${config[0]!.path === '**' ? 'anything' : (config[0]!.path ?? 'x')}/1`;
      assert.equal(await presentedCommands(router, path), null, JSON.stringify(config[0]!.path));
      assert.equal(router.config.length, 1, 'and adds nothing');
    }
  });
});
