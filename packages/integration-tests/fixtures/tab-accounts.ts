import type { Routes } from '@angular/router';
import { reuseScreen } from '../../router/src/native-stack-reuse-strategy.ts';
import { Bar, Detail, Home, Result, Search, Shell, TabStack } from './tab-stacks.ts';

export { Shell };

/** The tab bar of one account, under the account's id, kept as one screen when the id changes. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'org/1/home' },
  reuseScreen({
    path: 'org/:org',
    component: Bar,
    children: [
      { path: 'home', component: Home },
      {
        path: 'search',
        component: TabStack,
        children: [
          { path: '', component: Search },
          { path: ':q', component: Result },
        ],
      },
    ],
  }),
  { path: 'detail/:id', component: Detail },
];
