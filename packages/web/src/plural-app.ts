import { Component, signal } from '@angular/core';
import { Text } from '@ng-native/components';

@Component({
  selector: 'app-plural',
  imports: [Text],
  template: `
    <text i18n="@@found">{count(), plural,
      one {{{ count() }} result}
      other {{{ count() }} results}
    }</text>
  `,
})
export class PluralApp {
  readonly count = signal(1);
}

@Component({
  selector: 'app-plural-beside-element',
  imports: [Text],
  template: `
    <text i18n
      >Found <text>{{ count() }}</text> {count(), plural, one {match} other {matches}}</text
    >
  `,
})
export class PluralBesideElementApp {
  readonly count = signal(1);
}

@Component({
  selector: 'app-plural-in-view',
  imports: [Text],
  template: `
    <text>
      @if (shown()) {
        <ng-container i18n>{count(), plural,
          one {one left}
          other {{{ count() }} left}
        }</ng-container>
      }
    </text>
  `,
})
export class PluralInViewApp {
  readonly count = signal(1);
  readonly shown = signal(true);
}
