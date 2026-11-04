/**
 * An item that grows, in a row as wide as its content: `align-self: flex-start` in a column. A
 * browser sizes the row by what its items hold, and a share of the room left over is a share of
 * none. React Native's Yoga gives the row all the room it could have where any item grows, so a
 * tray of tabs that share it evenly fills the screen. The engine fits such a row to its content,
 * with the items' growth set aside, and commits it at that width.
 *
 * Chrome lays every case here out at the width of the text, the same markup in a 362 pixel column.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import type { Type } from '@angular/core';
import { Engine, type EngineNode } from '@ng-native/fabric';
import { mount } from '@ng-native/platform';
import { settle } from '@ng-native/testing';
import { compileSource } from './compile.ts';
import { createLaidOutFabric } from './laid-out-fabric.ts';

const require = createRequire(import.meta.url);
const { compileCss } = require('@ng-native/metro/css/compile.cjs');

const CASES = ['flex: 1 1 auto', '', 'flex-grow: 1', 'flex: 1'];
/** Seven characters, at ten points each. */
const WORD = 'abcdefg';
const CONTENT = 70;
const CONFORMANCES = ['classic', 'strict'] as const;

/** A column of rows, each holding one item with one of the cases on it, by a class. */
function sheetScene(conformance: (typeof CONFORMANCES)[number]) {
  const css =
    '.col { width: 362px } .row { flex-direction: row; align-self: flex-start } ' +
    '.stretch { align-self: stretch } ' +
    CASES.map((declaration, i) => `.c${i} { ${declaration} }`).join(' ');
  const fabric = createLaidOutFabric(conformance);
  const engine = new Engine(fabric, 1, {
    globalStyles: compileCss(css, 'app.css') as never,
    ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
  });
  const element = (classes: string, id: string, parent: EngineNode) => {
    const node = engine.createElement('view');
    engine.setClasses(node, classes);
    engine.setProp(node, 'nativeID', id);
    engine.appendChild(parent, node);
    return node;
  };
  const col = element('col', 'col', engine.root);
  const rows: EngineNode[] = [];
  const items: EngineNode[] = [];
  CASES.forEach((_, i) => {
    rows.push(element('row', `row${i}`, col));
    items.push(element(`c${i}`, `item${i}`, rows[i]!));
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText(WORD));
    engine.appendChild(items[i]!, text);
  });
  const width = (id: string) => {
    engine.commit();
    return fabric.box(id).width;
  };
  return { engine, rows, items, width };
}

