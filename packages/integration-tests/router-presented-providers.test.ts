/**
 * The providers of the routes a presented page sat inside: the copy at the root's presented outlet
 * has one injector for each of them, as the page has in its tab, so a guard, a resolver and the
 * page share one instance of a service, and a guard still never sees a provider below its route.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { DestroyRef, ErrorHandler, inject, InjectionToken, type Type } from '@angular/core';
import {
  Router,
  withAutoCleanupInjectors,
  type RouterFeatures,
  type Routes,
} from '@angular/router';
import { cleanup, render, settle } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
before(async () => {
  mod = await compileFixture('fixtures/presented-providers.ts');
});

type Page = {
  shell: object;
  session: object;
  policy: string;
  params: Record<string, string>;
  data: Record<string, unknown>;
  title: string | undefined;
};

/**
 * The routes, and what each guard and resolver was given, in the order they ran. `lazy` loads the
 * page's component with `loadComponent`.
 */
function setup(lazy = false) {
  const SHELL = mod['SHELL'] as InjectionToken<object>;
  const SESSION = mod['SESSION'] as InjectionToken<object>;
  const POLICY = mod['POLICY'] as InjectionToken<string>;
  const ran: { by: string; shell?: object; session: object | null; policy?: string | null }[] = [];
  const destroyed: object[] = [];
  const made = () => {
    const made = {};
    inject(DestroyRef).onDestroy(() => destroyed.push(made));
    return made;
  };
  const routes: Routes = [
    {
      path: '',
      component: mod['Bar'] as Type<unknown>,
      providers: [{ provide: SHELL, useFactory: made }],
      canActivate: [
        () => {
          // Above the tab's route: its providers are not this guard's to see.
          ran.push({
            by: 'bar canActivate',
            shell: inject(SHELL),
            session: inject(SESSION, { optional: true }),
          });
          return true;
        },
      ],
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'home' },
        { path: 'home', component: mod['Home'] as Type<unknown> },
        {
          path: 'library',
          component: mod['TabStack'] as Type<unknown>,
          providers: [
            { provide: SESSION, useFactory: made },
            { provide: POLICY, useValue: 'strict' },
          ],
          canActivate: [
            () => (
              ran.push({ by: 'canActivate', session: inject(SESSION), policy: inject(POLICY) }),
              true
            ),
          ],
          canActivateChild: [
            () => (
              ran.push({
                by: 'canActivateChild',
                session: inject(SESSION),
                policy: inject(POLICY),
              }),
              true
            ),
          ],
          resolve: {
            tab: () => (ran.push({ by: 'tab resolver', session: inject(SESSION) }), 'tab'),
          },
          data: { section: 'library' },
          children: [
            { path: '', component: mod['Library'] as Type<unknown> },
            {
              path: ':id',
              ...(lazy
                ? { loadComponent: () => Promise.resolve(mod['Album'] as Type<unknown>) }
                : { component: mod['Album'] as Type<unknown> }),
              title: 'Album',
              providers: [{ provide: POLICY, useValue: 'lenient' }],
              resolve: {
                album: () => (
                  ran.push({
                    by: 'page resolver',
                    session: inject(SESSION),
                    policy: inject(POLICY),
                  }),
                  'album'
                ),
              },
              data: { kind: 'album' },
            },
          ],
        },
      ],
    },
  ];
  return { routes, ran, destroyed, pages: mod['pages'] as Page[] };
}

async function boot(routes: Routes, features: RouterFeatures[] = []) {
  const app = await render(mod['Shell'] as Type<unknown>, {
    providers: [
      provideNativeRouter(routes, ...features),
      { provide: ErrorHandler, useValue: { handleError: () => {} } },
    ],
  });
  await settle();
  const router = app.componentRef.injector.get(Router);
  const navigation = app.componentRef.injector.get(NativeNavigation);
  assert.equal(router.url, '/home');
  return { router, navigation };
}

async function dismiss(navigation: NativeNavigation, router: Router) {
  navigation.back();
  await settle();
  await settle();
  assert.equal(router.url, '/home');
}

