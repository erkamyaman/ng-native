import '@angular/localize/init';
import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import type { ComponentRef, WritableSignal } from '@angular/core';
import { installJsdomEnvironment } from './jsdom-env.ts';

interface Counted {
  count: WritableSignal<number>;
  shown: WritableSignal<boolean>;
}

describe('an ICU plural, on the web, in a development build', () => {
  let document: Document;
  let mountWith: (template: string) => { root: HTMLElement; ref: ComponentRef<Counted> };
  const mounted: ComponentRef<Counted>[] = [];
  let created = 0;

  before(async () => {
    ({ document } = installJsdomEnvironment());
    await import('@angular/compiler');
    const { Component, signal } = await import('@angular/core');
    const { Text } = await import('@ng-native/components');
    const { mount } = await import('./mount.ts');
    mountWith = (template) => {
      const selector = `app-plural-${mounted.length + created++}`;
      const App = Component({ selector, imports: [Text], template })(
        class {
          readonly count = signal(1);
          readonly shown = signal(true);
        },
      );
      const root = document.createElement('app-root');
      document.body.appendChild(root);
      const { componentRef } = mount(root, App);
      const ref = componentRef as ComponentRef<Counted>;
      mounted.push(ref);
      return { root, ref };
    };
  });

  afterEach(() => {
    for (const ref of mounted.splice(0)) ref.destroy();
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const text = (root: HTMLElement) => root.textContent?.replace(/\s+/g, ' ').trim();

  it('renders the case for the count, and switches case both ways', async () => {
    const { root, ref } = mountWith(`
      <text i18n="@@found">{count(), plural,
        one {{{ count() }} result}
        other {{{ count() }} results}
      }</text>
    `);
    assert.equal(text(root), '1 result');
    ref.instance.count.set(3);
    await settle();
    assert.equal(text(root), '3 results');
    ref.instance.count.set(1);
    await settle();
    assert.equal(text(root), '1 result');
  });

  it('renders a plural next to an element in the same message', async () => {
    const { root, ref } = mountWith(`
      <text i18n>Found <text>{{ count() }}</text> {count(), plural, one {match} other {matches}}</text>
    `);
    assert.equal(text(root), 'Found 1 match');
    ref.instance.count.set(2);
    await settle();
    assert.equal(text(root), 'Found 2 matches');
  });

  it('takes a plural down with the view it is in', async () => {
    const { root, ref } = mountWith(`
      <text>
        @if (shown()) {
          <ng-container i18n>{count(), plural, one {one left} other {{{ count() }} left}}</ng-container>
        }
      </text>
    `);
    assert.equal(text(root), 'one left');
    ref.instance.shown.set(false);
    await settle();
    assert.equal(text(root), '');
    ref.instance.shown.set(true);
    await settle();
    assert.equal(text(root), 'one left');
  });

  it('answers instanceof Node for its own nodes only, and leaves Element alone', () => {
    const { ref } = mountWith(`<text>Plain</text>`);
    const wrapper = ref.location.nativeElement as object;
    assert.ok(wrapper instanceof Node);
    assert.ok(!(wrapper instanceof Element));
    assert.ok(document.createComment('') instanceof Node);
    assert.ok(!(document.createTextNode('') instanceof Element));
    assert.ok(!({} instanceof Node));
  });
});

describe('an ICU plural, on the web, in a release build', () => {
  const scope = globalThis as { ngDevMode?: unknown };

  it('renders without changing what instanceof Node answers', async () => {
    const before = scope.ngDevMode;
    const { document } = installJsdomEnvironment();
    scope.ngDevMode = false;
    try {
      await import('@angular/compiler');
      const { Component, signal } = await import('@angular/core');
      const { Text } = await import('@ng-native/components');
      const { mount } = await import('./mount.ts');
      const App = Component({
        selector: 'app-plural-release',
        imports: [Text],
        template: `<text i18n>{count(), plural, one {one} other {many}}</text>`,
      })(
        class {
          readonly count = signal(2);
        },
      );
      const root = document.createElement('app-root');
      document.body.appendChild(root);
      const { componentRef } = mount(root, App);
      try {
        assert.equal(root.textContent?.trim(), 'many');
        assert.ok(!((componentRef.location.nativeElement as object) instanceof Node));
      } finally {
        componentRef.destroy();
      }
    } finally {
      scope.ngDevMode = before;
    }
  });
});
