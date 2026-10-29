/**
 * `background: var(--bg)`: the token is read on device as the background colour, the one part of
 * the shorthand native has. A token that is no colour unsets it, as Chrome unsets every longhand
 * of a shorthand whose token cannot be substituted.
 *
 * Chrome's values for the stylesheet path are in the oracle (`css-oracle-cases.ts`); this covers a
 * token set on an element, and one that changes after the first commit.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Engine } from '@ng-native/fabric';
import { compileCss, createFakeFabric } from '@ng-native/testing';

/** A parent wearing `parent` around a child wearing `a`, with every warning collected. */
function tree(css: string, parent: string[] = []) {
  const warnings: string[] = [];
  const sheet = compileCss(css, 'background', { onUnsupported: (m: string) => warnings.push(m) });
  const fabric = createFakeFabric();
  const engine = new Engine(fabric, 1);
  const outer = engine.createElement('view', sheet);
  for (const name of parent) engine.addClass(outer, name);
  const node = engine.createElement('view', sheet);
  engine.addClass(node, 'a');
  engine.appendChild(outer, node);
  engine.appendChild(engine.root, outer);
  engine.commit();
  const background = () => fabric.committed[0]!.children[0]!.props['backgroundColor'];
  const image = () => fabric.committed[0]!.children[0]!.props['experimental_backgroundImage'];
  const prop = (key: string) => fabric.committed[0]!.children[0]!.props[key];
  return { engine, outer, node, background, image, prop, warnings };
}

