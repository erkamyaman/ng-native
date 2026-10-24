import { Component, signal } from '@angular/core';
import { Text } from '../../components/src/text.ts';
import { View } from '../../components/src/view.ts';
import { NativeHeader } from '../../router/src/native-header.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';
import { ScreenSafeAreaView } from '../../router/src/screen-safe-area-view.ts';

/** What the page below binds on its header, for a test to change. */
export const header = signal<{
  hidden?: boolean;
  translucent?: boolean;
  largeTitle?: boolean;
  absent?: boolean;
}>({});

/** Whether the page shows a line written at its root after it first rendered. */
export const later = signal(false);

/** A page of a stack with its content at the root of its template, as an app writes one. */
@Component({
  selector: 'x-opening-hours',
  imports: [NativeHeader, ScreenSafeAreaView, Text],
  template: `
    @if (!header().absent) {
      <native-header
        title="Opening hours"
        [hidden]="header().hidden"
        [translucent]="header().translucent"
        [largeTitle]="header().largeTitle"
      />
    }
    <text>Monday to Friday</text>
    <screen-safe-area-view nativeID="own" [edges]="['top', 'bottom']">
      <text>Weekends</text>
    </screen-safe-area-view>
    @if (later()) {
      <text>Closed on holidays</text>
    }
  `,
})
export class OpeningHours {
  protected readonly header = header;
  protected readonly later = later;
}

/** Whether the page below shows a box between its two, written at the root of its template. */
export const between = signal(false);

/**
 * A page that lays out what is at the root of its template by its own `:host` style, and styles
 * those elements by a `:host >` rule.
 */
@Component({
  selector: 'x-centred',
  imports: [NativeHeader, Text, View],
  template: `
    <native-header title="Centred" />
    <view class="cell"><text>First</text></view>
    @if (between()) {
      <view class="cell"><text>Between</text></view>
    }
    <view class="cell"><text>Last</text></view>
  `,
  styles: `
    :host {
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: 12px;
      background-color: rgb(1, 2, 3);
    }
    :host > .cell {
      opacity: 0.5;
    }
  `,
})
export class Centred {
  protected readonly between = between;
}

@Component({
  selector: 'x-opening-hours-stack',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class OpeningHoursStack {}
