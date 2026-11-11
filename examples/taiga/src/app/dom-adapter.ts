import { ɵgetDOM as getDOM, ɵsetRootDomAdapter as setRootDomAdapter } from '@angular/common';

/**
 * Spike: Angular's `DomAdapter` (`getDOM()`), which `Meta` and `Title` reach for, backed by
 * the global document web-compat installs. Without one, `getDOM()` is null.
 */
type Doc = {
  createElement(name: string): unknown;
  implementation: { createHTMLDocument(title: string): unknown };
  querySelector(s: string): { getAttribute(n: string): string | null } | null;
  defaultView: unknown;
  body: unknown;
};
const doc = () => (globalThis as unknown as { document: Doc }).document;

export function installDomAdapter(): void {
  if (getDOM()) return;
  setRootDomAdapter({
    supportsDOMEvents: true,
    dispatchEvent: (el: { dispatchEvent(e: unknown): void }, evt: unknown) => el.dispatchEvent(evt),
    remove: (el: { remove(): void }) => el.remove(),
    createElement: (tag: string, d?: Doc) => (d ?? doc()).createElement(tag),
    createHtmlDocument: () => doc().implementation.createHTMLDocument('fakeTitle'),
    getDefaultDocument: () => doc(),
    isElementNode: (n: { nodeType: number }) => n.nodeType === 1,
    isShadowRoot: () => false,
    onAndCancel: (
      el: { addEventListener: Function; removeEventListener: Function },
      evt: string,
      listener: unknown,
      options?: unknown,
    ) => {
      el.addEventListener(evt, listener, options);
      return () => el.removeEventListener(evt, listener, options);
    },
    getGlobalEventTarget: (d: Doc, target: string) =>
      target === 'window' ? d.defaultView : target === 'document' ? d : target === 'body' ? d.body : null,
    getBaseHref: (d: Doc) => d.querySelector('base')?.getAttribute('href') ?? null,
    resetBaseElement: () => {},
    getUserAgent: () => (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '',
    getCookie: () => null,
  } as never);
}