describe('a row as wide as its content, with an item that grows', () => {
  for (const conformance of CONFORMANCES) {
    it(`is as wide as what it holds, by a class (${conformance})`, () => {
      const s = sheetScene(conformance);
      CASES.forEach((declaration, i) => {
        assert.equal(s.width(`row${i}`), CONTENT, `row with ${declaration || 'no flex'}`);
        assert.equal(s.width(`item${i}`), CONTENT, `item with ${declaration || 'no flex'}`);
      });
    });
  }

  it('fills the column once it is stretched across it, and fits again once it is not', () => {
    const s = sheetScene('classic');
    for (const [i, row] of s.rows.entries()) s.engine.setClasses(row, 'row stretch');
    CASES.forEach((declaration, i) => {
      assert.equal(s.width(`row${i}`), 362, `row with ${declaration || 'no flex'}`);
      // The item's share of the row is all of it, where it grows.
      assert.equal(s.width(`item${i}`), declaration ? 362 : CONTENT, declaration || 'no flex');
    });
    for (const row of s.rows) s.engine.setClasses(row, 'row');
    CASES.forEach((declaration, i) => {
      assert.equal(s.width(`row${i}`), CONTENT, `row with ${declaration || 'no flex'}`);
    });
  });

  it('fits once let go of a stretch or a width it was first laid out with', () => {
    for (const conformance of CONFORMANCES) {
      // Set on the row alone: a class can restyle what is in it, which notes the row for it.
      for (const first of [{ width: 200 }, { alignSelf: 'stretch' }]) {
        const s = sheetScene(conformance);
        for (const row of s.rows) s.engine.setProp(row, 'style', first);
        assert.equal(s.width('row0'), 'width' in first ? first.width : 362, JSON.stringify(first));
        for (const row of s.rows) s.engine.setProp(row, 'style', null);
        CASES.forEach((declaration, i) => {
          const named = `${JSON.stringify(first)} let go of, with ${declaration || 'no flex'}`;
          assert.equal(s.width(`row${i}`), CONTENT, `${named} (${conformance})`);
        });
      }
    }
  });

  it('follows its item starting to grow after it was laid out, and stopping', () => {
    const s = sheetScene('classic');
    const plain = s.items[1]!;
    assert.equal(s.width('row1'), CONTENT);
    s.engine.setClasses(plain, 'c2');
    assert.equal(s.width('row1'), CONTENT, 'flex-grow: 1 set after the first layout');
    assert.equal(s.width('item1'), CONTENT);
    s.engine.setClasses(plain, '');
    assert.equal(s.width('row1'), CONTENT);
    // What the row holds getting wider still widens it.
    const text = s.engine.createElement('text');
    s.engine.appendChild(text, s.engine.createText('hijklmnopq'));
    s.engine.appendChild(s.items[2]!, text);
    assert.equal(s.width('row2'), 100);
  });

  /** One row in a 362 point column, as wide as its content, holding one item set up by `item`. */
  function oneRow(css: string, item: (engine: Engine, node: EngineNode) => void) {
    const fabric = createLaidOutFabric();
    const engine = new Engine(fabric, 1, { globalStyles: compileCss(css, 'app.css') as never });
    const col = engine.createElement('view');
    engine.setProp(col, 'style', { width: 362 });
    engine.appendChild(engine.root, col);
    const row = engine.createElement('view');
    engine.setProp(row, 'nativeID', 'row');
    engine.setProp(row, 'style', { flexDirection: 'row', alignSelf: 'flex-start' });
    engine.appendChild(col, row);
    const node = engine.createElement('view');
    engine.appendChild(row, node);
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText(WORD));
    engine.appendChild(node, text);
    item(engine, node);
    engine.commit();
    return { fabric, engine, row, node };
  }

  it("is as wide as what it holds where the item grows by React Native's own flex", () => {
    // Nothing else in the app asks for a share: the item's flex alone does.
    const { fabric } = oneRow('', (engine, node) => engine.setProp(node, 'style', { flex: 1 }));
    assert.equal(fabric.box('row').width, CONTENT);
  });

  it('is as wide as what it holds where the item grows by a token', () => {
    const css = ':root { --grow: 1 } .grow { flex-grow: var(--grow) }';
    const { fabric } = oneRow(css, (engine, node) => engine.setClasses(node, 'grow'));
    assert.equal(fabric.box('row').width, CONTENT);
  });

  it('is not fitted for an item that grows down a column, which takes no room across', () => {
    const { fabric, engine, node } = oneRow('', (e, item) => {
      e.setProp(item.parent!, 'style', { flexDirection: 'column', alignSelf: 'flex-start' });
    });
    const before = fabric.calls.completeRoot;
    engine.setProp(node, 'style', { flexGrow: 1 });
    engine.commit();
    assert.equal(fabric.box('row').width, CONTENT);
    assert.equal(fabric.calls.completeRoot - before, 1, 'one commit, and none to fit it');
  });

  it('is not fitted where it is stretched across its column from the first layout', () => {
    for (const row of [{ alignSelf: 'stretch' }, { width: 200 }]) {
      const { fabric } = oneRow('', (engine, node) => {
        engine.setProp(node.parent!, 'style', { flexDirection: 'row', ...row });
        engine.setProp(node, 'style', { flexGrow: 1, flexBasis: 0 });
      });
      assert.equal(fabric.box('row').width, 'width' in row ? row.width : 362);
      assert.equal(
        fabric.calls.completeRoot,
        1,
        `one commit, and none to fit it: ${JSON.stringify(row)}`,
      );
    }
  });
});

describe('a row as wide as its content, with an item that grows by its style attribute', () => {
  /** A row as wide as its content by how it is aligned, and by its own width. */
  const ROW_STYLES = ['align-self: flex-start', 'width: fit-content'];
  /** The items, with two that grow from a basis of zero points. */
  const STYLED = [...CASES, 'flex: 1 1 0px', 'flex-grow: 1; flex-basis: 0px'];
  for (const conformance of CONFORMANCES) {
    it(`is as wide as what it holds (${conformance})`, async () => {
      const rows = ROW_STYLES.flatMap((row, r) =>
        STYLED.map(
          (declaration, i) =>
            `<view nativeID="row${r}-${i}" style="flex-direction: row; ${row}"><view style="${declaration}"><text>${WORD}</text></view></view>`,
        ),
      ).join('');
      const file = path.join(import.meta.dirname, `css-grow-content-row-${conformance}.fixture.ts`);
      const mod = await compileSource(
        `
import { Component } from '@angular/core';
import { View } from '../components/src/view.ts';
import { Text } from '../components/src/text.ts';
@Component({
  selector: 'x-grow-${conformance}',
  imports: [View, Text],
  template: '<view style="width: 362px">${rows}</view>',
})
export class Rows {}
`,
        file,
        file.replace(/\.ts$/, '.generated.ts'),
      );
      const fabric = createLaidOutFabric(conformance);
      const app = mount(1, mod['Rows'] as Type<unknown>, fabric, {
        ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
      });
      try {
        await settle();
        ROW_STYLES.forEach((row, r) => {
          STYLED.forEach((declaration, i) => {
            assert.equal(
              fabric.box(`row${r}-${i}`).width,
              CONTENT,
              `${row}, item with ${declaration || 'no flex'}`,
            );
          });
        });
      } finally {
        app.applicationRef.destroy();
      }
    });
  }
});

