import { Component, signal } from '@angular/core';
import { ScrollView } from '../../components/src/scroll-view.ts';
import { Text } from '../../components/src/text.ts';
import { NativeHeader } from '../../router/src/native-header.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';
import { NativeToolbar, NativeToolbarItem } from '../../router/src/native-toolbar.ts';

/** A screen's bottom toolbar as Mail has it: a filter, the search field, and compose. */
@Component({
  selector: 'x-toolbar-host',
  imports: [NativeToolbar, NativeToolbarItem],
  template: `
    <native-toolbar>
      <native-toolbar-item
        systemImageName="line.3.horizontal.decrease"
        accessibilityLabel="Filter"
        (press)="filtered = filtered + 1"
      />
      <native-toolbar-item type="fluidSpacer" />
      <native-toolbar-item type="searchBar" />
      <native-toolbar-item type="fixedSpacer" width="12" />
      @if (composing()) {
        <native-toolbar-item
          title="Compose"
          barButtonItemStyle="prominent"
          hidesSharedBackground
          [disabled]="busy()"
          (press)="composed = composed + 1"
        />
      }
    </native-toolbar>
  `,
})
export class ToolbarHost {
  readonly composing = signal(true);
  readonly busy = signal(false);
  filtered = 0;
  composed = 0;
}

@Component({
  selector: 'x-toolbar-shell',
  imports: [NativeStackOutlet],
  template: `<native-stack-outlet />`,
})
export class ToolbarShell {}

/** The header guide's Inbox, cut down: a large title, a bottom toolbar, then the scroll view. */
@Component({
  selector: 'x-toolbar-inbox',
  imports: [NativeHeader, NativeToolbar, NativeToolbarItem, ScrollView, Text],
  template: `
    <native-header title="Inbox" [largeTitle]="true" />
    <native-toolbar>
      <native-toolbar-item systemImageName="square.and.pencil" accessibilityLabel="Compose" />
    </native-toolbar>
    <scroll-view contentInsetAdjustmentBehavior="automatic">
      <text>All mail</text>
    </scroll-view>
  `,
})
export class ToolbarInbox {}
