/**
 * `mask-image` and the properties that place it, in a library's stylesheet the build is told was
 * written for a browser. A view has no mask, so the compiler keeps a mask of one `url()` for the
 * engine (`maskImage`, `maskSize`, `maskPosition` and `maskRepeat`), which hands it to what draws
 * it (`Engine.drawMasks`): an icon library's `::before { background: currentColor; mask-image:
 * url(icon.svg) }` is the icon drawn in that colour. What no single-image mask can say is dropped,
 * and said.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, type EngineNode } from '@ng-native/fabric';
import { createFakeFabric, type FakeFabricNode } from '@ng-native/testing';

const require = createRequire(import.meta.url);
const { compileCss } = require('@ng-native/metro/css/compile.cjs') as {
  compileCss(
    css: string,
    context: string,
    options?: { generated?: boolean; onUnsupported?: (message: string) => void },
  ): { rules: { declarations: Record<string, unknown>; deferred?: unknown[] }[] };
};

/** A library's sheet, with what was dropped of it. */
function library(css: string) {
  const dropped: string[] = [];
  const sheet = compileCss(css, 'library.css', {
    generated: true,
    onUnsupported: (message) => dropped.push(message),
  });
  return { sheet, rules: sheet.rules, dropped };
}

describe('a mask, compiled', () => {
  it('is one url() image, kept for the engine as the CSS it is', () => {
    const { rules, dropped } = library(
      '.a { mask-image: url(icons/check.svg) } .b { -webkit-mask-image: none }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations, { maskImage: 'url("icons/check.svg")' });
    assert.deepEqual(rules[1]!.declarations, { maskImage: 'none' });
  });

  it('is placed, sized and repeated as a background is', () => {
    const { rules, dropped } = library(
      '.a { mask-size: 10px 20%; mask-position: center; mask-repeat: no-repeat }' +
        '.b { mask-size: contain; -webkit-mask-position: right 2px bottom; mask-repeat: repeat-x }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations, {
      maskSize: { x: 10, y: '20%' },
      maskPosition: { left: '50%', top: '50%' },
      maskRepeat: { x: 'no-repeat', y: 'no-repeat' },
    });
    assert.deepEqual(rules[1]!.declarations, {
      maskSize: 'contain',
      maskPosition: { right: 2, bottom: 0 },
      maskRepeat: { x: 'repeat', y: 'no-repeat' },
    });
  });

  it('takes the first of a list of sizes and places, which is the one its one image is drawn by', () => {
    const { rules, dropped } = library(
      '.a { mask-size: 10px 10px, 100%; mask-position: 0 0, center }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations['maskPosition'], { left: 0, top: 0 });
    assert.deepEqual(rules[0]!.declarations['maskSize'], { x: 10, y: 10 });
  });

  it('keeps a size with a token in it as the CSS it is, for the size of the box to settle', () => {
    const { rules, dropped } = library(
      '.a { mask-size: calc(min(1em, 100%) + 10 * var(--stroke)) min(1em, 100%), 100% }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations, {
      maskSize: { css: 'calc(min(1em, 100%) + 10 * var(--stroke)) min(1em, 100%)' },
    });
  });

  it('reads the shorthand of one layer, with what it leaves out at its initial value', () => {
    const { rules, dropped } = library(
      '.a { mask: url(b.svg) center / contain no-repeat } .b { mask: url(c.svg) }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations, {
      maskImage: 'url("b.svg")',
      maskPosition: { left: '50%', top: '50%' },
      maskSize: 'contain',
      maskRepeat: { x: 'no-repeat', y: 'no-repeat' },
    });
    assert.deepEqual(rules[1]!.declarations, {
      maskImage: 'url("c.svg")',
      maskPosition: { left: '0%', top: '0%' },
      maskSize: { x: 'auto', y: 'auto' },
      maskRepeat: { x: 'repeat', y: 'repeat' },
    });
  });

  it('is a token where the image is one, settled on the element', () => {
    const { rules, dropped } = library(
      '.a { -webkit-mask-image: var(--icon); mask-image: var(--icon) }',
    );
    assert.deepEqual(dropped, []);
    assert.deepEqual(rules[0]!.declarations, {});
    assert.deepEqual(rules[0]!.deferred, [
      { props: ['maskImage'], kind: 'keyword', reference: '--icon' },
    ]);
  });

  it('drops a mask of more than one layer, or of a gradient, and says so', () => {
    const { rules, dropped } = library(
      '.a { mask-image: var(--icon), radial-gradient(circle, transparent 1px, #000 2px) }' +
        '.b { mask-image: url(a.svg), url(b.svg) } .c { mask-image: linear-gradient(red, blue) }',
    );
    assert.equal(dropped.length, 3);
    for (const message of dropped) assert.match(message, /dropped 'mask-image'.*one url\(\)/);
    assert.ok(rules.every((rule) => !('maskImage' in rule.declarations)));
  });

  it('drops how layers are joined and clipped, which a mask of one image drawn whole has no use for', () => {
    const { dropped } = library(
      '.a { mask-composite: intersect; mask-clip: padding-box; mask-origin: content-box; mask-mode: luminance }',
    );
    assert.equal(dropped.length, 4);
    for (const message of dropped) assert.match(message, /a mask is drawn as one image/);
  });

  it("is still refused in an app's own sheet, which has no box to draw it in", () => {
    const dropped: string[] = [];
    compileCss('.a { mask-image: url(a.svg) }', 'app.css', {
      onUnsupported: (message) => dropped.push(message),
    });
    assert.equal(dropped.length, 1);
  });
});

