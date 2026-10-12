import { Component, signal } from '@angular/core';
import { View } from '../../components/src/view.ts';

/** Bound declarations in `em`, measured against the font size in scope, as a stylesheet's are. */
@Component({
  selector: 'x-bound-em',
  imports: [View],
  template: `
    <view testID="plain" [style.width]="'2em'" [style.height]="'2em'"></view>
    <view testID="own" class="small" [style.width]="'2em'"></view>
    <view class="large"><view testID="inherited" [style.width]="'2em'"></view></view>
    <view class="large">
      <view testID="font" [style.font-size]="'1.5em'" [style.width]="'2em'"></view>
    </view>
    <view [style.font-size.px]="font()">
      <view testID="follows" [style.width]="'2em'"></view>
    </view>
    <view testID="switching" [style.width]="width()"></view>
    <view testID="object" [style]="{ width: '0.5em', marginTop: '1em' }"></view>
  `,
  styles: `
    .small {
      font-size: 10px;
    }
    .large {
      font-size: 20px;
    }
  `,
})
export class BoundEm {
  readonly font = signal<number | undefined>(12);
  readonly width = signal<string | number | undefined>('3em');
}
