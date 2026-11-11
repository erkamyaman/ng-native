import { Component, signal } from '@angular/core';
import { screen, settle, userEvent } from '@ng-native/testing';
import { TuiRoot, TuiButton } from '@taiga-ui/core';
import { afterEach, expect, test } from 'vitest';
import { safeCleanup, start, themeWarnings } from './start.ts';

afterEach(() => safeCleanup());

@Component({
  selector: 'app-root',
  imports: [TuiRoot, TuiButton],
  template: `
    <tui-root>
      <text>Hello</text>
      <button tuiButton appearance="primary" (click)="count.set(count() + 1)">Pressed {{ count() }}</button>
    </tui-root>
  `,
})
class RootApp {
  protected readonly count = signal(0);
}

test('TuiRoot and TuiButton', async () => {
  const r = await start(RootApp);
  if (process.env['TREE']) console.log(r.fabric.render({ props: true }));
  if (process.env['THEME_WARNINGS']) {
    const { writeFileSync } = process.getBuiltinModule('node:fs');
    writeFileSync(process.env['THEME_WARNINGS'], themeWarnings.join('\n'));
  }
  expect(screen.getByText('Hello')).toBeTruthy();
  await userEvent.press(screen.getByText('Pressed 0'));
  await settle();
  expect(screen.getByText('Pressed 1')).toBeTruthy();
});