/**
 * Items that grow from a basis of zero points, `flex: 1 1 0px` or a `flex-basis: 0px` beside a
 * `flex-grow`, and the other growing items, in a row that is as wide as its content by its own
 * width: `fit-content`, or capped at `max-content`. Strict Yoga gives the row no width where the
 * basis is zero points, and Yoga as React Native configures it gives it all the room it could
 * have. Chrome lays each out at the width of the text, in every one of these places.
 */
const ZERO_BASIS = [
  'flex: 1 1 0px',
  'flex: 1 1 0',
  'flex: 2 0 0px',
  'flex: 1 1 0rem',
  'flex-grow: 1; flex-basis: 0px',
  'flex-grow: var(--grow); flex-basis: 0px',
  'flex-grow: 1; flex-basis: var(--none)',
];
const GROWING = [...ZERO_BASIS, 'flex: 1 1 0%', 'flex: 1', 'flex: 1 1 auto', 'flex-grow: 1'];
/** What holds the row, and the row, as written: each as wide as its content in a browser. */
const FITTED_ROWS = {
  'a fit-content row in a column': ['col', 'flex-direction: row; width: fit-content'],
  'a max-content row in a column': ['col', 'flex-direction: row; max-width: max-content'],
  'a fit-content row in a block': ['block', 'flex-direction: row; width: fit-content'],
  'a fit-content row in a row': ['across', 'flex-direction: row; width: fit-content'],
  'an absolute fit-content row': [
    'col',
    'flex-direction: row; width: fit-content; position: absolute',
  ],
  'a fit-content row in a column that centres it': [
    'centre',
    'flex-direction: row; width: fit-content',
  ],
  'a fit-content box around a row': ['col', 'width: fit-content'],
} as const;

/** One row of each kind in `FITTED_ROWS`, each holding one item with `declaration` on it. */
function fittedScene(declaration: string, conformance: (typeof CONFORMANCES)[number]) {
  const kinds = Object.values(FITTED_ROWS);
  const css =
    ':root { --grow: 1; --none: 0px } .col { width: 362px }' +
    ' .centre { width: 362px; align-items: center } .block { display: block; width: 362px }' +
    ' .across { flex-direction: row; width: 362px }' +
    ` .inner { flex-direction: row } .item { ${declaration} }` +
    kinds.map(([, row], i) => ` .row${i} { ${row} }`).join('') +
    ' .stretch { width: auto; max-width: none; align-self: stretch } .sized { width: 200px }';
  const fabric = createLaidOutFabric(conformance);
  const engine = new Engine(fabric, 1, {
    globalStyles: compileCss(css, 'app.css') as never,
    ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
  });
  const element = (classes: string, id: string, parent: EngineNode) => {
    const node = engine.createElement('view');
    engine.setClasses(node, classes);
    engine.setProp(node, 'nativeID', id);
    engine.appendChild(parent, node);
    return node;
  };
  const rows: EngineNode[] = [];
  const items: EngineNode[] = [];
  kinds.forEach(([around, row], i) => {
    rows.push(element(`row${i}`, `row${i}`, element(around, `around${i}`, engine.root)));
    // The last holds a row that is stretched across it, which is the row the item is in.
    const inner = row.includes('flex-direction') ? rows[i]! : element('inner', `in${i}`, rows[i]!);
    items.push(element('item', `item${i}`, inner));
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText(WORD));
    engine.appendChild(items[i]!, text);
  });
  const width = (id: string) => {
    engine.commit();
    return fabric.box(id).width;
  };
  return { fabric, engine, rows, items, width, names: Object.keys(FITTED_ROWS) };
}

