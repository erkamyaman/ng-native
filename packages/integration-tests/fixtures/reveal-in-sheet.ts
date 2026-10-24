import { Component } from '@angular/core';
import type { Routes } from '@angular/router';
import { Modal } from '../../components/src/modal.ts';
import { ScrollView } from '../../components/src/scroll-view.ts';
import { Text } from '../../components/src/text.ts';
import { TextInput } from '../../components/src/text-input.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';

@Component({
  selector: 'x-reveal-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class RevealShell {}

@Component({ selector: 'x-reveal-home', imports: [Text], template: `<text>home</text>` })
export class RevealHome {}

/** Fields down a scrolling form, presented as a sheet or pushed. */
@Component({
  selector: 'x-reveal-form',
  imports: [ScrollView, TextInput],
  template: `
    <scroll-view nativeID="form">
      <text-input nativeID="first" />
      <text-input nativeID="second" />
    </scroll-view>
  `,
})
export class RevealForm {}

export const revealRoutes: Routes = [
  { path: '', component: RevealHome },
  { path: 'form', component: RevealForm },
];

/** The same form in React Native's own modal, presented as a page sheet. */
@Component({
  selector: 'x-reveal-modal-form',
  imports: [Modal, ScrollView, TextInput],
  template: `
    <modal [visible]="true" presentationStyle="pageSheet">
      <scroll-view nativeID="form">
        <text-input nativeID="first" />
        <text-input nativeID="second" />
      </scroll-view>
    </modal>
  `,
})
export class RevealModalForm {}

/** A stack in React Native's own page sheet: its screens are pushed, inside the sheet. */
@Component({
  selector: 'x-reveal-modal-shell',
  imports: [Modal, NativeStackOutlet],
  template: `
    <modal [visible]="true" presentationStyle="pageSheet"><native-stack-outlet /></modal>
  `,
})
export class RevealModalShell {}

export const revealModalRoutes: Routes = [{ path: '', component: RevealForm }];

/** The same stack, for the form to be pushed onto it. */
export const revealModalPushRoutes: Routes = revealRoutes;
