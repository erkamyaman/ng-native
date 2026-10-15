import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import { Pressable } from '../../components/src/pressable.ts';
import { Text } from '../../components/src/text.ts';
import { NativeRouterLink } from '../../router/src/native-router-link.ts';
import { Album, Bar, Library, TabStack } from './tab-stacks.ts';

export { Shell } from './tab-stacks.ts';

/** Home, with links to an album in the Library tab, which nobody has opened yet. */
@Component({
  selector: 'x-home',
  imports: [Pressable, Text, NativeRouterLink],
  template: `
    <text>home</text>
    <pressable testID="album" nativeRouterLink="/library/7"><text>open album</text></pressable>
    <pressable testID="query" nativeRouterLink="/library/7?from=home"
      ><text>with query</text></pressable
    >
    <pressable testID="relative" nativeRouterLink="../library/7"><text>relative</text></pressable>
  `,
})
export class Home {}

export const routes: Routes = [
  {
    path: '',
    component: Bar,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: Home },
      {
        path: 'library',
        component: TabStack,
        children: [
          { path: '', component: Library },
          { path: ':id', component: Album },
        ],
      },
    ],
  },
];
