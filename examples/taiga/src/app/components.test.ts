import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { screen, settle, userEvent } from '@ng-native/testing';
import {
  TuiButton,
  TuiCheckbox,
  TuiDataList,
  TuiDialogService,
  TuiDropdown,
  TuiHint,
  TuiIcon,
  TuiInput,
  TuiLoader,
  TuiNotification,
  TuiNotificationService,
  TuiRoot,
} from '@taiga-ui/core';
// Secondary entry points: the `@taiga-ui/kit` barrel loads TuiRating, which the linker leaves unlinked.
import { TuiAccordion } from '@taiga-ui/kit/components/accordion';
import { TuiAvatar } from '@taiga-ui/kit/components/avatar';
import { TuiBadge } from '@taiga-ui/kit/components/badge';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { TuiTabs } from '@taiga-ui/kit/components/tabs';
import { afterEach, expect, test, vi } from 'vitest';
import { safeCleanup, start } from './start.ts';

afterEach(() => safeCleanup());
const dump = (r: { fabric: { render(o?: { props?: boolean }): string } }) => {
  if (process.env['TREE']) console.log(r.fabric.render({ props: process.env['TREE'] === 'props' }));
};

@Component({
  selector: 'app-textfield',
  imports: [TuiRoot, TuiInput, FormsModule],
  template: `<tui-root>
    <tui-textfield>
      <label tuiLabel>Name</label>
      <input tuiInput testID="name" [(ngModel)]="name" />
    </tui-textfield>
    <text>Hi {{ name }}</text>
  </tui-root>`,
})
class TextfieldPage {
  protected name = '';
}

@Component({
  selector: 'app-toggles',
  imports: [TuiRoot, TuiCheckbox, TuiSwitch, FormsModule],
  template: `<tui-root>
    <input type="checkbox" tuiCheckbox testID="cb" [(ngModel)]="a" />
    <input type="checkbox" tuiSwitch testID="sw" [(ngModel)]="b" />
    <text>a={{ a }} b={{ b }}</text>
  </tui-root>`,
})
class TogglesPage {
  protected a = false;
  protected b = false;
}

@Component({
  selector: 'app-statics',
  imports: [TuiRoot, TuiIcon, TuiBadge, TuiAvatar, TuiLoader],
  template: `<tui-root>
    <tui-icon icon="@tui.heart" testID="icon" />
    <span tuiBadge appearance="positive" testID="badge">New</span>
    <div tuiAvatar="AB" testID="avatar"></div>
    <tui-loader [loading]="true" testID="loader" />
  </tui-root>`,
})
class StaticsPage {}

@Component({
  selector: 'app-dialog',
  imports: [TuiRoot, TuiButton],
  template: `<tui-root><button tuiButton (click)="open()">Open</button></tui-root>`,
})
class DialogPage {
  private readonly dialogs = inject(TuiDialogService);
  protected open() {
    this.dialogs.open('Dialog body', { label: 'Dialog title', size: 's' }).subscribe();
  }
}

@Component({
  selector: 'app-dropdown',
  imports: [TuiRoot, TuiButton, TuiDropdown, TuiDataList],
  template: `<tui-root>
    <button tuiButton [tuiDropdown]="menu" [(tuiDropdownOpen)]="open">Menu</button>
    <ng-template #menu>
      <tui-data-list>
        <button tuiOption (click)="pick('One')">One</button>
        <button tuiOption (click)="pick('Two')">Two</button>
      </tui-data-list>
    </ng-template>
    <text>picked {{ picked() }}</text>
  </tui-root>`,
})
class DropdownPage {
  protected open = false;
  protected readonly picked = signal('-');
  protected pick(v: string) {
    this.picked.set(v);
    this.open = false;
  }
}

@Component({
  selector: 'app-hint',
  imports: [TuiRoot, TuiButton, TuiHint],
  template: `<tui-root><button tuiButton tuiHint="Hint text" [tuiHintShowDelay]="0">Hover me</button></tui-root>`,
})
class HintPage {}

