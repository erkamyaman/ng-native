import { Component, inject, InjectionToken } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Text } from '../../components/src/text.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';
import { NativeTab } from '../../router/src/native-tab.ts';
import { NativeTabsOutlet } from '../../router/src/native-tabs-outlet.ts';

/** A service of the tab bar's route. */
export const SHELL = new InjectionToken<object>('shell');
/** A stateful service of the tab's route, which its guards write and the page reads. */
export const SESSION = new InjectionToken<object>('session');
/** A value the tab's route gives and the page's own route overrides. */
export const POLICY = new InjectionToken<string>('policy');

/** What each page made saw, for the test to read. */
export const pages: {
  shell: object;
  session: object;
  policy: string;
  params: Record<string, string>;
  data: Record<string, unknown>;
  title: string | undefined;
}[] = [];

@Component({
  selector: 'x-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class Shell {}

@Component({
  selector: 'x-bar',
  imports: [NativeTab, NativeTabsOutlet],
  template: `
    <native-tabs-outlet>
      <native-tab path="home" title="Home" />
      <native-tab path="library" title="Library" />
    </native-tabs-outlet>
  `,
})
export class Bar {}

@Component({
  selector: 'x-tab-stack',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class TabStack {}

@Component({ selector: 'x-home', imports: [Text], template: `<text>home</text>` })
export class Home {}

@Component({ selector: 'x-library', imports: [Text], template: `<text>library</text>` })
export class Library {}

@Component({ selector: 'x-album', imports: [Text], template: `<text>album</text>` })
export class Album {
  constructor() {
    const { snapshot } = inject(ActivatedRoute);
    pages.push({
      shell: inject(SHELL),
      session: inject(SESSION),
      policy: inject(POLICY),
      params: { ...snapshot.params },
      data: { ...snapshot.data },
      title: snapshot.title,
    });
  }
}
