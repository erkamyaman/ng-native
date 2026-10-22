/**
 * A border the same on every side, which native is given unsided as well: Android strokes a
 * rounded border, the only way it draws one dashed or dotted, from `borderWidth` and
 * `borderColor` alone, and only when every side equals them. Given the sides only, it fills each
 * side in as a solid quadrilateral: a dashed card with rounded corners was drawn solid there, and
 * dashed on iOS. The four sides are only known once the cascade is done and every token is read,
 * so these hold the props a view is committed with.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { Type } from '@angular/core';
import { Engine } from '@ng-native/fabric';
import {
  compileCss,
  createFakeFabric,
  render,
  settle,
  type FakeFabricNode,
} from '@ng-native/testing';
import { compileSource } from './compile.ts';

const RED = 'rgb(255, 0, 0)';

/** A view wearing `classes`, committed, with every warning collected. */
function view(css: string, classes: string[] = ['a']) {
  const warnings: string[] = [];
  const sheet = compileCss(css, 'border', { onUnsupported: (m: string) => warnings.push(m) });
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const node = engine.createElement('view', sheet);
  for (const name of classes) engine.addClass(node, name);
  engine.appendChild(engine.root, node);
  engine.commit();
  const props = () => fabric.committed[0]!.props;
  return { engine, node, props, warnings };
}

const sides = (props: Record<string, unknown>, part: 'Width' | 'Color') =>
  ['Top', 'Right', 'Bottom', 'Left'].map((side) => props[`border${side}${part}`]);

describe('a border the same on every side', () => {
  it('is given unsided as well, beside each side', () => {
    const { props, warnings } = view('.a { border: 1px dashed #8a7a66; border-radius: 12px }');
    assert.deepEqual(warnings, []);
    assert.equal(props()['borderWidth'], 1);
    assert.equal(props()['borderColor'], 'rgb(138, 122, 102)');
    assert.equal(props()['borderStyle'], 'dashed');
    assert.deepEqual(sides(props(), 'Width'), [1, 1, 1, 1]);
  });

  it('is, with a colour from a token, as every Tailwind 4 colour is', () => {
    // `border border-dashed border-gray-300` is `border-color: var(--color-gray-300)`.
    const { props } = view(`.a { --line: ${RED}; border: 1px dashed; border-color: var(--line) }`);
    assert.equal(props()['borderColor'], RED);
    assert.equal(props()['borderWidth'], 1);
  });

  it('is, with a token for the colour in the shorthand', () => {
    const { props } = view(`.a { --line: ${RED}; border: 1px dashed var(--line) }`);
    assert.equal(props()['borderWidth'], 1);
    assert.equal(props()['borderColor'], RED);
  });

  it('is, with a width a token or the font size gives', () => {
    const token = view('.a { --w: 2px; border: 1px dashed red; border-width: var(--w) }');
    assert.equal(token.props()['borderWidth'], 2);
    const em = view('.a { font-size: 10px; border: 0.5em dashed red }');
    assert.equal(em.props()['borderWidth'], 5);
  });

  it('is, in a system colour, which each side holds as an object of its own', () => {
    const { props } = view('.a { border: 1px dashed; border-color: AccentColor }');
    assert.notEqual(props()['borderTopColor'], undefined);
    assert.deepEqual(props()['borderColor'], props()['borderTopColor']);
  });

  it('is, where a stronger rule gives every side a width of its own', () => {
    const css =
      '.a { border: 1px dashed red } ' +
      '.b { border-top-width: 2px; border-right-width: 2px; border-bottom-width: 2px; ' +
      'border-left-width: 2px }';
    assert.equal(view(css, ['a', 'b']).props()['borderWidth'], 2);
    // Preflight's `* { border: 0 solid }` under a width given side by side.
    const preflight =
      '* { border: 0 solid } ' +
      '.a { border-style: dashed; border-color: red; border-top-width: 2px; ' +
      'border-right-width: 2px; border-bottom-width: 2px; border-left-width: 2px }';
    assert.equal(view(preflight).props()['borderWidth'], 2);
  });

  it('is not, where the sides differ, and is taken back when they come to', () => {
    assert.equal('borderWidth' in view('.a { border-width: 1px 2px }').props(), false);
    assert.equal(
      'borderColor' in view('.a { border: 1px solid; border-color: red blue }').props(),
      false,
    );
    const { engine, node, props } = view(
      '.a { border: 1px dashed red } .b { border-top-width: 4px }',
    );
    assert.equal(props()['borderWidth'], 1);
    engine.addClass(node, 'b');
    engine.commit();
    assert.equal(props()['borderTopWidth'], 4);
    assert.equal(props()['borderWidth'] ?? null, null);
  });

  it('is not, where a logical side has a width of its own', () => {
    const { props } = view('.a { border: 1px dashed red; border-inline-start-width: 3px }');
    assert.equal('borderWidth' in props(), false);
  });

  it('is not, where there is no width to draw', () => {
    // Preflight writes this on every element: nothing is stroked, so nothing more is sent.
    const { props } = view('.a { border: 0 solid; border-color: red }');
    assert.equal('borderWidth' in props(), false);
    assert.equal('borderColor' in props(), false);
  });
});