describe('a row as wide as its content by its own width, with an item that grows', () => {
  for (const conformance of CONFORMANCES) {
    it(`is as wide as what it holds (${conformance})`, () => {
      for (const declaration of GROWING) {
        const s = fittedScene(declaration, conformance);
        s.names.forEach((name, i) => {
          assert.equal(s.width(`row${i}`), CONTENT, `${name}, item with ${declaration}`);
          assert.equal(s.width(`item${i}`), CONTENT, `${name}, item with ${declaration}`);
        });
      }
    });

    it(`follows its item starting to grow from no basis, and stopping (${conformance})`, () => {
      const s = fittedScene('flex-shrink: 1', conformance);
      s.names.forEach((name, i) => assert.equal(s.width(`row${i}`), CONTENT, name));
      for (const item of s.items) s.engine.setProp(item, 'style', { flexGrow: 1, flexBasis: 0 });
      s.names.forEach((name, i) => {
        assert.equal(s.width(`row${i}`), CONTENT, `${name}, growth set after the first layout`);
        assert.equal(s.width(`item${i}`), CONTENT, name);
      });
      for (const item of s.items) s.engine.setProp(item, 'style', null);
      s.names.forEach((name, i) => assert.equal(s.width(`row${i}`), CONTENT, name));
      // What the row holds getting wider still widens it, with the item growing again.
      for (const item of s.items) {
        s.engine.setProp(item, 'style', { flex: 1 });
        const text = s.engine.createElement('text');
        s.engine.appendChild(text, s.engine.createText('hijklmnopq'));
        s.engine.appendChild(item, text);
      }
      s.names.forEach((name, i) => assert.equal(s.width(`row${i}`), 100, name));
    });

    it(`fills its column once stretched across it, and fits again once not (${conformance})`, () => {
      const s = fittedScene('flex: 1 1 0px', conformance);
      const row = s.rows[0]!;
      assert.equal(s.width('row0'), CONTENT);
      s.engine.setClasses(row, 'row0 stretch');
      assert.equal(s.width('row0'), 362, 'stretched');
      assert.equal(s.width('item0'), 362, "the item's share is all of it");
      s.engine.setClasses(row, 'row0');
      assert.equal(s.width('row0'), CONTENT, 'fitted again');
      assert.equal(s.width('item0'), CONTENT);
    });
  }

  it('fits once let go of a width, a stretch or a growth it was first laid out with', () => {
    for (const conformance of CONFORMANCES) {
      for (const first of ['sized', 'stretch']) {
        const s = fittedScene('flex: 1 1 0px', conformance);
        s.rows.forEach((row, i) => s.engine.setClasses(row, `row${i} ${first}`));
        assert.equal(s.width('row0'), first === 'sized' ? 200 : 362, `${first} (${conformance})`);
        s.rows.forEach((row, i) => s.engine.setClasses(row, `row${i}`));
        s.names.forEach((name, i) => {
          assert.equal(s.width(`row${i}`), CONTENT, `${name}, let go of ${first} (${conformance})`);
        });
      }
      // An item of a row that grows in it from the first layout, and stops.
      const s = fittedScene('flex: 1 1 0px', conformance);
      s.engine.setProp(s.rows[3]!, 'style', { flexGrow: 1 });
      assert.equal(s.width('row3'), 362, conformance);
      s.engine.setProp(s.rows[3]!, 'style', null);
      assert.equal(s.width('row3'), CONTENT, `growth taken away (${conformance})`);
    }
  });

  it('takes its share of a row it grows in, as any item that grows does', () => {
    for (const conformance of CONFORMANCES) {
      for (const grows of [{ flexGrow: 1 }, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }]) {
        const named = `${JSON.stringify(grows)} (${conformance})`;
        const s = fittedScene('flex: 1 1 0px', conformance);
        // The fourth is an item of a row: `fit-content` is its basis, which it grows from.
        s.engine.setProp(s.rows[3]!, 'style', grows);
        assert.equal(s.width('row3'), 362, named);
        assert.equal(s.width('item3'), 362, named);
        s.engine.setProp(s.rows[3]!, 'style', null);
        assert.equal(s.width('row3'), CONTENT, `${named}, taken away`);
      }
    }
  });

  it('is not fitted where it is stretched, or grows in its row: one commit for a change', () => {
    for (const conformance of CONFORMANCES) {
      const s = fittedScene('flex: 1 1 0px', conformance);
      s.engine.setClasses(s.rows[0]!, 'row0 stretch');
      s.engine.setProp(s.rows[3]!, 'style', { flexGrow: 1 });
      assert.equal(s.width('row0'), 362, conformance);
      const before = s.fabric.calls.completeRoot;
      s.engine.setProp(s.rows[0]!, 'style', { paddingTop: 2 });
      s.engine.setProp(s.rows[3]!, 'style', { flexGrow: 1, paddingTop: 2 });
      assert.equal(s.width('row0'), 362, conformance);
      assert.equal(s.width('row3'), 362, conformance);
      assert.equal(s.fabric.calls.completeRoot - before, 1, `none to fit them (${conformance})`);
    }
  });

  it("is as wide as what it holds where the item grows by React Native's own flex (strict)", () => {
    const fabric = createLaidOutFabric('strict');
    const engine = new Engine(fabric, 1, { layoutConformance: 'strict' });
    const col = engine.createElement('view');
    engine.setProp(col, 'style', { width: 362 });
    engine.appendChild(engine.root, col);
    const row = engine.createElement('view');
    engine.setProp(row, 'nativeID', 'row');
    engine.setProp(row, 'style', { flexDirection: 'row', width: 'fit-content' });
    engine.appendChild(col, row);
    const item = engine.createElement('view');
    engine.setProp(item, 'style', { flex: 1 });
    engine.appendChild(row, item);
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText(WORD));
    engine.appendChild(item, text);
    engine.commit();
    assert.equal(fabric.box('row').width, CONTENT);
  });
});

