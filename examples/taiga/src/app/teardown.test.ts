import { Component } from '@angular/core';
import { cleanup, render, settle } from '@ng-native/testing';
import { provideWebCompat } from '@ng-native/web-compat';
import { test } from 'vitest';

@Component({ selector: 'app-p', template: `<view></view>` })
class P {}

test('which targets lose removeEventListener on teardown', async () => {
  await render(P, { providers: [provideWebCompat()] });
  await settle();
  const w = globalThis as any;
  const targets: Record<string, any> = {
    window: w,
    document: w.document,
    body: w.document.body,
    mql: w.matchMedia('(prefers-color-scheme: dark)'),
    orientation: w.screen?.orientation,
    visualViewport: w.visualViewport,
  };
  const kinds = () =>
    Object.fromEntries(Object.entries(targets).map(([k, t]) => [k, typeof t?.removeEventListener]));
  const before = kinds();
  cleanup();
  console.log(JSON.stringify({ before, after: kinds() }));
});
