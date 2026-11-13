/** The boxes of `mask-cases.ts`, for `web-compat-mask.test.ts` to draw. */
import { Component, signal } from '@angular/core';
import { MASK_CASES } from './mask-cases.ts';

@Component({
  selector: 'x-mask-boxes',
  template: `
    @if (shown()) {
      @for (each of cases; track each.name) {
        <div [attr.nativeID]="each.name" [class]="each.name" [class.large]="large()"></div>
      }
    }
  `,
})
export class MaskBoxes {
  protected readonly cases = MASK_CASES;
  /** Shown once the test lays the screen out, as a device has it laid out before they come. */
  readonly shown = signal(false);
  /** Each box made as big as the large Taiga icon, after it is drawn. */
  readonly large = signal(false);
}
