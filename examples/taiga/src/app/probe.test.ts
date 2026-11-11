import { Component } from '@angular/core';
import { cleanup, render, settle } from '@ng-native/testing';
import { provideWebCompat } from '@ng-native/web-compat';
import { afterEach, expect, test } from 'vitest';

afterEach(() => cleanup());

@Component({ selector: 'app-p', template: `<view></view>` })
class P {}

test('probe document', async () => {
  await render(P, { providers: [provideWebCompat()] });
  await settle();
  const d = (globalThis as any).document;
  const w = globalThis as any;
  console.log('head', !!d.head, d.head?.tagName, d.head?.nodeName);
  console.log('byTag html/body', d.getElementsByTagName('html').length, d.getElementsByTagName('body').length, d.getElementsByTagName('*').length);
  console.log('byTag head', d.getElementsByTagName('head').length, d.querySelector('head') ? 'qs-ok' : 'qs-null');
  console.log('documentElement', d.documentElement?.tagName, d.documentElement?.nodeName);
  console.log('defaultView', d.defaultView === w, typeof w.window);
  console.log('docEl.style.setProperty', typeof d.documentElement?.style?.setProperty);
  console.log('ResizeObserver', typeof w.ResizeObserver, 'IntersectionObserver', typeof w.IntersectionObserver, 'MutationObserver', typeof w.MutationObserver);
  console.log('getComputedStyle', typeof w.getComputedStyle, 'requestAnimationFrame', typeof w.requestAnimationFrame);
  console.log('matchMedia', typeof w.matchMedia, 'CSS.supports', typeof w.CSS?.supports);
  console.log('Element', typeof w.Element, 'HTMLElement', typeof w.HTMLElement, 'Node', typeof w.Node, 'SVGElement', typeof w.SVGElement);
  console.log('document.fonts', typeof d.fonts, 'animate', typeof d.body.animate);
  console.log('screen.orientation', typeof w.screen?.orientation, 'navigator', typeof w.navigator);
  console.log('Range', typeof w.Range, 'createRange', typeof d.createRange, 'caretPositionFromPoint', typeof d.caretPositionFromPoint);
  console.log('performance', typeof w.performance, 'history', typeof w.history, 'location', typeof w.location);
  console.log('cdk-style elementFromPoint', typeof d.elementFromPoint, 'activeElement', d.activeElement?.tagName);
  console.log('ownerDocument', typeof d.body.ownerDocument, 'isConnected', d.body.isConnected);
  console.log('innerWidth', w.innerWidth, 'devicePixelRatio', w.devicePixelRatio);
  console.log('getRootNode', typeof d.body.getRootNode);
  console.log('DocumentFragment', typeof w.DocumentFragment, 'Element.prototype', typeof w.Element?.prototype);
  console.log('CSSStyleSheet', typeof w.CSSStyleSheet, 'adoptedStyleSheets', Array.isArray(d.adoptedStyleSheets));
  expect(true).toBe(true);
});
