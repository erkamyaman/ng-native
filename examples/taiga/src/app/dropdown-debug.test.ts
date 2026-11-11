import { Component, signal } from '@angular/core';
import { screen, settle, userEvent } from '@ng-native/testing';
import { TuiButton, TuiDataList, TuiDropdown, TuiRoot } from '@taiga-ui/core';
import { afterEach, test } from 'vitest';
import { safeCleanup, start } from './start.ts';

afterEach(() => safeCleanup());

@Component({
  selector: 'app-dropdown',
  imports: [TuiRoot, TuiButton, TuiDropdown, TuiDataList],
  template: `<tui-root>
    <button tuiButton [tuiDropdown]="menu" [(tuiDropdownOpen)]="open">Menu</button>
    <ng-template #menu>
      <tui-data-list>
        <button tuiOption>One</button>
      </tui-data-list>
    </ng-template>
    <text>open {{ open }}</text>
  </tui-root>`,
})
class DropdownPage {
  protected open = false;
}

test('dropdown debug', async () => {
  const r = await start(DropdownPage);
  const w = globalThis as any;
  const doc = w.document;
  const errors: unknown[] = [];
  w.addEventListener?.('error', (e: unknown) => errors.push(e));
  if (process.env['DOCLISTEN']) doc.addEventListener('click', (e: any) => console.log('doc click target', e.target?.tagName, e.target?.nodeName));
  await userEvent.press(screen.getByText('Menu'));
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await settle();
  console.log('texts', screen.queryByText('open true') ? 'open true' : 'open false');
  console.log(r.fabric.render({ props: true }));
  const dd = doc.querySelector('tui-dropdown'); console.log('dd style attr', dd?.getAttribute('style'), 'style.top', dd?.style?.top, 'matches', dd?.matches('[style*=top]'), 'class', dd?.className, 'rAF', typeof requestAnimationFrame);
  console.log('dropdown hosts', doc.querySelectorAll('tui-dropdown').length, doc.querySelectorAll('tui-data-list').length);
});
