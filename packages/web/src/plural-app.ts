/**
 * Fixture for `plural.test.ts`. See `button-app.ts` for why a `@Component` lives out here.
 */
import { Component, signal } from '@angular/core';
import { Text } from '@ng-native/components';

@Component({
  selector: 'app-root',
  imports: [Text],
  template: `
    <text i18n="@@found">{count(), plural,
      one {{{ count() }} result}
      other {{{ count() }} results}
    }</text>
  `,
})
export class PluralApp {
  readonly count = signal(0);
}
