import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ErrorHandler } from '@angular/core';
import { letBrowserNodesPassAsDomNodes, makeAnchorNode, makeTextNode } from './dom-node.ts';
import type { BrowserEngine as Engine } from './browser-engine.ts';
import { installJsdomEnvironment } from './jsdom-env.ts';
import type { MountResult } from './mount.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** A browser's `IntersectionObserver`: it watches real elements only, and refuses anything else. */
class BrowserIntersectionObserver {
  static readonly made: BrowserIntersectionObserver[] = [];
  readonly callback: (entries: unknown[], observer: unknown) => void;
  readonly targets = new Set<Element>();

  constructor(callback: (entries: unknown[], observer: unknown) => void) {
    this.callback = callback;
    BrowserIntersectionObserver.made.push(this);
  }

  observe(target: unknown): void {
    if (!/Element\]$/.test(Object.prototype.toString.call(target))) {
      throw new TypeError("Failed to execute 'observe': parameter 1 is not of type 'Element'.");
    }
    this.targets.add(target as Element);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  takeRecords(): unknown[] {
    return [];
  }

  /** What the browser does once `target` scrolls into view. */
  static show(target: Element): void {
    for (const observer of BrowserIntersectionObserver.made) {
      if (!observer.targets.has(target)) continue;
      observer.callback(
        [{ target, isIntersecting: true, intersectionRatio: 1, time: 0 }],
        observer,
      );
    }
  }
}

describe('@defer on a trigger element, on the web', () => {
  const scope = globalThis as { IntersectionObserver?: unknown };
  const original = scope.IntersectionObserver;
  const errors: unknown[] = [];
  let document: Document;
  let root: HTMLElement;
  let mounted: MountResult;

  before(async () => {
    ({ document } = installJsdomEnvironment());
    scope.IntersectionObserver = BrowserIntersectionObserver;
    const [{ mount }, { DeferTriggersApp }] = await Promise.all([
      import('./mount.ts'),
      import('./defer-triggers-app.ts'),
    ]);
    root = document.createElement('app-root');
    document.body.appendChild(root);
    mounted = mount(root, DeferTriggersApp, {
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
      ],
    });
    await settle();
  });

  after(() => {
    mounted.destroy();
    scope.IntersectionObserver = original;
  });

  const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';

  it('registers every trigger without an error', () => {
    assert.deepEqual(errors.map(String), []);
    assert.match(text(), /interaction waiting/);
    assert.match(text(), /hover waiting/);
    assert.match(text(), /viewport waiting/);
  });

  it('answers instanceof Element for its own element nodes only', () => {
    assert.ok(mounted.componentRef.location.nativeElement instanceof Element);
    assert.ok(!(makeTextNode(document.createTextNode('')) instanceof Element));
    assert.ok(!(makeAnchorNode(document.createComment('')) instanceof Element));
    assert.ok(document.createElement('div') instanceof Element);
    assert.ok(!({} instanceof Element));
  });

  it('loads on interaction when the trigger is clicked', async () => {
    document.getElementById('trigger')!.dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.match(text(), /interaction loaded/);
    assert.doesNotMatch(text(), /interaction waiting/);
  });

  it('loads on hover when the pointer enters the placeholder', async () => {
    document.getElementById('hover-target')!.dispatchEvent(new Event('mouseenter'));
    await settle();
    assert.match(text(), /hover loaded/);
  });

  it('loads on viewport once the placeholder is in view, and not before', async () => {
    assert.match(text(), /viewport waiting/);
    BrowserIntersectionObserver.show(document.getElementById('spot')!);
    await settle();
    assert.match(text(), /viewport loaded/);
    assert.deepEqual(errors.map(String), []);
  });
});

describe('a text-input that a trigger listens to or watches, when multiline swaps its element', () => {
  const scope = globalThis as { IntersectionObserver?: unknown };
  const original = scope.IntersectionObserver;
  let document: Document;
  let BrowserEngine: typeof Engine;

  before(async () => {
    ({ document } = installJsdomEnvironment());
    scope.IntersectionObserver = BrowserIntersectionObserver;
    letBrowserNodesPassAsDomNodes();
    ({ BrowserEngine } = await import('./browser-engine.ts'));
  });

  after(() => {
    scope.IntersectionObserver = original;
  });

  function field() {
    const engine = new BrowserEngine(document);
    const node = engine.createElementNode('text-input');
    document.body.append(node.el);
    const multiline = (on: boolean) => engine.setProp(node, 'multiline', on);
    return { node, multiline };
  }

  const click = (el: Element | Text | Comment) =>
    el.dispatchEvent(new (document.defaultView as unknown as typeof globalThis).Event('click'));

  it('moves a listener added through the node to the new element, and off the old one', () => {
    const { node, multiline } = field();
    const old = node.el as Element;
    const clicks: unknown[] = [];
    const listener = () => clicks.push(1);
    (node as unknown as Element).addEventListener('click', listener);
    multiline(true);
    assert.notEqual(node.el, old);
    click(node.el);
    assert.equal(clicks.length, 1, 'fires for the textarea');
    click(old);
    assert.equal(clicks.length, 1, 'no longer fires for the input it replaced');

    (node as unknown as Element).removeEventListener('click', listener);
    click(node.el);
    assert.equal(clicks.length, 1, 'removed through the node after the swap');
    multiline(false);
    click(node.el);
    assert.equal(clicks.length, 1, 'and not put back by a later swap');
    (node.el as Element).remove();
  });

  it('does not bring back a once listener that fired or one whose signal aborted', () => {
    const { node, multiline } = field();
    const wrapper = node as unknown as Element;
    const calls: string[] = [];
    const controller = new (document.defaultView as unknown as typeof globalThis).AbortController();
    wrapper.addEventListener('click', () => calls.push('fired once'), { once: true });
    wrapper.addEventListener('click', () => calls.push('aborted'), { signal: controller.signal });
    click(node.el);
    controller.abort();
    calls.length = 0;
    wrapper.addEventListener('click', () => calls.push('after'), { once: true });
    multiline(true);
    click(node.el);
    click(node.el);
    assert.deepEqual(calls, ['after']);
    (node.el as Element).remove();
  });

  it('moves an observation made through the node to the new element, and off the old one', () => {
    const { node, multiline } = field();
    const old = node.el as Element;
    const seen: unknown[] = [];
    const Observer = scope.IntersectionObserver as typeof IntersectionObserver;
    const observer = new Observer((entries) => seen.push(...entries.map((e) => e.target)));
    observer.observe(node as unknown as Element);
    multiline(true);
    const stub = BrowserIntersectionObserver.made.at(-1)!;
    assert.ok(stub.targets.has(node.el as Element), 'watches the textarea');
    assert.ok(!stub.targets.has(old), 'no longer holds the input it replaced');
    BrowserIntersectionObserver.show(node.el as Element);
    assert.deepEqual(seen, [node], 'its entry names the node');

    observer.unobserve(node as unknown as Element);
    multiline(false);
    assert.equal(stub.targets.size, 0, 'unobserved through the node, and not put back by a swap');
    observer.disconnect();
    (node.el as Element).remove();
  });
});