/**
 * A row given a width and let go of it by a class on a box above it: nothing on the row itself
 * changes, so no prop of its own is dirty. What it holds is styled again with it, as it hands
 * down a context of its own, and its growing item notes it for a fit. Chrome lays the row out
 * at the width it is given, and at the width of the text once it is as wide as its content.
 */
describe('a row as wide as its content by an ancestor, with an item that grows from no basis', () => {
  const SIZED = 200;
  /** How the row is as wide as its content under `.narrow`. */
  const BY = {
    'fit-content': '.wide .row { width: 200px } .narrow .row { width: fit-content }',
    'a cap at max-content': '.wide .row { width: 200px } .narrow .row { max-width: max-content }',
  };
  function ancestorScene(
    css: string,
    conformance: (typeof CONFORMANCES)[number],
    first: string,
    byStyle = false,
  ) {
    const fabric = createLaidOutFabric(conformance);
    const engine = new Engine(fabric, 1, {
      globalStyles: compileCss(
        `.col { width: 362px } .row { flex-direction: row } .item { flex: 1 1 0px } ${css}`,
        'app.css',
      ) as never,
      ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
    });
    const element = (classes: string, id: string, parent: EngineNode) => {
      const node = engine.createElement('view');
      engine.setClasses(node, classes);
      engine.setProp(node, 'nativeID', id);
      engine.appendChild(parent, node);
      return node;
    };
    // The class is on the box above the column, two above the row.
    const screen = element(first, 'screen', engine.root);
    const row = element('row', 'row', element('col', 'col', screen));
    // One that grows by its style attribute matches no rule, and is styled by what it inherits.
    const item = element(byStyle ? '' : 'item', 'item', row);
    if (byStyle) engine.setProp(item, 'style', { flexGrow: 1, flexShrink: 1, flexBasis: 0 });
    const text = engine.createElement('text');
    engine.appendChild(text, engine.createText(WORD));
    engine.appendChild(item, text);
    const width = (id: string) => {
      engine.commit();
      return fabric.box(id).width;
    };
    return { fabric, engine, screen, width };
  }

  for (const conformance of CONFORMANCES) {
    for (const [by, css] of Object.entries(BY)) {
      it(`fits once its ancestor lets go of its width, by ${by} (${conformance})`, () => {
        const s = ancestorScene(css, conformance, 'wide');
        assert.equal(s.width('row'), SIZED, 'sized');
        assert.equal(s.width('item'), SIZED, "the item's share is all of it");
        s.engine.setClasses(s.screen, 'narrow');
        assert.equal(s.width('row'), CONTENT, 'fitted');
        assert.equal(s.width('item'), CONTENT);
        s.engine.setClasses(s.screen, 'wide');
        assert.equal(s.width('row'), SIZED, 'sized again');
        assert.equal(s.width('item'), SIZED);
        s.engine.setClasses(s.screen, 'narrow');
        assert.equal(s.width('row'), CONTENT, 'fitted again');
      });

      it(`takes the width its ancestor gives it once fitted, by ${by} (${conformance})`, () => {
        const s = ancestorScene(css, conformance, 'narrow');
        assert.equal(s.width('row'), CONTENT, 'fitted');
        s.engine.setClasses(s.screen, 'wide');
        assert.equal(s.width('row'), SIZED, 'sized');
        assert.equal(s.width('item'), SIZED);
        s.engine.setClasses(s.screen, 'narrow');
        assert.equal(s.width('row'), CONTENT, 'fitted again');
        assert.equal(s.width('item'), CONTENT);
      });
    }

    it(`fits once its ancestor lets go of its width, the item grown by its style (${conformance})`, () => {
      const s = ancestorScene(BY['fit-content'], conformance, 'wide', true);
      assert.equal(s.width('row'), SIZED, 'sized');
      s.engine.setClasses(s.screen, 'narrow');
      assert.equal(s.width('row'), CONTENT, 'fitted');
      assert.equal(s.width('item'), CONTENT);
      s.engine.setClasses(s.screen, 'wide');
      assert.equal(s.width('row'), SIZED, 'sized again');
    });
  }

  it('is committed once for an ancestor restyled where it stays sized', () => {
    for (const conformance of CONFORMANCES) {
      const s = ancestorScene(
        `${BY['fit-content']} .tall { padding-top: 2px }`,
        conformance,
        'wide',
      );
      assert.equal(s.width('row'), SIZED, conformance);
      const before = s.fabric.calls.completeRoot;
      s.engine.setClasses(s.screen, 'wide tall');
      assert.equal(s.width('row'), SIZED, conformance);
      assert.equal(s.fabric.calls.completeRoot - before, 1, `none to fit it (${conformance})`);
    }
  });
});

