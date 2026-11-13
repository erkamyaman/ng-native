import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, email, form, required, validate } from '@angular/forms/signals';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { TuiInput } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiNotification, TuiNotificationService } from '@taiga-ui/core/components/notification';
import { TuiButtonLoading } from '@taiga-ui/kit/components/button-loading';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';

/** How long saving takes, with Taiga's loader on the button: there is no server to wait for. */
const SAVING_MS = 1200;

/** The profile: Taiga's text fields, a checkbox and a switch, bound with Signal Forms. */
@Component({
  selector: 'app-profile-form',
  imports: [
    FormField,
    TuiButton,
    TuiButtonLoading,
    TuiCheckbox,
    TuiInput,
    TuiLabel,
    TuiNotification,
    TuiSwitch,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .option {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    /*
     * Taiga puts a box in a label half a line down and lifts it by half its own height, so it
     * centres on the first line. Taiga writes the half line calc(var(--tui-lh) / 2), with
     * --tui-lh an em length, which the engine drops without a word; this is that length.
     */
    .option input[type='checkbox'] {
      inset-block-start: 0.7em;
    }
  `,
  template: `
    <div tuiNotification appearance="info" size="s">Your email is only used to sign in.</div>
    <tui-textfield>
      <label tuiLabel>Name</label>
      <input tuiInput testID="profile-name" [formField]="profile.name" />
    </tui-textfield>
    <tui-textfield>
      <label tuiLabel>Email</label>
      <input tuiInput testID="profile-email" [formField]="profile.email" />
    </tui-textfield>
    <label tuiLabel class="option">
      <input type="checkbox" tuiCheckbox testID="profile-terms" [formField]="profile.terms" />
      I agree to the terms
    </label>
    <label tuiLabel class="option">
      <input type="checkbox" tuiSwitch testID="profile-news" [formField]="profile.news" />
      Email me product news
    </label>
    <button
      tuiButton
      testID="profile-save"
      [disabled]="profile().invalid()"
      [loading]="saving()"
      (click)="save()"
    >
      Save
    </button>
  `,
})
export class ProfileForm {
  private readonly alerts = inject(TuiNotificationService);
  private readonly model = signal({ name: '', email: '', terms: false, news: true });
  protected readonly saving = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  protected readonly profile = form(this.model, (path) => {
    required(path.name);
    // Spaces alone are no name: the one saved is trimmed.
    validate(path.name, ({ value }) => (value().trim() ? undefined : { kind: 'required' }));
    required(path.email);
    email(path.email);
    validate(path.terms, ({ value }) => (value() ? undefined : { kind: 'required' }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.timer = setTimeout(() => this.saved(), SAVING_MS);
  }

  private saved(): void {
    this.saving.set(false);
    const { name, news } = this.model();
    this.alerts
      .open(news ? 'You will hear from us about what is new.' : 'No news emails.', {
        label: `Saved, ${name.trim()}`,
        appearance: 'positive',
      })
      .subscribe();
  }
}
