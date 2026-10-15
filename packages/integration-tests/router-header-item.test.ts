/**
 * `<native-header-item>`: anything Angular renders, in a slot of the navigation bar, committed as
 * react-native-screens' `RNSScreenStackHeaderSubview`.
 */
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import type { Type, WritableSignal } from '@angular/core';
import { cleanup, render, type FakeFabric } from '@ng-native/testing';
import type { HeaderItemType } from '../router/src/native-header-item.ts';
import { registerScreenComponents } from '../router/src/screens.ts';
import { compileFixture } from './compile.ts';

describe('native header item', () => {
  let Host: Type<unknown>;
  let InComponent: Type<unknown>;

  before(async () => {
    registerScreenComponents();
    const mod = await compileFixture('fixtures/header-item.ts');
    Host = mod['HeaderItemHost'] as Type<unknown>;
    InComponent = mod['HeaderItemInComponent'] as Type<unknown>;
  });

  afterEach(() => cleanup());

  // Android's header knows left, center, right, back and searchBar, and throws on anything else.
  it('commits a title item as center, the spelling both platforms take', async () => {
    const { fabric } = await render(Host);
    const item = fabric.find('RNSScreenStackHeaderSubview');
    assert.ok(item);
    assert.equal(item.props['type'], 'center');
  });

  it('commits every other slot as it is written', async () => {
    const { fabric, instance, detectChanges } = await render(Host);
    const type = (instance as { type: WritableSignal<HeaderItemType | undefined> }).type;
    for (const slot of ['left', 'center', 'right', 'back', 'searchBar'] as const) {
      type.set(slot);
      await detectChanges();
      assert.equal(fabric.find('RNSScreenStackHeaderSubview')!.props['type'], slot);
    }
  });

  // RNSScreenStackHeaderConfig takes only RNSScreenStackHeaderSubview children: iOS logs an error
  // and drops anything else, and Android throws "Config children should be of type
  // RNSScreenStackHeaderSubview". A component's host is a plain view, so it must not reach it.
  describe('inside a component of the header', () => {
    const slots = (fabric: FakeFabric) =>
      fabric
        .find('RNSScreenStackHeaderConfig')!
        .children.map((child) => `${child.viewName}:${child.props['type']}`);
    const left = 'RNSScreenStackHeaderSubview:left';
    const right = 'RNSScreenStackHeaderSubview:right';
    const center = 'RNSScreenStackHeaderSubview:center';

    it('commits the item as a child of the header config, in the order it was written', async () => {
      const { fabric } = await render(InComponent);
      assert.deepEqual(slots(fabric), [left, right, center]);
    });

    it('takes the item away and brings it back where it was', async () => {
      const { fabric, instance, detectChanges } = await render(InComponent);
      const shown = (instance as { shown: WritableSignal<boolean> }).shown;
      shown.set(false);
      await detectChanges();
      assert.deepEqual(slots(fabric), [left, center]);
      shown.set(true);
      await detectChanges();
      assert.deepEqual(slots(fabric), [left, right, center]);
    });

    it('commits a change inside the item', async () => {
      const { instance, detectChanges, queryByText } = await render(InComponent);
      const label = (instance as { label: WritableSignal<string> }).label;
      for (const text of ['Send', 'Print']) {
        label.set(text);
        await detectChanges();
        assert.ok(queryByText(text), text);
      }
    });
  });
});
