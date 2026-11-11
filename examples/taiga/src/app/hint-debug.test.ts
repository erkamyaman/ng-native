import { Component } from '@angular/core';
import { screen, settle, userEvent } from '@ng-native/testing';
import { TuiButton, TuiHint, TuiRoot } from '@taiga-ui/core';
import { afterEach, test } from 'vitest';
import { safeCleanup, start } from './start.ts';

afterEach(() => safeCleanup());

@Component({
  selector: 'app-hint',
  imports: [TuiRoot, TuiButton, TuiHint],
  template: `<tui-root><button tuiButton tuiHint="Hint text" [tuiHintShowDelay]="0">Hover me</button></tui-root>`,
})
class HintPage {}

test('hint debug', async () => {
  const r = await start(HintPage);
  await userEvent.press(screen.getByText('Hover me'));
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 600));
  await settle();
  const doc = (globalThis as any).document;
  const hint = doc.querySelector('tui-hint');
  console.log('hint style attr', hint?.getAttribute('style'), 'class', hint?.className);
  console.log('rect', JSON.stringify(hint?.getBoundingClientRect()), hint?.clientWidth, hint?.clientHeight);
  const lines = r.fabric.render({ props: true }).split('\n');
  console.log(lines.filter((l) => /opacity|Hint text/.test(l)).map((l) => l.slice(0, 600)).join('\n'));
});
