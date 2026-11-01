/**
 * What a route above a page of another tab does for that page when it is presented over the tab in
 * front: its title names the page when the page has none, its canDeactivate guard runs as the page
 * is dismissed, and its runGuardsAndResolvers decides when its resolvers run again, each as in the
 * page's own tab.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { ErrorHandler, type Type } from '@angular/core';
import {
  Router,
  TitleStrategy,
  type ActivatedRouteSnapshot,
  type Route,
  type RouterStateSnapshot,
  type Routes,
} from '@angular/router';
import { cleanup, render, settle } from '@ng-native/testing';
import { NativeNavigation } from '../router/src/native-navigation.ts';
import { provideNativeRouter } from '../router/src/provide-native-router.ts';
import { compileFixture } from './compile.ts';

afterEach(cleanup);

let mod: Record<string, unknown>;
before(async () => {
  mod = await compileFixture('fixtures/presented-front.ts');
});

/**
 * The title Angular's own strategy would give the deepest route of each outlet: the title of the
 * deepest route on the way that has one. Angular's strategy reads the primary outlet only.
 */
class OutletTitles extends TitleStrategy {
  last: Record<string, string | undefined> = {};

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.last = {
      primary: this.titleIn(snapshot.root, 'primary'),
      presented: this.titleIn(snapshot.root, 'presented'),
    };
  }

  private titleIn(root: ActivatedRouteSnapshot, outlet: string): string | undefined {
    let title: string | undefined;
    let route: ActivatedRouteSnapshot | undefined = root;
    while (route) {
      title = this.getResolvedTitleForRoute(route) ?? title;
      route = route.children.find((child) => child.outlet === outlet);
    }
    return title;
  }
}

/** The app's routes, with `library` as the tab's route the page sits inside. */
function routes(library: Partial<Route>): Routes {
  return [
    {
      path: '',
      component: mod['Bar'] as Type<unknown>,
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'home' },
        { path: 'home', component: mod['Home'] as Type<unknown> },
        {
          path: 'library',
          component: mod['TabStack'] as Type<unknown>,
          children: [
            { path: '', component: mod['Library'] as Type<unknown> },
            { path: ':id', component: mod['Album'] as Type<unknown> },
          ],
          ...library,
        },
      ],
    },
  ];
}

async function boot(library: Partial<Route>) {
  const titles = new OutletTitles();
  const app = await render(mod['Shell'] as Type<unknown>, {
    providers: [
      provideNativeRouter(routes(library)),
      { provide: TitleStrategy, useValue: titles },
      { provide: ErrorHandler, useValue: { handleError: () => {} } },
    ],
  });
  await settle();
  const router = app.componentRef.injector.get(Router);
  const navigation = app.componentRef.injector.get(NativeNavigation);
  assert.equal(router.url, '/home');
  return { router, navigation, titles };
}

async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await settle();
}

describe('the routes above a page of another tab, presented over the one in front', () => {
  it("name the page with their title when it has none, as in the page's tab", async () => {
    const tab = await boot({ title: 'Library' });
    await tab.router.navigateByUrl('/library/7');
    await settled();
    assert.equal(tab.titles.last['primary'], 'Library', 'in the tab');
    cleanup();

    const { navigation, router, titles } = await boot({ title: 'Library' });
    await navigation.present('/library/7', { as: 'formSheet' });
    await settled();
    assert.equal(router.url, '/home(presented:library/7)');
    assert.equal(titles.last['presented'], 'Library', 'presented');
  });

  it("run their canDeactivate guard as the page leaves, as in the page's tab", async () => {
    let allow = false;
    let runs = 0;
    const canDeactivate = [
      () => {
        runs++;
        return allow;
      },
    ];

    const tab = await boot({ canDeactivate });
    await tab.router.navigateByUrl('/library/7');
    await settled();
    await tab.router.navigateByUrl('/home');
    await settled();
    assert.equal(runs, 1, 'in the tab, leaving it');
    assert.equal(tab.router.url, '/library/7', 'refused in the tab');
    cleanup();

    runs = 0;
    const { navigation, router } = await boot({ canDeactivate });
    await navigation.present('/library/7', { as: 'formSheet' });
    await settled();
    assert.equal(router.url, '/home(presented:library/7)');
    assert.equal(runs, 0, 'not as the page is presented');

    navigation.back();
    await settled();
    assert.equal(runs, 1, 'as the presented page is dismissed');
    assert.equal(router.url, '/home(presented:library/7)', 'and the page stays up');

    allow = true;
    navigation.back();
    await settled();
    assert.equal(runs, 2);
    assert.equal(router.url, '/home', 'dismissed once the guard agrees');
  });

  it("run their resolvers again when their runGuardsAndResolvers says, as in the page's tab", async () => {
    let runs = 0;
    const library: Partial<Route> = {
      runGuardsAndResolvers: 'paramsOrQueryParamsChange',
      resolve: { library: () => ++runs },
    };

    const tab = await boot(library);
    await tab.router.navigateByUrl('/library/7');
    await settled();
    await tab.router.navigateByUrl('/library/7?sort=title');
    await settled();
    assert.equal(runs, 2, 'in the tab, again for the new query params');
    cleanup();

    runs = 0;
    const { navigation, router } = await boot(library);
    await navigation.present('/library/7', { as: 'formSheet' });
    await settled();
    assert.equal(runs, 1);
    await router.navigateByUrl('/home(presented:library/7)?sort=title');
    await settled();
    assert.equal(router.url, '/home(presented:library/7)?sort=title');
    assert.equal(runs, 2, 'presented, again for the new query params');
  });

  it('leave a page behind a canLoad guard to its own place, which runs the guard', async () => {
    let loads = 0;
    const children = (): Routes => {
      loads++;
      return [{ path: ':id', component: mod['Album'] as Type<unknown> }];
    };
    const { navigation, router } = await boot({
      component: undefined,
      children: undefined,
      canLoad: [() => false],
      loadChildren: children,
    });
    await navigation.present('/library/7', { as: 'formSheet' });
    await settled();
    assert.equal(loads, 0, 'the refused children are not loaded');
    assert.equal(router.url, '/home', 'and the page is not shown');
  });
});
