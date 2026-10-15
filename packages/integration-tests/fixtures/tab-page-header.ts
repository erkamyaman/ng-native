import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import { Text } from '../../components/src/text.ts';
import { NativeHeader } from '../../router/src/native-header.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';
import { NativeTab } from '../../router/src/native-tab.ts';
import { NativeTabsOutlet } from '../../router/src/native-tabs-outlet.ts';

@Component({
  selector: 'x-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class Shell {}

/** The tabs page as the tabs guide writes it: a page of the stack, its own bar hidden. */
@Component({
  selector: 'x-tabs',
  imports: [NativeHeader, NativeTab, NativeTabsOutlet],
  template: `
    <native-header [hidden]="true" nativeID="tabs-bar" />
    <native-tabs-outlet>
      <native-tab path="library" title="Library" />
      <native-tab path="inbox" title="Inbox" />
    </native-tabs-outlet>
  `,
})
export class Tabs {}

/** A tab's page with no stack of its own, which writes a header anyway. */
@Component({
  selector: 'x-library',
  imports: [NativeHeader, Text],
  template: `
    <native-header title="Library" nativeID="library-bar" />
    <text>library</text>
  `,
})
export class Library {}

@Component({ selector: 'x-inbox', imports: [Text], template: `<text>inbox</text>` })
export class Inbox {}

export const routes: Routes = [
  {
    path: '',
    component: Tabs,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'library' },
      { path: 'library', component: Library },
      { path: 'inbox', component: Inbox },
    ],
  },
];
