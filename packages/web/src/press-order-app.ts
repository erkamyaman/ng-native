import { Component, input, signal } from '@angular/core';
import { PressBehavior, Text } from '@ng-native/components';

@Component({
  selector: 'app-button',
  imports: [Text],
  hostDirectives: [{ directive: PressBehavior, outputs: ['press'] }],
  host: { accessibilityRole: 'button' },
  template: '<text>{{ label() }}</text>',
})
export class AppButton {
  readonly label = input.required<string>();
}

@Component({
  selector: 'app-root',
  imports: [AppButton],
  template: `
    <app-button id="other" label="Secondary" (press)="others.set(others() + 1)" />
    <app-button
      id="counter"
      [label]="'Pressed ' + count() + ' times'"
      (press)="count.set(count() + 1)"
    />
  `,
})
export class PressOrderApp {
  readonly count = signal(0);
  readonly others = signal(0);
}
