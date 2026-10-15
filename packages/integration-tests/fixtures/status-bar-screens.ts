import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import { Text } from '../../components/src/text.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';

@Component({
  selector: 'x-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class Shell {}

@Component({ selector: 'x-home', imports: [Text], template: `<text>home</text>` })
export class Home {}

@Component({ selector: 'x-list', imports: [Text], template: `<text>list</text>` })
export class List {}

/** A page that sets the bar on its own screen through a host binding. */
@Component({
  selector: 'x-video',
  imports: [Text],
  host: { '[statusBarStyle]': "'light'", '[statusBarHidden]': 'true' },
  template: `<text>video</text>`,
})
export class Video {}

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'photo', component: List },
  { path: 'list', component: List },
  { path: 'video', component: Video },
];
