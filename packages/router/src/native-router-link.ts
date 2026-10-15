/**
 * `routerLink` for native.
 *
 * Angular's `RouterLink` host-binds `href` and listens for a DOM click, neither of which exists
 * here. This binds to a `<pressable>`'s `press` output instead.
 *
 * Because Angular resolves outputs across every directive on an element, the host listener below
 * binds to `Pressable`'s `press` output without importing it, so the router package does not
 * depend on the components package.
 */
import { Directive, booleanAttribute, inject, input } from '@angular/core';
import { ActivatedRoute, type NavigationExtras } from '@angular/router';
import { NativeNavigation } from './native-navigation.ts';

@Directive({
  selector: '[nativeRouterLink]',
  host: { '(press)': 'navigate()' },
})
export class NativeRouterLink {
  /** A url string, or the command array `Router.navigate` takes. */
  readonly nativeRouterLink = input.required<string | readonly unknown[]>();
  readonly extras = input<NavigationExtras>();

  /** Replace the current screen rather than pushing a new one. */
  readonly replace = input(false, { transform: booleanAttribute });

  private readonly navigation = inject(NativeNavigation);
  private readonly route = inject(ActivatedRoute, { optional: true });

  protected navigate(): void {
    const target = this.nativeRouterLink();
    const first: unknown = Array.isArray(target) ? target[0] : target;
    // An absolute link leads to the same place from anywhere. Resolved against a route inside a
    // presented page, it would keep that page's outlet in the url, and the page on screen.
    const absolute = typeof first === 'string' && first.startsWith('/');
    const extras: NavigationExtras = {
      relativeTo: absolute ? null : this.route,
      replaceUrl: this.replace(),
      ...this.extras(),
    };
    // `replaceUrl` only swaps the history entry: without a replace the replaced screen stays
    // mounted underneath, and a swipe back lands on a page the history no longer has. So the link
    // replaces when the navigation has `replaceUrl`, `[extras]` included, not the `replace` input
    // alone. Everything else is a push, the same one `NativeNavigation.push()` makes: into a tab
    // nobody has opened, over the tab's first screen, and out of a presented page.
    const commands = Array.isArray(target) ? [...target] : target;
    void (extras.replaceUrl
      ? this.navigation.replace(commands, extras)
      : this.navigation.push(commands, extras));
  }
}
