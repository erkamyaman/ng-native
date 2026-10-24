/**
 * An element whose children the engine commits inside a view of its own (`wrapChildren`), as a
 * stack screen holds a page's content in a safe area view on iOS 26 and later. The tree keeps the
 * children in the element; only what reaches native has the view between them. The element's
 * box is its own view's, and how it places its children is the wrapper's, which holds them.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { Engine, registerHoist, type EngineNode } from '@ng-native/fabric';
import { createFakeFabric, type FakeFabricNode } from '@ng-native/testing';

const require = createRequire(import.meta.url);
const { compileCss } = require('@ng-native/metro/css/compile.cjs');

const CSS =
  '.page { flex-direction: row; justify-content: center; align-items: center; gap: 4px;' +
  ' padding: 8px; background-color: red } .page > .cell { opacity: 0.5 }';

const WRAPPER = { viewName: 'Wrapper', props: { flex: 1, edges: 'top' } };

function scene() {
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1, { globalStyles: compileCss(CSS, 'app.css') as never });
  const page = engine.createElement('page');
  engine.setClasses(page, 'page');
  engine.setProp(page, 'nativeID', 'page');
  engine.appendChild(engine.root, page);
  const cell = (id: string, parent: EngineNode = page): EngineNode => {
    const node = engine.createElement('view');
    engine.setClasses(node, 'cell');
    engine.setProp(node, 'nativeID', id);
    engine.appendChild(parent, node);
    return node;
  };
  const cells = ['a', 'b'].map((id) => cell(id));
  const view = (): FakeFabricNode => {
    engine.commit();
    return fabric.committed[0]!;
  };
  const ids = (node: FakeFabricNode) => node.children.map((child) => child.props['nativeID']);
  return { engine, fabric, page, cells, cell, view, ids };
}

const PLACING = ['flexDirection', 'justifyContent', 'alignItems', 'rowGap', 'columnGap'];
const placing = (props: Record<string, unknown>) =>
  Object.fromEntries(PLACING.filter((key) => key in props).map((key) => [key, props[key]]));
const PLACED = {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  rowGap: 4,
  columnGap: 4,
};

describe('an element that wraps its children', () => {
  it('commits them in the wrapper, which places them as the element says', () => {
    const s = scene();
    s.engine.wrapChildren(s.page, WRAPPER);
    const page = s.view();
    assert.equal(page.children.length, 1);
    const [wrapper] = page.children;
    assert.equal(wrapper!.viewName, 'Wrapper');
    assert.deepEqual(s.ids(wrapper!), ['a', 'b']);
    assert.deepEqual(wrapper!.props, { flex: 1, edges: 'top', ...PLACED });
    assert.deepEqual(placing(page.props), {}, 'the element places nothing');
    assert.equal(page.props['paddingTop'], 8, 'its padding is its own');
    assert.equal(page.props['backgroundColor'], 'rgb(255, 0, 0)');
    assert.equal(wrapper!.children[0]!.props['opacity'], 0.5, 'a child selector still matches');
  });

  it('clones the wrapper for its own props, keeping both views and the children', () => {
    const s = scene();
    s.engine.wrapChildren(s.page, WRAPPER);
    const before = s.view();
    const wrapped = before.children[0]!;
    s.engine.wrapChildren(s.page, { ...WRAPPER, props: { flex: 1, edges: 'none' } });
    const after = s.view();
    assert.equal(after.reactTag, before.reactTag);
    assert.equal(after.children[0]!.reactTag, wrapped.reactTag);
    assert.equal(after.children[0]!.props['edges'], 'none');
    assert.equal(after.children[0]!.children[0]!.reactTag, wrapped.children[0]!.reactTag);
  });

  it('places the children by the element style as it changes, and as a rule goes away', () => {
    const s = scene();
    s.engine.wrapChildren(s.page, WRAPPER);
    const tag = s.view().children[0]!.reactTag;
    s.engine.setClasses(s.page, '');
    const wrapper = s.view().children[0]!;
    assert.equal(wrapper.reactTag, tag);
    // Null, which takes a committed prop away: an absent key leaves native's value.
    assert.deepEqual(placing(wrapper.props), {
      flexDirection: null,
      justifyContent: null,
      alignItems: null,
      rowGap: null,
      columnGap: null,
    });
    assert.equal(wrapper.props['flex'], 1, 'its own props stay');
    assert.equal(wrapper.children[0]!.props['opacity'], null);
    s.engine.setClasses(s.page, 'page');
    assert.deepEqual(placing(s.view().children[0]!.props), PLACED);
  });

  it('takes children inserted, moved and removed into the wrapper', () => {
    const s = scene();
    s.engine.wrapChildren(s.page, WRAPPER);
    s.view();
    const [a, b] = s.cells;
    const c = s.engine.createElement('view');
    s.engine.setProp(c, 'nativeID', 'c');
    s.engine.insertBefore(s.page, c, a!);
    assert.deepEqual(s.ids(s.view().children[0]!), ['c', 'a', 'b']);
    s.engine.insertBefore(s.page, b!, c);
    assert.deepEqual(s.ids(s.view().children[0]!), ['b', 'c', 'a']);
    s.engine.removeChild(s.page, c);
    assert.deepEqual(s.ids(s.view().children[0]!), ['b', 'a']);
    s.engine.removeChild(null, b!);
    assert.deepEqual(s.ids(s.view().children[0]!), ['a']);
  });

  it('makes the element again when it starts or stops wrapping after it was committed', () => {
    const s = scene();
    const plain = s.view();
    assert.deepEqual(s.ids(plain), ['a', 'b']);
    assert.deepEqual(placing(plain.props), PLACED);

    s.engine.wrapChildren(s.page, WRAPPER);
    const wrapped = s.view();
    assert.notEqual(wrapped.reactTag, plain.reactTag, 'native gives a view one parent');
    assert.notEqual(wrapped.children[0]!.children[0]!.reactTag, plain.children[0]!.reactTag);
    assert.deepEqual(s.ids(wrapped.children[0]!), ['a', 'b']);
    assert.deepEqual(placing(wrapped.props), {});

    s.engine.wrapChildren(s.page, null);
    const unwrapped = s.view();
    assert.notEqual(unwrapped.reactTag, wrapped.reactTag);
    assert.deepEqual(s.ids(unwrapped), ['a', 'b']);
    assert.deepEqual(placing(unwrapped.props), PLACED);
    assert.equal(unwrapped.children[0]!.props['opacity'], 0.5);
  });

  it('makes the wrapper again with the element, when the element is made again', () => {
    const s = scene();
    s.engine.wrapChildren(s.page, WRAPPER);
    const first = s.view();
    // Moved under another parent, an element is created afresh with everything under it.
    const holder = s.engine.createElement('view');
    s.engine.appendChild(s.engine.root, holder);
    s.engine.appendChild(holder, s.page);
    s.engine.commit();
    const page = s.fabric.committed[0]!.children[0]!;
    assert.notEqual(page.reactTag, first.reactTag);
    assert.equal(page.children[0]!.viewName, 'Wrapper');
    assert.notEqual(page.children[0]!.reactTag, first.children[0]!.reactTag);
    assert.deepEqual(s.ids(page.children[0]!), ['a', 'b']);
  });

  it('commits what is hoisted into it beside the wrapper, after it', () => {
    const undo = registerHoist('x-config', 'page');
    try {
      const s = scene();
      s.engine.wrapChildren(s.page, WRAPPER);
      const config = s.engine.createElement('x-config');
      s.engine.setProp(config, 'nativeID', 'config');
      // Written first, inside a child, as a page writes its header.
      s.engine.insertBefore(s.cells[0]!, config, null);
      const page = s.view();
      assert.deepEqual(
        page.children.map((child) => child.viewName),
        ['Wrapper', 'View'],
      );
      assert.equal(page.children[1]!.props['nativeID'], 'config');
      assert.deepEqual(s.ids(page.children[0]!), ['a', 'b']);
      assert.deepEqual(page.children[0]!.children[0]!.children, [], 'not where it was written');

      s.engine.removeChild(null, config);
      assert.deepEqual(
        s.view().children.map((child) => child.viewName),
        ['Wrapper'],
      );
    } finally {
      undo();
    }
  });
});