const BLUE = 'rgb(0, 0, 255)';
const DARK_RED = 'rgb(204, 0, 0)';
const DASHED = '.a { width: 240px; height: 80px; border: 4px dashed #cc0000; border-radius: 16px }';
const unsided = (props: Record<string, unknown>) => [
  props['borderWidth'] ?? null,
  props['borderColor'] ?? null,
];

describe('a border the same on every side, set by the element', () => {
  it('is given unsided from the sides an inline style sets, over a stylesheet border', () => {
    // The report: native was handed the inline sides beside the stylesheet's unsided border.
    const { engine, node, props } = view(DASHED);
    assert.deepEqual(unsided(props()), [4, DARK_RED], 'control');
    engine.setProp(node, 'style', {
      borderTopWidth: 6,
      borderRightWidth: 6,
      borderBottomWidth: 6,
      borderLeftWidth: 6,
      borderTopColor: BLUE,
      borderRightColor: BLUE,
      borderBottomColor: BLUE,
      borderLeftColor: BLUE,
    });
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [6, 6, 6, 6]);
    assert.deepEqual(unsided(props()), [6, BLUE]);
    assert.equal(props()['borderStyle'], 'dashed');
  });

  it('is given as a stylesheet giving the same sides gives it', () => {
    const css = '.a { border-style: dashed; border-radius: 16px }';
    const own = view(css);
    own.engine.setProp(own.node, 'style', {
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
    });
    own.engine.commit();
    const sheet = view(`${css} .b { border-width: 2px }`, ['a', 'b']);
    assert.deepEqual(unsided(sheet.props()), [2, null], 'control');
    assert.deepEqual(unsided(own.props()), unsided(sheet.props()));
  });

  it('is given from one side an inline style sets where the stylesheet gives the rest', () => {
    const { engine, node, props } = view('.a { border: 4px dashed red; border-top-width: 6px }');
    assert.equal(unsided(props())[0], null, 'control: the sides differ');
    engine.setProp(node, 'style', { borderTopWidth: 4 });
    engine.commit();
    assert.deepEqual(unsided(props()), [4, RED]);
  });

  it('is taken back where an inline style makes the sides differ', () => {
    const { engine, node, props } = view(DASHED);
    engine.setProp(node, 'style', { borderTopWidth: 6, borderTopColor: BLUE });
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [6, 4, 4, 4]);
    assert.deepEqual(unsided(props()), [null, null]);
  });

  it('is given from an inline unsided width and colour over the stylesheet sides', () => {
    const { engine, node, props } = view(DASHED);
    engine.setProp(node, 'style', { borderWidth: 6, borderColor: BLUE });
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [6, 6, 6, 6]);
    assert.deepEqual(sides(props(), 'Color'), [BLUE, BLUE, BLUE, BLUE]);
    assert.deepEqual(unsided(props()), [6, BLUE]);
  });

  it('is given from every side bound from a token', () => {
    const { engine, node, props } = view(`${DASHED} .a { --w: 6px }`);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      engine.setBoundStyle(node, `border${side}Width`, 'var(--w)');
    }
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [6, 6, 6, 6]);
    assert.deepEqual(unsided(props()), [6, DARK_RED]);
  });

  it('is given from a bound unsided width over the stylesheet sides', () => {
    const { engine, node, props } = view(`${DASHED} .a { --w: 6px }`);
    engine.setBoundStyle(node, 'borderWidth', 'var(--w)');
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [6, 6, 6, 6]);
    assert.deepEqual(unsided(props()), [6, DARK_RED]);
  });

  it('keeps a bound unsided width beside a side that differs, as the element set it', () => {
    const { engine, node, props } = view(`${DASHED} .a { --w: 6px }`);
    engine.setBoundStyle(node, 'borderWidth', 'var(--w)');
    engine.setProp(node, 'style', { borderTopWidth: 2 });
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [2, 6, 6, 6]);
    assert.equal(props()['borderWidth'], 6);
  });

  it('is the stylesheet border again once the inline style goes, sent as null', () => {
    const { engine, node, props } = view(DASHED);
    engine.setProp(node, 'style', { borderWidth: 6, borderColor: BLUE });
    engine.commit();
    engine.setProp(node, 'style', { borderTopWidth: 6 });
    engine.commit();
    // As a stylesheet's: with the widths differing, neither is given unsided.
    assert.deepEqual(unsided(props()), [null, null]);
    assert.equal(props()['borderWidth'], null, 'sent null, not left out');
    assert.equal(props()['borderColor'], null, 'sent null, not left out');
    engine.setProp(node, 'style', null);
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [4, 4, 4, 4]);
    assert.deepEqual(unsided(props()), [4, DARK_RED]);
  });

  it('is still given beside an inline style that sets no border', () => {
    const { engine, node, props } = view(DASHED);
    engine.setProp(node, 'style', { opacity: 0.5 });
    engine.commit();
    assert.deepEqual(unsided(props()), [4, DARK_RED]);
  });

  it('keeps an unsided width of none the element sets itself', () => {
    const { engine, node, props } = view(DASHED);
    engine.setProp(node, 'style', { borderWidth: 0 });
    engine.commit();
    assert.deepEqual(sides(props(), 'Width'), [0, 0, 0, 0]);
    assert.equal(props()['borderWidth'], 0);
  });
});

