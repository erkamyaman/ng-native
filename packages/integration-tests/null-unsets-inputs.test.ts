/**
 * A numeric or boolean input bound to `null` is unset, as one bound to `undefined` is, in the
 * components and expo packages. `numberAttribute(null)` is NaN and `booleanAttribute(null)` is
 * false, which would otherwise reach native in place of the platform's default. The router's are
 * pinned in router-number-inputs.test.ts and router-boolean-inputs.test.ts.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import type { Type, WritableSignal } from '@angular/core';
import { registerExpoViews } from '@ng-native/expo';
import { cleanup, render, type FakeFabricNode } from '@ng-native/testing';
import { compileFixture } from './compile.ts';

interface Host {
  readonly count: WritableSignal<number | null>;
  readonly on: WritableSignal<boolean | null>;
}

const all = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...all(node.children)]);

const inputs = [
  { name: 'numberOfLines', on: '<text>', value: 2, id: 'text' },
  { name: 'maxLength', on: '<text-input>', value: 2, id: 'input' },
  { name: 'spacing', on: '<expo-glass-container>', value: 2, id: 'container' },
  { name: 'collapsable', on: '<view>', value: false, id: 'view' },
  { name: 'isInteractive', on: '<expo-glass>', value: false, id: 'glass' },
] as const;

describe('an input bound to null', () => {
  let Valued: Type<Host>;
  let Nulled: Type<Host>;

  before(async () => {
    registerExpoViews('expo-glass', 'expo-glass-container');
    const mod = await compileFixture('fixtures/null-unsets-inputs.ts');
    Valued = mod['NullUnsetsInputs'] as Type<Host>;
    Nulled = mod['NullUnsetsInputsNull'] as Type<Host>;
  });

  afterEach(() => cleanup());

  async function props(fixture: Type<Host>, id: string) {
    const app = await render(fixture);
    const read = () =>
      all(app.fabric.committed).find((node) => node.props['nativeID'] === id)!.props;
    return { app, host: app.instance as Host, read };
  }

  for (const { name, on, value, id } of inputs) {
    describe(`[${name}] on ${on}`, () => {
      it('commits the value bound', async () => {
        const { read } = await props(Valued, id);
        assert.equal(read()[name], value);
      });

      it('sends nothing for null bound from the first pass', async () => {
        const { read } = await props(Nulled, id);
        assert.equal(read()[name], undefined);
      });

      it('removes the value when the binding turns null, and takes a value again', async () => {
        const { app, host, read } = await props(Valued, id);
        host.count.set(null);
        host.on.set(null);
        await app.detectChanges();
        assert.equal(read()[name], null, 'committed as a removal, not left as it was');
        host.count.set(3);
        host.on.set(true);
        await app.detectChanges();
        assert.equal(read()[name], typeof value === 'number' ? 3 : true);
      });
    });
  }
});
