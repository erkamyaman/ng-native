/**
 * Fixture for `browser/number-of-lines.test.ts`: a one-line text beside a long one whose
 * `numberOfLines` and `ellipsizeMode` the test changes, in a column narrow enough to wrap it.
 * See `button-app.ts`'s doc comment for why a real `@Component` has to live in its own file.
 */
import { Component, signal } from '@angular/core';
import { Text, View } from '@ng-native/components';

@Component({
  selector: 'app-root',
  imports: [Text, View],
  template: `
    <view style="width: 120px">
      <text id="short">Short</text>
      <text id="long" [numberOfLines]="lines()" [ellipsizeMode]="mode()">
        A sentence long enough to wrap onto several lines in a narrow column,
        <text id="nested" [numberOfLines]="1">with a nested run inside it</text>
        and more words after that run.
      </text>
    </view>
  `,
})
export class NumberOfLinesApp {
  readonly lines = signal<number | undefined>(1);
  readonly mode = signal<'head' | 'middle' | 'tail' | 'clip' | undefined>(undefined);
}