/**
 * Tabs that each grow from a basis of nothing, `flex: 1 1 0%` (Tailwind's `flex-1`), in a row as
 * wide as its content. Chrome sizes the row by what the tabs hold and then shares it out evenly
 * from nothing, so tabs of different lengths come out the same width wherever that keeps each
 * tab's longest word whole: `aa` and `bb cc dd` are 50 each, the second on two lines.
 *
 * Where an even share is narrower than a word, Chrome under the layout reset (`min-width: 0`)
 * lets the word overflow its tab, and a device would break it. The engine holds such a tab at its
 * longest word, as Chrome does for an item with CSS's own `min-width: auto`, and shares what is
 * left: `a` and `abcdefg` are 10 and 70, where Chrome under the reset has 40 each.
 */
describe('tabs that grow from no basis, in a row as wide as its content', () => {
  const ROWS = {
    'a fit-content row in a column': ['col', 'flex-direction: row; width: fit-content'],
    'a max-content row in a column': ['col', 'flex-direction: row; max-width: max-content'],
    'a row kept from stretching': ['col', 'flex-direction: row; align-self: flex-start'],
    'a fit-content row in a column that centres it': [
      'centre',
      'flex-direction: row; width: fit-content',
    ],
    'an inline-flex row in a block': ['block', 'display: inline-flex; flex-direction: row'],
    'an absolute fit-content row': [
      'col',
      'flex-direction: row; width: fit-content; position: absolute',
    ],
    // The tabs are in a row stretched across the box that is fitted.
    'a fit-content box around a row': ['col', 'width: fit-content'],
    'a fit-content row, right to left': ['col rtl', 'flex-direction: row; width: fit-content'],
  } as const;
  /** Each tab's text, at ten points a character. */
  const WORDS = ['aa', 'bb cc dd'];
  const ONE_WORD = ['a', 'abcdefg'];
  const THREE = ['a', 'bb', 'cccc'];
  /** Chrome's row and tabs for `WORDS` shared evenly, each as a width and a height. */
  const EVEN = [
    [100, 40],
    [50, 40],
    [50, 40],
  ];

  function tabsScene(
    [around, row]: readonly [string, string],
    tab: string,
    texts: readonly string[],
    conformance: (typeof CONFORMANCES)[number],
  ) {
    const css =
      '.col { width: 362px } .centre { width: 362px; align-items: center }' +
      ' .block { display: block; width: 362px } .inner { flex-direction: row }' +
      ' .rtl { direction: rtl }' +
      ` .row { ${row} } .tab { ${tab} } .stretch { width: auto; max-width: none;` +
      ' align-self: stretch; display: flex; position: relative } .two { flex-grow: 2 }';
    const fabric = createLaidOutFabric(conformance);
    const engine = new Engine(fabric, 1, {
      globalStyles: compileCss(css, 'app.css') as never,
      ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
    });
    const element = (classes: string, id: string, parent: EngineNode) => {
      const node = engine.createElement('view');
      engine.setClasses(node, classes);
      engine.setProp(node, 'nativeID', id);
      engine.appendChild(parent, node);
      return node;
    };
    const rowNode = element('row', 'row', element(around, 'around', engine.root));
    const inner = row.includes('flex-direction') ? rowNode : element('inner', 'inner', rowNode);
    const tabs: EngineNode[] = [];
    const words: EngineNode[] = [];
    for (const [i, text] of texts.entries()) {
      tabs.push(element('tab', `tab${i}`, inner));
      const node = engine.createElement('text');
      words.push(engine.createText(text));
      engine.appendChild(node, words[i]!);
      engine.appendChild(tabs[i]!, node);
    }
    /** Each box's width and height, to the half point: Chrome has 66.67 where Yoga rounds. */
    const sizes = (...ids: string[]) => {
      engine.commit();
      const near = (value: number) => Math.round(value * 2) / 2;
      return ids.map((id) => [near(fabric.box(id).width), near(fabric.box(id).height)]);
    };
    const tabSizes = () => sizes('row', ...texts.map((_, i) => `tab${i}`));
    return { fabric, engine, row: rowNode, tabs, words, sizes, tabSizes };
  }

  const GROWING = [
    'flex: 1 1 0%',
    'flex: 1',
    'flex-grow: 1; flex-basis: 0%',
    'flex: 1 1 0px',
    'flex: 1 1 0%; min-width: auto',
  ];

  for (const conformance of CONFORMANCES) {
    it(`shares the row out evenly where that keeps every word whole (${conformance})`, () => {
      for (const tab of GROWING) {
        for (const [name, row] of Object.entries(ROWS)) {
          const s = tabsScene(row, tab, WORDS, conformance);
          assert.deepEqual(s.tabSizes(), EVEN, `${name}, ${tab}`);
        }
      }
    });

    it(`holds a tab at its longest word, unbroken (${conformance})`, () => {
      for (const tab of GROWING) {
        for (const [name, row] of Object.entries(ROWS)) {
          const named = `${name}, ${tab}`;
          const one = tabsScene(row, tab, ONE_WORD, conformance);
          const oneAt = [
            [80, 20],
            [10, 20],
            [70, 20],
          ];
          assert.deepEqual(one.tabSizes(), oneAt, named);
          const three = tabsScene(row, tab, THREE, conformance);
          const threeAt = [
            [70, 20],
            [10, 20],
            [20, 20],
            [40, 20],
          ];
          assert.deepEqual(three.tabSizes(), threeAt, named);
        }
      }
    });

    it(`shares the row by how much each tab grows (${conformance})`, () => {
      for (const [name, row] of Object.entries(ROWS)) {
        const s = tabsScene(row, 'flex: 1 1 0%', WORDS, conformance);
        s.engine.setClasses(s.tabs[0]!, 'tab two');
        const shared = [
          [100, 60],
          [66.5, 60],
          [33.5, 60],
        ];
        assert.deepEqual(s.tabSizes(), shared, name);
      }
    });

    it(`holds a tab that does not grow at its longest word (${conformance})`, () => {
      // Chrome under the reset has these tabs 0 wide, each word on a line of its own and
      // reaching past it; with `min-width: auto` it has them at their longest word, as here.
      for (const tab of ['flex: 0 1 0%', 'flex: 0 0 0%']) {
        for (const [name, row] of Object.entries(ROWS)) {
          const s = tabsScene(row, tab, WORDS, conformance);
          const held = [
            [100, 60],
            [20, 60],
            [20, 60],
          ];
          assert.deepEqual(s.tabSizes(), held, `${name}, ${tab}`);
        }
      }
      // A basis of 0 points that does not grow counts at it, so Chrome's row is 0 wide: a tab is
      // held no wider than its row, and is 0 wide too.
      for (const [name, row] of Object.entries(ROWS)) {
        const s = tabsScene(row, 'flex: 0 1 0px', WORDS, conformance);
        const none = [
          [0, 60],
          [0, 60],
          [0, 60],
        ];
        assert.deepEqual(s.tabSizes(), none, `${name}, flex: 0 1 0px`);
      }
    });

    it(`gives a tab no minimum where its own min-width says so (${conformance})`, () => {
      // As Chrome does: the even share, with the word reaching past the tab.
      for (const [name, row] of Object.entries(ROWS)) {
        const s = tabsScene(row, 'flex: 1 1 0%; min-width: 0', ONE_WORD, conformance);
        assert.deepEqual(
          s.sizes('row', 'tab0', 'tab1').map(([width]) => width),
          [80, 40, 40],
          name,
        );
      }
    });

    it(`follows its basis, its growth, its words and a stretch changing (${conformance})`, () => {
      const FROM_AUTO = [
        [100, 20],
        [20, 20],
        [80, 20],
      ];
      for (const [name, row] of Object.entries(ROWS)) {
        const s = tabsScene(row, 'flex: 1 1 auto', WORDS, conformance);
        assert.deepEqual(s.tabSizes(), FROM_AUTO, `${name}, from auto`);
        for (const tab of s.tabs) s.engine.setProp(tab, 'style', { flexBasis: '0%' });
        assert.deepEqual(s.tabSizes(), EVEN, `${name}, 0% set`);
        for (const tab of s.tabs) s.engine.setProp(tab, 'style', { flexGrow: 0, flexBasis: '0%' });
        const held = [
          [100, 60],
          [20, 60],
          [20, 60],
        ];
        assert.deepEqual(s.tabSizes(), held, `${name}, growth taken away`);
        for (const tab of s.tabs) s.engine.setProp(tab, 'style', { flexBasis: '0%' });
        assert.deepEqual(s.tabSizes(), EVEN, `${name}, growing again`);
        // A word longer than the share: the tab is held at it, and the other has the rest.
        s.engine.setText(s.words[1]!, 'bbbbbbb');
        const word = [
          [90, 20],
          [20, 20],
          [70, 20],
        ];
        assert.deepEqual(s.tabSizes(), word, `${name}, one word`);
        s.engine.setText(s.words[1]!, 'bb cc dd');
        assert.deepEqual(s.tabSizes(), EVEN, `${name}, words again`);
        s.engine.setClasses(s.row, 'row stretch');
        const stretched = [
          [362, 20],
          [181, 20],
          [181, 20],
        ];
        assert.deepEqual(s.tabSizes(), stretched, `${name}, stretched`);
        s.engine.setClasses(s.row, 'row');
        assert.deepEqual(s.tabSizes(), EVEN, `${name}, fitted again`);
        for (const tab of s.tabs) s.engine.setProp(tab, 'style', null);
        assert.deepEqual(s.tabSizes(), FROM_AUTO, `${name}, auto again`);
      }
    });
  }

  it('is committed once for a change that moves nothing', () => {
    for (const conformance of CONFORMANCES) {
      const s = tabsScene(
        ROWS['a fit-content row in a column'],
        'flex: 1 1 0%',
        WORDS,
        conformance,
      );
      assert.deepEqual(s.tabSizes(), EVEN, conformance);
      const before = s.fabric.calls.completeRoot;
      s.engine.setProp(s.tabs[0]!, 'style', { backgroundColor: 'red' });
      assert.deepEqual(s.tabSizes(), EVEN, conformance);
      assert.equal(s.fabric.calls.completeRoot - before, 1, `nothing measured (${conformance})`);
    }
  });

  it('reads the longest words once a fit has the tabs at their content', () => {
    for (const conformance of CONFORMANCES) {
      const s = tabsScene(
        ROWS['a fit-content row in a column'],
        'flex: 1 1 0%',
        WORDS,
        conformance,
      );
      assert.deepEqual(s.tabSizes(), EVEN, conformance);
      // Fitted (two commits), and then the words read (two more), once each.
      let before = s.fabric.calls.completeRoot;
      s.engine.setText(s.words[1]!, 'bbbbbbb');
      s.engine.commit();
      assert.equal(s.fabric.calls.completeRoot - before, 5, `words changed (${conformance})`);
      // The room changing fits the row again, and its words, which did not change, are kept.
      before = s.fabric.calls.completeRoot;
      s.engine.setProp(s.row.parent!, 'style', { width: 300 });
      const word = [
        [90, 20],
        [20, 20],
        [70, 20],
      ];
      assert.deepEqual(s.tabSizes(), word, conformance);
      assert.equal(s.fabric.calls.completeRoot - before, 3, `room changed (${conformance})`);
    }
  });

  it('lets go of the minimum once the row is stretched', () => {
    for (const conformance of CONFORMANCES) {
      const s = tabsScene(
        ROWS['a fit-content row in a column'],
        'flex: 1 1 0%',
        WORDS,
        conformance,
      );
      assert.deepEqual(s.tabSizes(), EVEN, conformance);
      s.engine.setClasses(s.row, 'row stretch');
      assert.deepEqual(s.sizes('tab0', 'tab1'), [
        [181, 20],
        [181, 20],
      ]);
      // Nothing is fitted or read: the words changing is one commit.
      const before = s.fabric.calls.completeRoot;
      s.engine.setText(s.words[1]!, 'bbbbbbb');
      s.engine.commit();
      assert.equal(s.fabric.calls.completeRoot - before, 1, conformance);
    }
  });

  it('lets go of the minimum once the row is given the width it was fitted to', () => {
    // A row of its own width is not as wide as its content, and Chrome shares it out evenly,
    // with the word reaching past its tab, as the engine does for any row with a width.
    for (const conformance of CONFORMANCES) {
      const s = tabsScene(
        ROWS['a fit-content row in a column'],
        'flex: 1 1 0%',
        ONE_WORD,
        conformance,
      );
      assert.deepEqual(s.sizes('tab0', 'tab1'), [
        [10, 20],
        [70, 20],
      ]);
      s.engine.setProp(s.row, 'style', { width: 80 });
      const even = s.sizes('row', 'tab0', 'tab1').map(([width]) => width);
      assert.deepEqual(even, [80, 40, 40], conformance);
    }
  });

  it('holds a tab at its longest word where only the tabs ask for a layout', () => {
    // No sheet, and nothing that asks for CSS's layout: the row is fitted for its growing items.
    for (const conformance of CONFORMANCES) {
      const fabric = createLaidOutFabric(conformance);
      const engine = new Engine(fabric, 1, {
        ...(conformance === 'strict' ? { layoutConformance: 'strict' as const } : {}),
      });
      const view = (style: Record<string, unknown>, id: string, parent: EngineNode) => {
        const node = engine.createElement('view');
        engine.setProp(node, 'style', style);
        engine.setProp(node, 'nativeID', id);
        engine.appendChild(parent, node);
        return node;
      };
      const col = view({ width: 362 }, 'col', engine.root);
      const row = view({ flexDirection: 'row', alignSelf: 'flex-start' }, 'row', col);
      for (const [i, word] of ONE_WORD.entries()) {
        const tab = view({ flexGrow: 1, flexShrink: 1, flexBasis: '0%' }, `tab${i}`, row);
        const text = engine.createElement('text');
        engine.appendChild(text, engine.createText(word));
        engine.appendChild(tab, text);
      }
      engine.commit();
      const widths = ['row', 'tab0', 'tab1'].map((id) => fabric.box(id).width);
      assert.deepEqual(widths, [80, 10, 70], conformance);
    }
  });
});