const flatten = (nodes: readonly FakeFabricNode[]): FakeFabricNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('a border the same on every side, bound in a template', () => {
  it('is given unsided from what each binding sets, and from the stylesheet once it goes', async () => {
    const file = path.join(import.meta.dirname, 'css-uniform-border-bound.fixture.ts');
    const mod = await compileSource(
      `
import { Component, signal } from '@angular/core';
import { View } from '../components/src/view.ts';
@Component({
  selector: 'x-bound',
  imports: [View],
  template: \`
    <view nativeID="all" class="box" [style]="sides()"></view>
    <view nativeID="top" class="box top" [style.borderTopWidth.px]="top()"></view>
    <view nativeID="width" class="box" [style.borderWidth.px]="width()"></view>
  \`,
  styles: \`
    .box { width: 240px; height: 80px; border: 4px dashed #cc0000; border-radius: 16px }
    .top { border-top-width: 2px }
  \`,
})
export class Bound {
  readonly sides = signal<Record<string, string> | null>({
    'border-top-width': '6px',
    'border-right-width': '6px',
    'border-bottom-width': '6px',
    'border-left-width': '6px',
    'border-top-color': 'blue',
    'border-right-color': 'blue',
    'border-bottom-color': 'blue',
    'border-left-color': 'blue',
  });
  readonly top = signal<number | null>(4);
  readonly width = signal<number | null>(6);
}
`,
      file,
      file.replace(/\.ts$/, '.generated.ts'),
    );
    type Bound = {
      sides: { set(value: null): void };
      top: { set(value: number | null): void };
      width: { set(value: number | null): void };
    };
    const { fabric, instance } = await render(mod['Bound'] as Type<Bound>);
    const box = (id: string) =>
      flatten(fabric.committed).find((one) => one.props['nativeID'] === id)!.props;
    assert.deepEqual(sides(box('all'), 'Width'), [6, 6, 6, 6]);
    // An inline colour is handed to native as written, which converts it.
    assert.deepEqual(unsided(box('all')), [6, 'blue']);
    assert.equal(box('all')['borderStyle'], 'dashed');
    assert.deepEqual(unsided(box('top')), [4, DARK_RED]);
    assert.deepEqual(sides(box('width'), 'Width'), [6, 6, 6, 6]);
    assert.deepEqual(unsided(box('width')), [6, DARK_RED]);

    instance.sides.set(null);
    instance.top.set(null);
    instance.width.set(null);
    await settle();
    assert.deepEqual(unsided(box('all')), [4, DARK_RED]);
    // The stylesheet's top differs from its other sides: nothing unsided, sent as null.
    assert.deepEqual(sides(box('top'), 'Width'), [2, 4, 4, 4]);
    assert.equal(box('top')['borderWidth'], null);
    assert.equal(box('top')['borderColor'], null);
    assert.deepEqual(sides(box('width'), 'Width'), [4, 4, 4, 4]);
    assert.deepEqual(unsided(box('width')), [4, DARK_RED]);
  });
});
