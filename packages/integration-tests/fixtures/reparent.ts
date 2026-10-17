import { Component, signal, viewChild } from '@angular/core';
import { Pressable } from '../../components/src/pressable.ts';
import { TemplateSlot } from '../../components/src/template-slot.ts';
import { Text } from '../../components/src/text.ts';
import { View } from '../../components/src/view.ts';

/** Projects its content into a container it can mount again, as a dock or a portal does. */
@Component({
  selector: 'x-remounting',
  imports: [TemplateSlot, View],
  template: `
    <ng-template #content><ng-content /></ng-template>
    @for (mount of mounts(); track mount) {
      <view nativeID="container"
        ><ng-container [templateSlot]="content" [templateSlotContext]="none"
      /></view>
    }
  `,
})
export class Remounting {
  readonly mounts = signal([0]);
  readonly none = {};
}

@Component({
  selector: 'x-reparent',
  imports: [Remounting, Text],
  template: `<x-remounting><text nativeID="moved">projected</text></x-remounting>`,
})
export class Reparent {
  readonly holder = viewChild.required(Remounting);
}

/** Projects its content behind an `@if`, so the content leaves with the block and comes back. */
@Component({
  selector: 'x-fold',
  imports: [View],
  template: `<view nativeID="box">
    @if (open()) {
      <ng-content />
    }
  </view>`,
})
export class Fold {
  readonly open = signal(true);
}

@Component({
  selector: 'x-folded',
  imports: [Fold, Pressable, View],
  template: `<x-fold
    ><view nativeID="row" (layout)="hits.set(hits() + 1)"><view nativeID="inner" /></view
    ><pressable nativeID="press" (press)="hits.set(hits())"
  /></x-fold>`,
})
export class Folded {
  readonly hits = signal(0);
  readonly fold = viewChild.required(Fold);
  readonly pressable = viewChild.required(Pressable);
}
