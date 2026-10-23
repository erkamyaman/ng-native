import { Component, signal } from '@angular/core';
import type { Routes } from '@angular/router';
import { Text } from '../../components/src/text.ts';
import { NativeHeader } from '../../router/src/native-header.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';
import { NativeTab } from '../../router/src/native-tab.ts';
import { NativeTabsOutlet } from '../../router/src/native-tabs-outlet.ts';

/** What the detail page binds `tabBarHidden` to, for a test to change while it is in front. */
export const detailHidesBar = signal<boolean | undefined>(true);
/** Whether the detail page has its header at all, for a test to take it away. */
export const detailHasHeader = signal(true);
/** What the bar binds its own `barHidden` to. */
export const barHidden = signal<boolean | undefined>(undefined);

@Component({
  selector: 'x-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class Shell {}

@Component({
  selector: 'x-bar',
  imports: [NativeHeader, NativeTab, NativeTabsOutlet],
  template: `
    <native-header [hidden]="true" />
    <native-tabs-outlet [barHidden]="hidden()">
      <native-tab path="customers" title="Customers" />
      <native-tab path="settings" title="Settings" />
    </native-tabs-outlet>
  `,
})
export class Bar {
  protected readonly hidden = barHidden;
}

@Component({
  selector: 'x-tab-stack',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class TabStack {}

@Component({
  selector: 'x-customer-list',
  imports: [NativeHeader, Text],
  template: `<native-header title="Customers" /><text>list</text>`,
})
export class CustomerList {}

@Component({
  selector: 'x-customer-detail',
  imports: [NativeHeader, Text],
  template: `
    @if (hasHeader()) {
      <native-header title="Customer" [tabBarHidden]="hides()" />
    }
    <text>detail</text>
  `,
})
export class CustomerDetail {
  protected readonly hides = detailHidesBar;
  protected readonly hasHeader = detailHasHeader;
}

@Component({ selector: 'x-settings', imports: [Text], template: `<text>settings</text>` })
export class Settings {}

/** Pushed on the app's stack, over the whole tab bar. */
@Component({
  selector: 'x-over',
  imports: [NativeHeader, Text],
  template: `<native-header title="Over" [tabBarHidden]="true" /><text>over</text>`,
})
export class Over {}

const tabs = (first: string): Routes => [
  {
    path: '',
    component: Bar,
    children: [
      { path: '', pathMatch: 'full', redirectTo: first },
      {
        path: 'customers',
        component: TabStack,
        children: [
          { path: '', component: CustomerList },
          { path: ':id', component: CustomerDetail },
        ],
      },
      { path: 'settings', component: Settings },
    ],
  },
  { path: 'over', component: Over },
];

export const routes = tabs('customers');

/** The app opening straight on a detail page, as a link it is launched by does. */
export const launchedOnDetail = tabs('customers/1');