/** The guards and resolvers of one navigation and the page it made share each instance. */
function assertShared(ran: ReturnType<typeof setup>['ran'], page: Page, withBar = true) {
  const bar = ran.find((entry) => entry.by === 'bar canActivate');
  // In its own tab the bar is up already, and its guard is not run again.
  if (withBar) {
    assert.equal(bar?.session, null, 'a guard never sees the providers of a route below its own');
    assert.equal(bar?.shell, page.shell, 'one instance of the tab bar route s service');
  }
  const below = ran.filter((entry) => entry.by !== 'bar canActivate');
  assert.deepEqual(below.map((entry) => entry.by).sort(), [
    'canActivate',
    'canActivateChild',
    'page resolver',
    'tab resolver',
  ]);
  for (const entry of below) {
    assert.equal(entry.session, page.session, `${entry.by} and the page share the tab's service`);
  }
  const policies = Object.fromEntries(below.map((entry) => [entry.by, entry.policy]));
  assert.equal(policies['canActivate'], 'strict', 'not the page s override');
  assert.equal(policies['canActivateChild'], 'strict', 'not the page s override');
  assert.equal(policies['page resolver'], 'lenient');
  assert.equal(page.policy, 'lenient');
}

describe('the providers of a page presented over another tab', () => {
  it('control: in its own tab, the guards, resolvers and page share one instance', async () => {
    const { routes, ran, pages } = setup();
    pages.length = 0;
    const { router } = await boot(routes);
    ran.length = 0;
    await router.navigateByUrl('/library/7');
    await settle();
    assert.equal(router.url, '/library/7');
    assert.equal(pages.length, 1);
    assertShared(ran, pages[0]!, false);
  });

  it('are one instance for its guards, its resolvers and the page, as in its tab', async () => {
    const { routes, ran, pages } = setup();
    pages.length = 0;
    const { router, navigation } = await boot(routes);
    ran.length = 0;
    await navigation.present('/library/7', { as: 'formSheet' });
    await settle();
    assert.equal(router.url, '/home(presented:library/7)');
    assert.equal(pages.length, 1);
    assertShared(ran, pages[0]!);
    // Its params and data as before: the data of the routes it sat inside merges into its own,
    // as an empty-path child's does, since the copies of those routes have no component.
    assert.deepEqual(pages[0]!.params, { id: '7' });
    assert.deepEqual(Object.fromEntries(Object.entries(pages[0]!.data)), {
      section: 'library',
      kind: 'album',
      tab: 'tab',
      album: 'album',
    });
    assert.equal(pages[0]!.title, 'Album');

    await dismiss(navigation, router);
  });

  for (const lazy of [false, true]) {
    it(`are the presented page s own after it was shown in its tab, not the tab s${lazy ? ', with a lazy page' : ''}`, async () => {
      const { routes, ran, pages } = setup(lazy);
      pages.length = 0;
      const { router, navigation } = await boot(routes);
      await router.navigateByUrl('/library/7');
      await settle();
      await router.navigateByUrl('/home');
      await settle();
      assert.equal(pages.length, 1);
      ran.length = 0;
      await navigation.present('/library/8', { as: 'formSheet' });
      await settle();
      assert.equal(router.url, '/home(presented:library/8)');
      assert.equal(pages.length, 2);
      assertShared(ran, pages[1]!);
      assert.notEqual(pages[1]!.session, pages[0]!.session, 'not the instance the tab has');

      await dismiss(navigation, router);
    });
  }

  it('are kept for the next presentation, as Angular keeps a route s injector', async () => {
    const { routes, ran, destroyed, pages } = setup();
    pages.length = 0;
    const { router, navigation } = await boot(routes);
    await navigation.present('/library/7', { as: 'formSheet' });
    await settle();
    await dismiss(navigation, router);
    ran.length = 0;
    await navigation.present('/library/8', { as: 'formSheet' });
    await settle();
    assert.equal(router.url, '/home(presented:library/8)');
    assert.equal(pages.length, 2);
    assertShared(ran, pages[1]!);
    assert.deepEqual(pages[1]!.params, { id: '8' });
    assert.equal(pages[1]!.session, pages[0]!.session);
    assert.deepEqual(destroyed, []);
  });

  it('are destroyed once it is dismissed, with withAutoCleanupInjectors()', async () => {
    const { routes, ran, destroyed, pages } = setup();
    pages.length = 0;
    const { router, navigation } = await boot(routes, [withAutoCleanupInjectors()]);
    ran.length = 0;
    await navigation.present('/library/7', { as: 'formSheet' });
    await settle();
    assertShared(ran, pages[0]!);
    const first = pages[0]!.session;
    await dismiss(navigation, router);
    assert.ok(destroyed.includes(first), 'the presented page s injectors go with it');
    assert.ok(destroyed.includes(pages[0]!.shell), 'each of them');

    ran.length = 0;
    await navigation.present('/library/8', { as: 'formSheet' });
    await settle();
    assert.equal(pages.length, 2);
    assertShared(ran, pages[1]!);
    assert.notEqual(pages[1]!.session, first, 'a new presentation makes new instances');
  });
});
