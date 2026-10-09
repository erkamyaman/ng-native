/**
 * Fixture for `browser/paging.test.ts`: a horizontal and a vertical scroll view, each three pages
 * of its own size, whose `pagingEnabled` the test changes. See `button-app.ts`'s doc comment for
 * why a real `@Component` has to live in its own file.
 */
import { Component, signal } from '@angular/core';
import { ScrollView, View } from '@ng-native/components';

@Component({
  selector: 'app-root',
  imports: [ScrollView, View],
  template: `
    <view style="width: 200px">
      <scroll-view id="row" horizontal [pagingEnabled]="paging()" style="height: 100px">
        @for (page of pages; track page) {
          <view style="width: 200px; height: 100px"></view>
        }
      </scroll-view>
      <scroll-view id="column" [pagingEnabled]="paging()" style="height: 200px">
        @for (page of pages; track page) {
          <view style="height: 200px"></view>
        }
      </scroll-view>
    </view>
  `,
})
export class PagingApp {
  readonly paging = signal<boolean | undefined>(true);
  protected readonly pages = [1, 2, 3];
}
