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
