/**
 * A library's mask, drawn in an app that asked for web-compat: a box whose `mask-image` is an SVG
 * is that SVG's shapes in the box's background colour, placed by `mask-size` and `mask-position`
 * where Chrome places it. Each box of `fixtures/mask-cases.ts` is laid out by Yoga as a device
 * lays it out, and what is painted of it is compared with what Chrome painted
 * (`fixtures/mask-oracle.json`, from `scripts/generate-mask-oracle.mjs`).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, describe, it } from 'node:test';
import type { Type, WritableSignal } from '@angular/core';
import { cleanup, compileCss, render, settle } from '@ng-native/testing';
import type { FabricNode } from '@ng-native/fabric';
import type { FakeFabricNode } from '@ng-native/testing';
import { provideWebCompat } from '@ng-native/web-compat';
import { compileFixture } from './compile.ts';
import { layOutFabric } from './laid-out-fabric.ts';
import { COLOUR, MASK_CASES } from './fixtures/mask-cases.ts';

const oracle = createRequire(import.meta.url)('./fixtures/mask-oracle.json') as {
  name: string;
  painted: [number, number, number, number] | null;
  colour: string | null;
}[];

afterEach(cleanup);

let MaskBoxes: Type<unknown>;
before(async () => {
  MaskBoxes = (await compileFixture('fixtures/mask-boxes.ts'))['MaskBoxes'] as Type<unknown>;
});

/** Each box as large as Taiga's large icon, with its em: what is drawn again at the new size. */
const LARGE = '.large { width: 32px; height: 32px; font-size: 32px }';

const SHEET = [
  ...MASK_CASES.map(
    (each) =>
      `.${each.name} { display: block; width: ${each.width}px; height: ${each.height}px;` +
      ` background: ${COLOUR}; ${each.css} }`,
  ),
  // After them, to win over each box's own size.
  LARGE,
].join('\n');

type Rect = readonly [number, number, number, number];

function find(all: readonly FakeFabricNode[], id: string): FakeFabricNode | undefined {
  for (const each of all) {
    const found = each.props['nativeID'] === id ? each : find(each.children, id);
    if (found) return found;
  }
  return undefined;
}

/** A move by a share of a view's own size, as native reads one, in points. */
function moved(props: Record<string, unknown>, width: number, height: number): [number, number] {
  let [x, y] = [0, 0];
  for (const step of (props['transform'] as Record<string, unknown>[] | undefined) ?? []) {
    const [[name, value]] = Object.entries(step) as [[string, unknown]];
    const by = (side: number) =>
      typeof value === 'string' && value.endsWith('%')
        ? (parseFloat(value) / 100) * side
        : Number(value);
    if (name === 'translateX') x += by(width);
    else if (name === 'translateY') y += by(height);
  }
  return [x, y];
}

/** Where a drawing's view box is drawn in its viewport, as `preserveAspectRatio` says. */
function fitted(viewport: Rect, viewBox: number[] | undefined, align: string | undefined): Rect {
  if (!viewBox) return viewport;
  const [x, y, width, height] = viewport;
  const [, , boxWidth, boxHeight] = viewBox as [number, number, number, number];
  const [where = 'xMidYMid', fit = 'meet'] = (align ?? 'xMidYMid meet').split(' ');
  const scale = (fit === 'slice' ? Math.max : Math.min)(width / boxWidth, height / boxHeight);
  const [drawnWidth, drawnHeight] = [boxWidth * scale, boxHeight * scale];
  const along = (part: string, room: number) =>
    part === 'Min' ? 0 : part === 'Max' ? room : room / 2;
  return [
    x + along(where.slice(1, 4), width - drawnWidth),
    y + along(where.slice(5, 8), height - drawnHeight),
    drawnWidth,
    drawnHeight,
  ];
}

/**
 * What a stroked line across a drawing paints, `M0 12h24` with no fill: a band as thick as its
 * stroke, which is in points of the screen (`vector-effect: non-scaling-stroke`). Undefined for a
 * filled shape, which paints the whole drawing in these cases.
 */
function stroked(
  props: Record<string, unknown>,
  drawnBox: Rect,
  viewBox: number[] | undefined,
): Rect | undefined {
  const line = /^M0 ([\d.]+)h([\d.]+)$/.exec(String(props['d'] ?? ''));
  if (!line || props['fill'] != null || !viewBox) return undefined;
  const scale = drawnBox[3] / viewBox[3]!;
  const width = Number(props['strokeWidth']);
  const middle = drawnBox[1] + Number(line[1]) * scale;
  return [drawnBox[0], middle - width / 2, Number(line[2]) * scale, width];
}

