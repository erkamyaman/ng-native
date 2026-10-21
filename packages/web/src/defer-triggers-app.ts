/**
 * Fixture for `defer-triggers.test.ts`. See `button-app.ts` for why a `@Component` lives out here.
 */
import { Component } from '@angular/core';
import { Pressable, Text, View } from '@ng-native/components';

@Component({
  selector: 'app-root',
  imports: [Pressable, Text, View],
  template: `
    <pressable #trigger id="trigger"><text>open</text></pressable>
    @defer (on interaction(trigger)) {
      <text>interaction loaded</text>
    } @placeholder {
      <text>interaction waiting</text>
    }

    @defer (on hover) {
      <text>hover loaded</text>
    } @placeholder {
      <view id="hover-target"><text>hover waiting</text></view>
    }

    <view [style]="{ height: 3000 }"></view>
    @defer (on viewport) {
      <text>viewport loaded</text>
    } @placeholder {
      <view id="spot"><text>viewport waiting</text></view>
    }
  `,
})
export class DeferTriggersApp {}
