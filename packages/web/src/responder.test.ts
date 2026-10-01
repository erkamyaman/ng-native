/**
 * The responder negotiation (`responder.ts`), against a real nested tree: a pressable inside a
 * scroll view inside another pressable, mounted through `mount` and driven with real
 * `PointerEvent`s and a real `scroll` event - the scenario the task calls the hard part, and the
 * one `examples/web-button`'s prototype explicitly did not attempt (see its `browser-engine.ts`
 * doc comment: "there is exactly one control on this page").
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NestedPressApp } from './responder-app.ts';
import { installJsdomEnvironment } from './jsdom-env.ts';

async function bootstrapNested() {
  const { document } = installJsdomEnvironment();
  const [{ mount }, { NestedPressApp }] = await Promise.all([
    import('./mount.ts'),
    import('./responder-app.ts'),
  ]);
  const root = document.createElement('app-root');
  document.body.appendChild(root);
  const { componentRef, applicationRef } = mount(root, NestedPressApp);
  return {
    document,
    componentRef,
    applicationRef,
    app: componentRef.instance as NestedPressApp,
  };
}

const down = (pointerId: number) =>
  new (globalThis as any).PointerEvent('pointerdown', { pointerId, bubbles: true });
const up = (pointerId: number) =>
  new (globalThis as any).PointerEvent('pointerup', { pointerId, bubbles: true });

describe('responder negotiation, over a real nested tree', () => {
  it('elects only the innermost pressable, not the one wrapping the whole page', async () => {
    const { document, componentRef, applicationRef: appRef, app } = await bootstrapNested();
    const innerText = [...document.querySelectorAll('text')].find(
      (t) => t.textContent === 'inner',
    )!;

    innerText.dispatchEvent(down(1));
    innerText.dispatchEvent(up(1));
    appRef.tick();

    assert.deepEqual(
      app.log(),
      ['inner'],
      'raw propagation would have fired both pressables; the negotiation elects exactly one',
    );

    componentRef.destroy();
  });

  it('lets a scroll view take the gesture over a press started inside it', async () => {
    const { document, componentRef, applicationRef: appRef, app } = await bootstrapNested();
    const innerText = [...document.querySelectorAll('text')].find(
      (t) => t.textContent === 'inner',
    )!;
    const scrollView = document.querySelector('scroll-view')!;

    innerText.dispatchEvent(down(2));
    // The scroll view moved under the finger - `notifyScroll` (`browser-engine.ts`'s `wireScroll`
    // listener) should terminate the inner pressable's grant before the finger lifts.
    scrollView.dispatchEvent(new (globalThis as any).Event('scroll', { bubbles: false }));
    innerText.dispatchEvent(up(2));
    appRef.tick();

    assert.deepEqual(
      app.log(),
      [],
      'the press was cancelled; (press) never fires for either pressable',
    );

    componentRef.destroy();
  });

  it('still presses normally when nothing scrolls', async () => {
    const { document, componentRef, applicationRef: appRef, app } = await bootstrapNested();
    const outerText = [...document.querySelectorAll('text')].find(
      (t) => t.textContent === 'outer',
    )!;

    outerText.dispatchEvent(down(3));
    outerText.dispatchEvent(up(3));
    appRef.tick();

    assert.deepEqual(app.log(), ['outer']);

    componentRef.destroy();
  });

  it('presses a second pressable the first time it is pressed, after another one was', async () => {
    const { document, componentRef, applicationRef: appRef, app } = await bootstrapNested();
    const text = (label: string) =>
      [...document.querySelectorAll('text')].find((t) => t.textContent === label)!;

    const pressable = (label: string) => text(label).closest('pressable')!;
    const focus = (type: 'focusin' | 'focusout', label: string) =>
      pressable(label).dispatchEvent(new (globalThis as any).Event(type, { bubbles: true }));

    text('outer').dispatchEvent(down(4));
    focus('focusin', 'outer');
    text('outer').dispatchEvent(up(4));
    text('inner').dispatchEvent(down(5));
    focus('focusout', 'outer');
    focus('focusin', 'inner');
    text('inner').dispatchEvent(up(5));
    appRef.tick();

    assert.deepEqual(app.log(), ['outer', 'inner']);

    componentRef.destroy();
  });
});
