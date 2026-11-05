import { Component, signal } from '@angular/core';
import { NativeHeader } from '../../router/src/native-header.ts';

const template = `
  <native-header title="Inbox" [hideBackButton]="on()" [disableBackButtonMenu]="on()" />
`;

/** Boolean router inputs bound to one value, `false` to start with. */
@Component({
  selector: 'x-router-boolean-inputs',
  imports: [NativeHeader],
  template,
})
export class RouterBooleanInputs {
  readonly on = signal<boolean | null>(false);
}

/** The same inputs bound to `null` from the first pass. */
@Component({
  selector: 'x-router-boolean-inputs-null',
  imports: [NativeHeader],
  template,
})
export class RouterBooleanInputsNull {
  readonly on = signal<boolean | null>(null);
}
