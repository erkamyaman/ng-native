import {
  inject,
  Injector,
  makeEnvironmentProviders,
  NgZone,
  provideEnvironmentInitializer,
  DestroyRef,
} from '@angular/core';
import { EVENT_MANAGER_PLUGINS } from '@angular/platform-browser';
import { Engine } from '@ng-native/fabric';
import { extendRenderer } from '@ng-native/platform';

/**
 * Spike: Angular Native's renderer `listen` never goes through Angular's `EventManager`, so the
 * `EVENT_MANAGER_PLUGINS` an app provides (Taiga's `.stop`, `.prevent`, `.self`, `.zoneless`,
 * `document:click.capture`, `longtap`...) are never asked. This routes a listen whose name a
 * provided plugin supports through it, with a small manager standing in for `EventManager`.
 *
 * In the package this belongs in `@ng-native/web-compat`'s `webListen.listen` (or the platform
 * renderer), with the plugins read from the app's injector.
 */
interface Plugin {
  manager: unknown;
  supports(name: string): boolean;
  addEventListener(el: unknown, name: string, handler: Function, options?: unknown): () => void;
}
type Listenable = {
  addEventListener(n: string, h: Function, o?: unknown): void;
  removeEventListener(n: string, h: Function, o?: unknown): void;
};

const byEngine = new Map<unknown, { plugins: Plugin[]; manager: object }>();

const globalTarget = (name: string): Listenable | undefined => {
  const w = globalThis as unknown as Listenable & { document: Listenable & { body: Listenable } };
  return name === 'window' ? w : name === 'document' ? w.document : name === 'body' ? w.document.body : undefined;
};

let registered = false;
function register(): void {
  if (registered) return;
  registered = true;
  extendRenderer({
    listen(target, eventName, callback, engine, options) {
      const entry = byEngine.get(engine);
      if (!entry || !entry.plugins.some((p) => p.supports(eventName))) return undefined;
      const el = typeof target === 'string' ? globalTarget(target) : target;
      if (!el) return undefined;
      return (entry.manager as { addEventListener: Function }).addEventListener(
        el,
        eventName,
        callback,
        options,
      );
    },
  });
}

export function provideEventPluginsBridge() {
  register();
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const injector = inject(Injector);
      const engine = inject(Engine);
      const zone = inject(NgZone);
      const plugins = (injector.get(EVENT_MANAGER_PLUGINS, [] as never) as unknown as Plugin[]).slice().reverse();
      const manager = {
        getZone: () => zone,
        addEventListener(el: Listenable, name: string, handler: Function, options?: unknown) {
          const plugin = plugins.find((p) => p.supports(name));
          if (plugin) return plugin.addEventListener(el, name, handler, options);
          el.addEventListener(name, handler, options);
          return () => el.removeEventListener(name, handler, options);
        },
      };
      for (const p of plugins) p.manager = manager;
      byEngine.set(engine, { plugins, manager });
      inject(DestroyRef).onDestroy(() => byEngine.delete(engine));
    }),
  ]);
}