/** What of a rectangle is inside a box: the box clips what is past it. */
function within(rect: Rect, box: Rect): Rect | null {
  const left = Math.max(rect[0], box[0]);
  const top = Math.max(rect[1], box[1]);
  const right = Math.min(rect[0] + rect[2], box[0] + box[2]);
  const bottom = Math.min(rect[1] + rect[3], box[1] + box[3]);
  return right > left && bottom > top ? [left, top, right - left, bottom - top] : null;
}

/** Each box drawn, with what of it is painted, from its corner, and in what colour. */
async function drawn() {
  const { fabric, instance } = await render(MaskBoxes, {
    providers: [provideWebCompat()],
    globalStyles: compileCss(SHEET, 'library', { generated: true }),
  });
  const laidOut = layOutFabric(fabric);
  (instance as { shown: WritableSignal<boolean> }).shown.set(true);
  await settle();
  await new Promise((done) => setTimeout(done, 5));
  await settle();
  const rect = (node: FakeFabricNode): Rect =>
    laidOut.getBoundingClientRect!(node as unknown as FabricNode, false) as unknown as Rect;
  const of = (name: string) => {
    const box = find(fabric.committed, name)!;
    const at = rect(box);
    const image = box.children[0]?.children[0];
    const svg = image?.children[0];
    if (!image || svg?.viewName !== 'RNSVGSvgView') {
      return { box, painted: null, colour: null, background: box.props['backgroundColor'] };
    }
    const frame = rect(image);
    const [x, y] = moved(image.props, frame[2], frame[3]);
    const viewport: Rect = [frame[0] + x - at[0], frame[1] + y - at[1], frame[2], frame[3]];
    const { vbWidth, vbHeight, align, meetOrSlice } = svg.props;
    const viewBox = vbWidth ? [0, 0, Number(vbWidth), Number(vbHeight)] : undefined;
    const fit = align ? `${String(align)} ${meetOrSlice === 1 ? 'slice' : 'meet'}` : undefined;
    // A shape's paint: its fill, or its stroke where it is not filled.
    const shape = svg.children[0]!;
    const drawnBox = fitted(viewport, viewBox, fit);
    const painted = within(stroked(shape.props, drawnBox, viewBox) ?? drawnBox, [
      0,
      0,
      at[2],
      at[3],
    ]);
    const paintOf = (key: string) =>
      ((shape.props[key] ?? svg.props[key]) as { payload?: unknown } | undefined)?.payload;
    const colour = paintOf('fill') ?? paintOf('stroke');
    return { box, painted, colour, background: box.props['backgroundColor'] };
  };
  const enlarge = async () => {
    (instance as { large: WritableSignal<boolean> }).large.set(true);
    await settle();
    await new Promise((done) => setTimeout(done, 5));
    await settle();
  };
  return Object.assign(of, { enlarge });
}

describe('a box with a mask, in an app that asked for web-compat', () => {
  for (const expected of oracle) {
    it(`draws ${expected.name} where Chrome paints it`, async () => {
      const box = (await drawn())(expected.name);
      // To within the third of a point Yoga rounds a box to, on a screen three pixels a point.
      assert.ok(box.painted, 'something is drawn');
      box.painted.forEach((side, i) =>
        assert.ok(
          Math.abs(side - expected.painted![i]!) < 0.34,
          `${box.painted} is ${expected.painted}`,
        ),
      );
      // The box paints no background of its own: the drawing is in its colour.
      assert.equal(box.background ?? undefined, undefined);
    });
  }

  it('draws the shapes in the colour Chrome paints them, which is the background', async () => {
    const of = await drawn();
    for (const expected of oracle) {
      assert.equal(of(expected.name).colour, expected.colour, expected.name);
    }
  });

  it('draws a size settled against the box again when the box changes', async () => {
    const of = await drawn();
    await of.enlarge();
    const expected = oracle.find((each) => each.name === 'taiga-large')!.painted!;
    const { painted } = of('taiga');
    assert.ok(painted);
    painted.forEach((side, i) => assert.ok(Math.abs(side - expected[i]!) < 0.34, `${painted}`));
  });
});