/** A tree of views styled by a library's sheet, with the masks the engine hands over. */
function scene(css: string) {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: library(css).sheet as never });
  const masks: [string, unknown][] = [];
  const stop = engine.drawMasks((node, mask) => {
    masks.push([String(node.props['nativeID'] ?? node.tag), mask]);
  });
  const element = (classes: string, parent: EngineNode = engine.root): EngineNode => {
    const node = engine.createElement('view');
    engine.setClasses(node, classes);
    engine.setProp(node, 'nativeID', classes);
    engine.appendChild(parent, node);
    return node;
  };
  const find = (id: string, all: readonly FakeFabricNode[]): FakeFabricNode | undefined => {
    for (const each of all) {
      const found = each.props['nativeID'] === id ? each : find(id, each.children);
      if (found) return found;
    }
    return undefined;
  };
  const committed = (id: string) => {
    engine.commit();
    return find(id, fabric.committed)!.props;
  };
  return { engine, element, masks, committed, stop };
}

const ICON =
  '.icon { width: 24px; height: 24px; background: red; mask-image: url(check.svg);' +
  ' mask-repeat: no-repeat; mask-position: center; mask-size: 20px }';

describe('a box with a mask', () => {
  it('hands its mask and its background colour to what draws it, and sends native neither', () => {
    const s = scene(ICON);
    s.element('icon');
    const props = s.committed('icon');
    for (const key of ['maskImage', 'maskSize', 'maskPosition', 'maskRepeat', 'backgroundColor']) {
      assert.equal(props[key], undefined, key);
    }
    assert.equal(props['width'], 24);
    assert.deepEqual(s.masks, [
      [
        'icon',
        {
          image: 'url("check.svg")',
          size: { x: 20, y: 'auto' },
          position: { left: '50%', top: '50%' },
          repeat: { x: 'no-repeat', y: 'no-repeat' },
          color: 'rgb(255, 0, 0)',
        },
      ],
    ]);
  });

  it('is told again only when its mask or its colour changes, and told none when it goes', () => {
    const s = scene(`${ICON} .blue { background: blue } .bare { mask-image: none }`);
    const node = s.element('icon');
    s.committed('icon');
    s.engine.setClasses(node, 'icon');
    s.committed('icon');
    assert.equal(s.masks.length, 1, 'nothing changed');
    s.engine.setClasses(node, 'icon blue');
    s.committed('icon');
    assert.equal((s.masks[1]![1] as { color: unknown }).color, 'rgb(0, 0, 255)');
    s.engine.setClasses(node, 'icon blue bare');
    const props = s.committed('icon');
    assert.deepEqual(s.masks[2], ['icon', null]);
    // With no mask, the box paints its own background again.
    assert.equal(props['backgroundColor'], 'rgb(0, 0, 255)');
  });

  it('takes its image from a token set on the element, as an icon directive binds one', () => {
    const s = scene(
      '.icon { --icon: none; background: green; mask-image: var(--icon); width: 1px; height: 1px }',
    );
    const node = s.element('icon');
    s.committed('icon');
    assert.deepEqual(s.masks, [], 'none is no mask');
    s.engine.setCustomProperty(node, '--icon', 'url(data:image/svg+xml,%3Csvg%3E%3C/svg%3E)');
    const props = s.committed('icon');
    assert.equal(props['backgroundColor'] ?? undefined, undefined);
    assert.equal(
      (s.masks[0]![1] as { image: unknown }).image,
      'url(data:image/svg+xml,%3Csvg%3E%3C/svg%3E)',
    );
  });

  it('is drawn on a generated box, as an icon library draws its icons', () => {
    const s = scene(
      '.i::before { content: ""; width: 4px; height: 4px; background: red; mask-image: url(a.svg) }',
    );
    s.element('i');
    s.committed('i');
    assert.deepEqual(
      s.masks.map(([on]) => on),
      ['::before'],
    );
  });

  it('paints its background where nothing draws masks, as it did before any did', () => {
    const s = scene(ICON);
    s.stop();
    s.element('icon');
    const props = s.committed('icon');
    assert.equal(props['backgroundColor'], 'rgb(255, 0, 0)');
    assert.equal(props['maskImage'], undefined);
    assert.deepEqual(s.masks, []);
  });
});
