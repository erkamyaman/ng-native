/**
 * A template plural on the web picks its case by the rules of `LOCALE_ID`, as Angular's own
 * bootstrap makes it: zero is `one` in French and `other` in English.
 *
 * Development mode is off before Angular loads, because in it the web host's anchor fails
 * Angular's `assertDomNode` in `applyIcuSwitchCase` (the other half of #686).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { installJsdomEnvironment } from './jsdom-env.ts';

describe('a template plural, on the web', () => {
  const global = globalThis as { ngDevMode?: unknown };
  const hadDevMode = 'ngDevMode' in global;
  const originalDevMode = global.ngDevMode;
  let root: HTMLElement;
  let restoreLocale = () => {};

  before(async () => {
    global.ngDevMode = false;
    const { document } = installJsdomEnvironment();
    await import('@angular/localize/init');
    const [{ registerLocaleData }, { default: localeFr }, core, { mount }, { PluralApp }] =
      await Promise.all([
        import('@angular/common'),
        import('@angular/common/locales/fr'),
        import('@angular/core'),
        import('./mount.ts'),
        import('./plural-app.ts'),
      ]);
    registerLocaleData(localeFr);
    restoreLocale = () => core.ɵsetLocaleId(core.ɵDEFAULT_LOCALE_ID);
    root = document.createElement('app-root');
    document.body.appendChild(root);
    mount(root, PluralApp, { providers: [{ provide: core.LOCALE_ID, useValue: 'fr' }] });
  });

  after(() => {
    restoreLocale();
    if (hadDevMode) global.ngDevMode = originalDevMode;
    else delete global.ngDevMode;
  });

  it('picks the case by the rules of LOCALE_ID, not of en-US', () => {
    assert.equal(root.textContent?.trim(), '0 result');
  });
});
