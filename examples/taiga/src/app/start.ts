import type { Type } from '@angular/core';
import { cleanup, compileCss, render, settle } from '@ng-native/testing';
import { provideBrowserPlatformId, provideWebCompat } from '@ng-native/web-compat';
import { provideTaiga } from '@taiga-ui/core';
import { installDomAdapter } from './dom-adapter.ts';
import { provideEventPluginsBridge } from './event-plugins-bridge.ts';

export const useAdapter = process.env['NO_ADAPTER'] !== '1';

/** Taiga's global theme (`@taiga-ui/styles/taiga-ui-theme.less`, compiled with lessc), as the global sheet. */
export const themeWarnings: string[] = [];
let theme: unknown;
function themeSheet() {
  if (theme || process.env['NO_THEME'] === '1') return theme;
  const { readFileSync } = process.getBuiltinModule('node:fs');
  const css = readFileSync(new URL('../theme/taiga-theme.css', import.meta.url), 'utf8');
  theme = compileCss(css, 'taiga-theme', {
    generated: true,
    onUnsupported: (m) => themeWarnings.push(m),
  });
  return theme;
}

export async function start<T>(component: Type<T>, extra: unknown[] = []) {
  if (useAdapter) installDomAdapter();
  const result = await render(component, {
    globalStyles: themeSheet() as never,
    providers: [
      ...(process.env['NO_BRIDGE'] === '1' ? [] : [provideEventPluginsBridge()]),
      provideWebCompat(),
      provideTaiga(process.env['NO_FONT_SCALING'] === '1' ? { fontScaling: false } : {}),
      ...(process.env['BROWSER_ID'] === '1' ? [provideBrowserPlatformId()] : []),
      ...(extra as never[]),
    ],
  });
  await settle();
  return result;
}

/** Spike: web-compat takes `window.removeEventListener` away before Taiga's root `fromEvent(window)` unsubscribes. */
export function safeCleanup() {
  try {
    cleanup();
  } catch (error) {
    const message = String((error as Error).message ?? error);
    if (!message.includes('target[methodName] is not a function')) throw error;
    console.warn('[spike] teardown UnsubscriptionError swallowed');
  }
}

export function tree(result: { fabric: { render(o?: { props?: boolean }): string } }, max = 3000) {
  const text = result.fabric.render();
  console.log(text.length > max ? text.slice(0, max) + '\n…' : text);
}