describe('background: var()', () => {
  it('compiles with no warning, and reads a token from the stylesheet as the colour', () => {
    const { background, warnings } = tree('.p { --bg: #f00 } .a { background: var(--bg) }', ['p']);
    assert.deepEqual(warnings, []);
    assert.equal(background(), 'rgb(255, 0, 0)');
  });

  it('reads a token set on the element, and follows it when it changes', () => {
    const { engine, node, background } = tree('.a { background: var(--bg, #000) }');
    assert.equal(background(), 'rgb(0, 0, 0)', 'the fallback, until the token is set');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 128, 0)');
    engine.commit();
    assert.equal(background(), 'rgb(0, 128, 0)');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 0, 255)');
    engine.commit();
    assert.equal(background(), 'rgb(0, 0, 255)');
  });

  it('follows a token on the parent when it changes', () => {
    const { engine, outer, background } = tree(
      '.p { --bg: #f00 } .q { --bg: #0f0 } .a { background: var(--bg) }',
      ['p'],
    );
    assert.equal(background(), 'rgb(255, 0, 0)');
    engine.removeClass(outer, 'p');
    engine.addClass(outer, 'q');
    engine.commit();
    assert.equal(background(), 'rgb(0, 255, 0)');
  });

  it('unsets the colour for a token that is no colour, over a weaker rule', () => {
    const { engine, node, background } = tree(
      '.a { background-color: #f00 } .a { --bg: 2px; background: var(--bg) }',
    );
    assert.equal(background(), undefined, 'the declaration wins the cascade and is unset');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 0, 255)');
    engine.commit();
    assert.equal(background(), 'rgb(0, 0, 255)');
  });

  it('draws a gradient a token set on the element holds, with the colour under it', () => {
    // A colour slider's track: the library works the gradient out and sets it as a token.
    const { engine, node, background, image } = tree('.a { background: var(--bg) }');
    engine.setCustomProperty(node, '--bg', 'linear-gradient(to right, rgba(255, 0, 0, 1), #00f)');
    engine.commit();
    assert.deepEqual(image(), [
      {
        type: 'linear-gradient',
        direction: { type: 'angle', value: 90 },
        colorStops: [
          { color: 'rgba(255, 0, 0, 1)', position: null },
          { color: 'rgba(0, 0, 255, 1)', position: null },
        ],
      },
    ]);
    assert.equal(background() ?? null, null);
    // A colour area: two gradients over a colour, the first written on top.
    const area =
      'linear-gradient(to top, #000, transparent), linear-gradient(45deg, #fff 10%, transparent 90%), rgb(255, 0, 0)';
    engine.setCustomProperty(node, '--bg', area);
    engine.commit();
    const layers = image() as { direction: unknown; colorStops: { position: unknown }[] }[];
    assert.deepEqual(
      layers.map((layer) => layer.direction),
      [
        { type: 'angle', value: 0 },
        { type: 'angle', value: 45 },
      ],
    );
    assert.deepEqual(
      layers[1]!.colorStops.map((stop) => stop.position),
      ['10%', '90%'],
    );
    assert.equal(background(), 'rgb(255, 0, 0)');
    // A colour again, and then nothing: the gradient goes with the token that held it.
    engine.setCustomProperty(node, '--bg', 'rgb(0, 128, 0)');
    engine.commit();
    assert.equal(image() ?? null, null);
    assert.equal(background(), 'rgb(0, 128, 0)');
  });

  const RED_TO_BLUE = 'linear-gradient(to right, rgb(255, 0, 0), rgb(0, 0, 255))';
  const BLUE_TO_GREEN = [
    {
      type: 'linear-gradient',
      direction: { type: 'angle', value: 180 },
      colorStops: [
        { color: 'rgb(0, 0, 255)', position: null },
        { color: 'rgb(0, 128, 0)', position: null },
      ],
    },
  ];
  /** The direction of each gradient committed: 90 for the token's, 180 for a rule's own. */
  const directions = (image: unknown) =>
    ((image ?? []) as { direction: { value: number } }[]).map((layer) => layer.direction.value);

  it('ranks the gradient with the image and its colour with the colour, each on its own', () => {
    // An important colour is no reason to drop the image the shorthand's token holds.
    const colour = tree('.a { background: var(--bg) } .a { background-color: #0f0 !important }');
    colour.engine.setCustomProperty(colour.node, '--bg', `${RED_TO_BLUE}, rgb(255, 0, 0)`);
    colour.engine.commit();
    assert.deepEqual(directions(colour.image()), [90], "the token's gradient is drawn");
    assert.equal(colour.background(), 'rgb(0, 255, 0)', 'under the important colour');

    // An important image stands over the token's.
    const image = tree(
      '.a { background: var(--bg) } .a { background-image: linear-gradient(blue, green) !important }',
    );
    image.engine.setCustomProperty(image.node, '--bg', `${RED_TO_BLUE}, rgb(255, 0, 0)`);
    image.engine.commit();
    assert.deepEqual(image.image(), BLUE_TO_GREEN);
    assert.equal(image.background(), 'rgb(255, 0, 0)', "and the token's colour is still read");
  });

  it('gives way to an image a later rule declares, and stands over an earlier one', () => {
    const later = tree(
      '.a { background: var(--bg) } .a { background-image: linear-gradient(blue, green) }',
    );
    later.engine.setCustomProperty(later.node, '--bg', RED_TO_BLUE);
    later.engine.commit();
    assert.deepEqual(later.image(), BLUE_TO_GREEN, 'the later declaration wins the cascade');

    const earlier = tree(
      '.a { background-image: linear-gradient(blue, green) } .a { background: var(--bg) }',
    );
    earlier.engine.setCustomProperty(earlier.node, '--bg', RED_TO_BLUE);
    earlier.engine.commit();
    assert.deepEqual(directions(earlier.image()), [90]);

    // Important, the shorthand stands over a later image that is not.
    const important = tree(
      '.a { background: var(--bg) !important } .a { background-image: linear-gradient(blue, green) }',
    );
    important.engine.setCustomProperty(important.node, '--bg', RED_TO_BLUE);
    important.engine.commit();
    assert.deepEqual(directions(important.image()), [90]);
  });

  it('draws no image for background-color, whose token holding a gradient is no colour', () => {
    const { engine, node, background, image } = tree('.a { background-color: var(--bg) }');
    engine.setCustomProperty(node, '--bg', RED_TO_BLUE);
    engine.commit();
    assert.equal(image() ?? null, null, 'a colour declaration sets no image');
    assert.equal(background() ?? null, null);
  });

  it('reads the gradient from the token the declaration settles on, the first that is set', () => {
    const { engine, node, image } = tree('.a { background: var(--missing, var(--backup)) }');
    engine.setCustomProperty(node, '--backup', RED_TO_BLUE);
    engine.commit();
    assert.deepEqual(directions(image()), [90]);
  });

  it('reads a gradient written in capitals, as CSS does', () => {
    const { engine, node, image } = tree('.a { background: var(--bg) }');
    engine.setCustomProperty(
      node,
      '--bg',
      'LINEAR-GRADIENT(TO RIGHT, RGB(255, 0, 0), RGB(0, 0, 255))',
    );
    engine.commit();
    assert.deepEqual(directions(image()), [90]);
  });

  it('draws nothing for a gradient native has none of, and none for one it cannot read', () => {
    const { engine, node, background, image } = tree('.a { background: var(--bg) }');
    for (const unread of [
      'conic-gradient(red, blue)',
      'linear-gradient(to right, red)',
      'url(a.png)',
    ]) {
      engine.setCustomProperty(node, '--bg', unread);
      engine.commit();
      assert.equal(image() ?? null, null, unread);
      assert.equal(background() ?? null, null, unread);
    }
  });

  it('leaves the colour unset for a token holding a gradient, which is refused where it is set', () => {
    const { background, warnings } = tree(
      '.a { background-color: #f00 } .a { --bg: linear-gradient(red, blue); background: var(--bg) }',
    );
    assert.equal(background(), undefined, 'no colour to read, so the declaration is unset');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /'--bg' has a value native cannot express/);
  });

  it('reads a color-mix() of a token, worked out on device', () => {
    // Chrome serialises a mixed colour as `color(srgb ...)`, which the oracle compares as text, so
    // the mix is checked here: 50% of rgb(0, 0, 200) and black is rgb(0, 0, 100).
    const { background, warnings } = tree(
      '.a { --bg: rgb(0, 0, 200); background: color-mix(in srgb, var(--bg), rgb(0, 0, 0)) }',
    );
    assert.deepEqual(warnings, []);
    assert.equal(background(), 'rgb(0, 0, 100)');
  });

  it('still refuses the shorthand with anything beside the token', () => {
    const { background, warnings } = tree('.a { background: var(--bg) none }');
    assert.equal(background(), undefined);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /'background' mixes var\(\) with other values/);
  });

  it('reads a relative colour from a token, worked out on device', () => {
    // Chrome 154 gives `color(srgb 0 0 0.784314 / 0.5)`, the same colour, written in a form the
    // oracle cannot compare as text.
    const { background, warnings } = tree(
      '.a { --bg: rgb(0, 0, 200); background: rgb(from var(--bg) r g b / 0.5) }',
    );
    assert.deepEqual(warnings, []);
    assert.equal(background(), 'rgba(0, 0, 200, 0.5)');
  });

  it('lands a platform colour in the background colour, the prop native has', () => {
    const { background, warnings } = tree('.a { background: platform-color(systemBlue) }');
    assert.deepEqual(warnings, []);
    assert.deepEqual(
      background(),
      { semantic: ['systemBlue'] },
      "iOS's form, which the engine makes",
    );
  });

  it('unsets the colour for a token holding a colour and an image, which a browser paints', () => {
    // Chrome 154 paints rgb(1, 2, 3) for `--bg: rgb(1, 2, 3) none`: the token is the whole
    // shorthand there. Here a token is one value, so it is no colour; supported-css says so.
    const { engine, node, background } = tree(
      '.a { background-color: rgb(9, 9, 9) } .a { background: var(--bg) }',
    );
    engine.setCustomProperty(node, '--bg', 'rgb(1, 2, 3) none');
    engine.commit();
    assert.equal(background(), undefined);
  });
});