@Component({
  selector: 'app-accordion',
  imports: [TuiRoot, TuiAccordion],
  template: `<tui-root>
    <tui-accordion>
      <button tuiAccordion>Section</button>
      <tui-expand><text>Body text</text></tui-expand>
    </tui-accordion>
  </tui-root>`,
})
class AccordionPage {}

@Component({
  selector: 'app-tabs',
  imports: [TuiRoot, TuiTabs],
  template: `<tui-root>
    <tui-tabs [(activeItemIndex)]="index">
      <button tuiTab>First</button>
      <button tuiTab>Second</button>
    </tui-tabs>
    <text>tab {{ index }}</text>
  </tui-root>`,
})
class TabsPage {
  protected index = 0;
}

@Component({
  selector: 'app-notification',
  imports: [TuiRoot, TuiButton, TuiNotification],
  template: `<tui-root>
    <div tuiNotification appearance="info">Inline note</div>
    <button tuiButton (click)="alert()">Alert</button>
  </tui-root>`,
})
class NotificationPage {
  private readonly alerts = inject(TuiNotificationService);
  protected alert() {
    this.alerts.open('Saved!', { label: 'Alert title', autoClose: 0 }).subscribe();
  }
}

test('TuiInput in tui-textfield takes typing', async () => {
  const r = await start(TextfieldPage);
  dump(r);
  expect(screen.getByText('Name')).toBeTruthy();
  const user = userEvent.setup();
  await user.type(screen.getByTestId('name'), 'Ada');
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Hi Ada')).toBeTruthy());
});

test('TuiCheckbox and TuiSwitch toggle', async () => {
  const r = await start(TogglesPage);
  dump(r);
  await userEvent.press(screen.getByTestId('cb'));
  await settle();
  await userEvent.press(screen.getByTestId('sw'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('a=true b=true')).toBeTruthy());
});

test('TuiIcon, TuiBadge, TuiAvatar, TuiLoader render', async () => {
  const r = await start(StaticsPage);
  dump(r);
  expect(screen.getByText('New')).toBeTruthy();
  expect(screen.getByTestId('icon')).toBeTruthy();
  expect(screen.getByTestId('loader')).toBeTruthy();
  expect(screen.getByText('AB')).toBeTruthy();
});

test('TuiDialogService opens a dialog', async () => {
  const r = await start(DialogPage);
  await userEvent.press(screen.getByText('Open'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Dialog body')).toBeTruthy(), { timeout: 3000 });
  dump(r);
  expect(screen.getByText('Dialog title')).toBeTruthy();
});

test('TuiDropdown with TuiDataList opens and picks', async () => {
  const r = await start(DropdownPage);
  await userEvent.press(screen.getByText('Menu'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Two')).toBeTruthy(), { timeout: 3000 });
  dump(r);
  await userEvent.press(screen.getByText('Two'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('picked Two')).toBeTruthy());
});

test('TuiHint shows', async () => {
  const r = await start(HintPage);
  const target = screen.getByText('Hover me');
  // On a phone (WA_IS_MOBILE, from web-compat's iPhone/Android user agent) Taiga shows a hint on a tap.
  await userEvent.press(target);
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Hint text')).toBeTruthy(), { timeout: 2000 });
  dump(r);
});

test('TuiAccordion expands', async () => {
  const r = await start(AccordionPage);
  expect(screen.queryByText('Body text')).toBeNull();
  await userEvent.press(screen.getByText('Section'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Body text')).toBeTruthy(), { timeout: 2000 });
  dump(r);
});

test('TuiTabs switch', async () => {
  const r = await start(TabsPage);
  dump(r);
  await userEvent.press(screen.getByText('Second'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('tab 1')).toBeTruthy());
});

test('TuiNotification inline and TuiNotificationService (alert)', async () => {
  const r = await start(NotificationPage);
  expect(screen.getByText('Inline note')).toBeTruthy();
  await userEvent.press(screen.getByText('Alert'));
  await settle();
  await vi.waitFor(() => expect(screen.getByText('Saved!')).toBeTruthy(), { timeout: 3000 });
  dump(r);
});
