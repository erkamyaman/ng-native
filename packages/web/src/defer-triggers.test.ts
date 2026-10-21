import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ErrorHandler } from '@angular/core';
import { makeAnchorNode, makeTextNode } from './dom-node.ts';
import { installJsdomEnvironment } from './jsdom-env.ts';
import type { MountResult } from './mount.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const isElement = (target: unknown): boolean =>
  /Element\]$/.test(Object.prototype.toString.call(target));

interface Entry {
  readonly target: unknown;
  readonly isIntersecting: boolean;
}

/** A browser's `IntersectionObserver`: it watches real elements only, and refuses anything else. */
class BrowserIntersectionObserver {
  static readonly made: BrowserIntersectionObserver[] = [];
  readonly callback: (entries: Entry[], observer: unknown) => void;
  readonly targets = new Set<Element>();
  private pending: Entry[] = [];

  constructor(callback: (entries: Entry[], observer: unknown) => void) {
    this.callback = callback;
    BrowserIntersectionObserver.made.push(this);
  }

  observe(target: unknown): void {
    if (!isElement(target)) {
      throw new TypeError("Failed to execute 'observe': parameter 1 is not of type 'Element'.");
    }
    this.targets.add(target as Element);
  }

  unobserve(target: unknown): void {
    if (!isElement(target)) {
      throw new TypeError("Failed to execute 'unobserve': parameter 1 is not of type 'Element'.");
    }
    this.targets.delete(target as Element);
  }

  disconnect(): void {
    this.targets.clear();
  }

  takeRecords(): Entry[] {
    const records = this.pending;
    this.pending = [];
    return records;
  }

  /** Whether any observer still watches `target`. */
  static watches(target: Element): boolean {
    return BrowserIntersectionObserver.made.some((observer) => observer.targets.has(target));
  }

  /** What the browser does once `target` scrolls into view. */
  static show(target: Element): void {
    for (const observer of BrowserIntersectionObserver.made) {
      if (!observer.targets.has(target)) continue;
      observer.callback([{ target, isIntersecting: true }], observer);
    }
  }

  /** An entry for `target` the browser has found but not yet delivered. */
  static queue(target: Element): void {
    for (const observer of BrowserIntersectionObserver.made) {
      if (observer.targets.has(target)) observer.pending.push({ target, isIntersecting: true });
    }
  }
}

/**
 * Listeners added with Angular's options for `@defer` triggers (`passive` and `capture`, which no
 * listener of this package uses), on each DOM element, so a test can see them come and go.
 */
const deferListeners = new Map<EventTarget, Set<string>>();
const isDeferOptions = (options: unknown): boolean =>
  typeof options === 'object' &&
  options !== null &&
  (options as AddEventListenerOptions).passive === true &&
  (options as AddEventListenerOptions).capture === true;

describe('@defer on a trigger element, on the web', () => {
  const scope = globalThis as { IntersectionObserver?: unknown };
  const original = scope.IntersectionObserver;
  const errors: unknown[] = [];
  let document: Document;
  let root: HTMLElement;
  let mounted: MountResult;
  let restoreListeners = () => {};

  before(async () => {
    ({ document } = installJsdomEnvironment());
    const target = document.defaultView!.EventTarget.prototype;
    const { addEventListener: add, removeEventListener: remove } = target;
    target.addEventListener = function (this: EventTarget, type, listener, options) {
      if (isDeferOptions(options)) {
        const types = deferListeners.get(this) ?? new Set();
        deferListeners.set(this, types.add(type));
      }
      add.call(this, type, listener, options);
    };
    target.removeEventListener = function (this: EventTarget, type, listener, options) {
      if (isDeferOptions(options)) deferListeners.get(this)?.delete(type);
      remove.call(this, type, listener, options);
    };
    restoreListeners = () => {
      target.addEventListener = add;
      target.removeEventListener = remove;
    };
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
    try {
      mounted.destroy();
    } finally {
      scope.IntersectionObserver = original;
      restoreListeners();
    }
  });

  const text = () => root.textContent?.replace(/\s+/g, ' ') ?? '';
  const byId = (id: string) => document.getElementById(id)!;
  const listenersOn = (el: Element) => [...(deferListeners.get(el) ?? [])].sort();

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

  it('loads on interaction when the trigger is clicked, and stops listening', async () => {
    const trigger = byId('trigger');
    assert.deepEqual(listenersOn(trigger), ['click', 'keydown']);
    trigger.dispatchEvent(new Event('click', { bubbles: true }));
    await settle();
    assert.match(text(), /interaction loaded/);
    assert.doesNotMatch(text(), /interaction waiting/);
    assert.deepEqual(listenersOn(trigger), []);
  });

  it('loads on hover when the pointer enters the placeholder', async () => {
    const target = byId('hover-target');
    assert.deepEqual(listenersOn(target), ['focusin', 'mouseenter', 'mouseover']);
    target.dispatchEvent(new Event('mouseenter'));
    await settle();
    assert.match(text(), /hover loaded/);
    assert.deepEqual(listenersOn(target), []);
  });

  it('loads on viewport once the placeholder is in view, and not before', async () => {
    const spot = byId('spot');
    assert.match(text(), /viewport waiting/);
    assert.ok(BrowserIntersectionObserver.watches(spot));
    BrowserIntersectionObserver.show(spot);
    await settle();
    assert.match(text(), /viewport loaded/);
    assert.ok(!BrowserIntersectionObserver.watches(spot));
    assert.deepEqual(errors.map(String), []);
  });

  it('names the node it was given in an entry, and a real element as itself', () => {
    const node = mounted.componentRef.location.nativeElement as { el: Element };
    const el = document.createElement('div');
    const delivered: unknown[] = [];
    const Observer = scope.IntersectionObserver as new (
      callback: (entries: Entry[]) => void,
    ) => BrowserIntersectionObserver;
    const observer = new Observer((entries) => delivered.push(...entries.map((e) => e.target)));
    observer.observe(node);
    observer.observe(el);
    BrowserIntersectionObserver.queue(node.el);
    BrowserIntersectionObserver.queue(el);
    assert.deepEqual(
      observer.takeRecords().map((entry) => entry.target),
      [node, el],
    );
    BrowserIntersectionObserver.show(node.el);
    BrowserIntersectionObserver.show(el);
    assert.deepEqual(delivered, [node, el]);
    observer.unobserve(node);
    assert.ok(!BrowserIntersectionObserver.watches(node.el));
    observer.disconnect();

    // Given the node's element rather than the node, an observer reports the element.
    const direct = new Observer(() => {});
    direct.observe(node.el);
    BrowserIntersectionObserver.queue(node.el);
    assert.deepEqual(
      direct.takeRecords().map((entry) => entry.target),
      [node.el],
    );
    direct.disconnect();
  });
});