/**
 * `background: linear-gradient(...), var(--primary)`: images written out over a colour from a
 * token, as shadcn-style buttons write them. The images are settled at build time and the colour
 * on device. Where the token makes no colour the whole background goes, as Chrome makes the
 * shorthand invalid at computed-value time and gives every longhand its initial value.
 */
describe('background: images over a var() colour', () => {
  const GLOSS = 'linear-gradient(180deg, #ffffff33 0%, #ffffff00 67.7%)';
  const KEYS = [
    'backgroundColor',
    'experimental_backgroundImage',
    'experimental_backgroundPosition',
    'experimental_backgroundSize',
    'experimental_backgroundRepeat',
  ];
  const NONE = Object.fromEntries(KEYS.map((key) => [key, null]));
  /** The background props committed on the child, each null where it is not set. */
  const painted = (css: string, parent: string[] = []) => {
    const built = tree(css, parent);
    const props = () => Object.fromEntries(KEYS.map((key) => [key, built.prop(key) ?? null]));
    return { ...built, props };
  };
  const layers = (value: unknown) => (value as unknown[] | undefined)?.length;

  it('paints the images over the token, as the same background with the colour written does', () => {
    const tokened = painted(
      `.p { --primary: #615fff } .a { background: ${GLOSS}, var(--primary) }`,
      ['p'],
    );
    const written = painted(`.a { background: ${GLOSS}, #615fff }`);
    assert.deepEqual(tokened.warnings, []);
    assert.equal(tokened.background(), 'rgb(97, 95, 255)');
    assert.equal(layers(tokened.image()), 1);
    assert.deepEqual(tokened.props(), written.props());
  });

  it('follows the token where it is set and as it changes, the images staying', () => {
    const { engine, node, background, image } = tree(`.a { background: ${GLOSS}, var(--bg) }`);
    engine.setCustomProperty(node, '--bg', 'rgb(0, 128, 0)');
    engine.commit();
    assert.equal(background(), 'rgb(0, 128, 0)');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 0, 255)');
    engine.commit();
    assert.equal(background(), 'rgb(0, 0, 255)');
    assert.equal(layers(image()), 1);
  });

  it('unsets the whole background for a token that is unset or no colour, over weaker rules', () => {
    const { engine, node, props } = painted(
      '.a { background-color: #f00; background-image: linear-gradient(red, blue); ' +
        'background-size: 4px 4px } ' +
        `.a { background: ${GLOSS}, var(--bg) }`,
    );
    assert.deepEqual(props(), NONE, 'an unset token');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 0, 255)');
    engine.commit();
    assert.equal(props()['backgroundColor'], 'rgb(0, 0, 255)');
    assert.equal(layers(props()['experimental_backgroundImage']), 1);
    engine.setCustomProperty(node, '--bg', 'bold');
    engine.commit();
    assert.deepEqual(props(), NONE, 'a token that is no colour');
    engine.setCustomProperty(node, '--bg', 'rgb(0, 0, 255)');
    engine.commit();
    engine.setCustomProperty(node, '--bg', null);
    engine.commit();
    assert.deepEqual(props(), NONE, 'the token going away');
  });

  it('unsets the whole background for a token that is a part of a layer other than a colour', () => {
    // Chrome 141 substitutes the token as the whole last layer: `2px` is its position, and a
    // gradient its image, under no colour. Here the token is read as the colour alone, so it
    // is no colour, and the background is unset as an invalid one is; supported-css says so.
    const { engine, node, props } = painted(`.a { background: ${GLOSS}, var(--bg) }`);
    for (const part of ['2px', 'linear-gradient(red, blue)']) {
      engine.setCustomProperty(node, '--bg', part);
      engine.commit();
      assert.deepEqual(props(), NONE, part);
    }
  });

  it('falls back as the var() says, through another token and to a written colour', () => {
    const { background, image } = tree(
      `.a { --b: rgb(1, 2, 3) } .a { background: ${GLOSS}, var(--missing, var(--b)) }`,
    );
    assert.equal(background(), 'rgb(1, 2, 3)');
    assert.equal(layers(image()), 1);
    const written = tree(`.a { background: ${GLOSS}, var(--missing, #0f0) }`);
    assert.equal(written.background(), 'rgb(0, 255, 0)');
  });

  it('reads a colour made of a token in the last layer, as background-color does', () => {
    const { background, image, warnings } = tree(
      `.a { --bg: rgb(0, 0, 200); background: ${GLOSS}, color-mix(in srgb, var(--bg), rgb(0, 0, 0)) }`,
    );
    assert.deepEqual(warnings, []);
    assert.equal(background(), 'rgb(0, 0, 100)');
    assert.equal(layers(image()), 1);
  });

  it('lands a platform colour the token holds in the background colour', () => {
    const { background, image, warnings } = tree(
      `.a { --bg: platform-color(systemBlue); background: ${GLOSS}, var(--bg) }`,
    );
    assert.deepEqual(warnings, []);
    assert.deepEqual(background(), { semantic: ['systemBlue'] });
    assert.equal(layers(image()), 1);
  });

  it('places and sizes the images as written, and resets what a weaker rule placed', () => {
    const weaker = '.a { background-size: 4px 4px; background-repeat: no-repeat } ';
    const tokened = painted(
      `${weaker}.a { --bg: #000; background: ${GLOSS} center / 50% repeat-x, ${GLOSS}, var(--bg) }`,
    );
    const written = painted(
      `${weaker}.a { background: ${GLOSS} center / 50% repeat-x, ${GLOSS}, #000 }`,
    );
    assert.deepEqual(tokened.warnings, []);
    assert.deepEqual(tokened.props(), written.props());
    assert.equal(layers(tokened.prop('experimental_backgroundSize')), 2);
  });

  it('gives way to a longhand a later rule declares, and stands over it when important', () => {
    const later = tree(
      `.a { --bg: #f00; background: ${GLOSS}, var(--bg) } ` +
        '.a { background-image: none; background-color: #0f0 }',
    );
    assert.deepEqual(later.image(), [], 'the later image wins');
    assert.equal(later.background(), 'rgb(0, 255, 0)', 'and the later colour');

    const important = tree(
      `.a { --bg: #f00; background: ${GLOSS}, var(--bg) !important } ` +
        '.a { background-image: none; background-color: #0f0 }',
    );
    assert.equal(layers(important.image()), 1);
    assert.equal(important.background(), 'rgb(255, 0, 0)');

    // Unset and important: nothing, over a later colour and image that are not.
    const unset = tree(
      `.a { background: ${GLOSS}, var(--missing) !important } ` +
        '.a { background-image: linear-gradient(red, blue); background-color: #0f0 }',
    );
    assert.equal(unset.background() ?? null, null);
    assert.equal(unset.image() ?? null, null);
  });

  it('draws a last layer that is a gradient with a token in it as a gradient, not a colour', () => {
    const { background, image, warnings } = tree(
      `.a { --a: rgb(0, 0, 255); background: ${GLOSS}, linear-gradient(var(--a), red) }`,
    );
    assert.deepEqual(warnings, []);
    assert.equal(layers(image()), 2);
    assert.equal(background() ?? null, null);
  });

  it('still refuses a var() among the images, and anything beside the colour token', () => {
    const MIXES = /'background' mixes var\(\) with other values/;
    for (const [value, why] of [
      // The message the same images give beside a written colour.
      [`url(a.png), var(--bg)`, /a url\(\) is not something native can paint/],
      [`${GLOSS} 0 0 / 1em 1em, var(--bg)`, /have to be settled at build time/],
      [`linear-gradient(var(--a), red) center, var(--bg)`, MIXES],
      [`${GLOSS} center, linear-gradient(var(--a), red)`, MIXES],
      [`${GLOSS}, var(--bg) none`, MIXES],
      [`${GLOSS} var(--bg)`, MIXES],
    ] as const) {
      const { background, image, warnings } = tree(
        `.a { --a: red; --bg: blue; background: ${value} }`,
      );
      assert.equal(background() ?? null, null, value);
      assert.equal(image() ?? null, null, value);
      assert.equal(warnings.length, 1, value);
      assert.match(warnings[0]!, why, value);
    }
  });
});
