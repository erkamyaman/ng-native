/**
 * A boolean router input bound to `null` is unset, as one bound to `undefined` is, where
 * `booleanAttribute(null)` is false. The components' and expo views' are pinned in
 * null-unsets-inputs.test.ts.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type { Type, WritableSignal } from '@angular/core';
import { registerPlatformComponents } from '@ng-native/fabric';
import { cleanup, render } from '@ng-native/testing';
import { registerScreenComponents } from '../router/src/screens.ts';
import { compileFixture } from './compile.ts';

interface Host {
  readonly on: WritableSignal<boolean | null>;
}

const HEADER = 'RNSScreenStackHeaderConfig';

describe('boolean router inputs bound to null', () => {
  let Valued: Type<Host>;
  let Nulled: Type<Host>;

  before(async () => {
    registerScreenComponents();
    const mod = await compileFixture('fixtures/router-boolean-inputs.ts');
    Valued = mod['RouterBooleanInputs'] as Type<Host>;
    Nulled = mod['RouterBooleanInputsNull'] as Type<Host>;
  });

  afterEach(() => cleanup());
  after(() => {
    registerPlatformComponents('ios');
    registerScreenComponents();
  });

  for (const name of ['hideBackButton', 'disableBackButtonMenu']) {
    describe(name, () => {
      it('commits the value bound', async () => {
        const app = await render(Valued);
        assert.equal(app.fabric.find(HEADER)!.props[name], false);
      });

      it('sends nothing for null bound from the first pass', async () => {
        const app = await render(Nulled);
        assert.equal(app.fabric.find(HEADER)!.props[name], undefined);
      });

      it('removes the value when the binding turns null, and takes a value again', async () => {
        const app = await render(Valued);
        const host = app.instance as Host;
        host.on.set(null);
        await app.detectChanges();
        assert.equal(app.fabric.find(HEADER)!.props[name], null);
        host.on.set(true);
        await app.detectChanges();
        assert.equal(app.fabric.find(HEADER)!.props[name], true);
      });
    });
  }
});
