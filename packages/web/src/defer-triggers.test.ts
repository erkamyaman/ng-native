import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ErrorHandler } from '@angular/core';
import { makeAnchorNode, makeTextNode } from './dom-node.ts';
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
