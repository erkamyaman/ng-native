/**
 * Record where Chrome paints each box of `fixtures/mask-cases.ts`, and in what colour, as
 * `fixtures/mask-oracle.json`: the rectangle of the box's pixels that are painted, from its top
 * left corner, and the colour in the middle of it.
 *
 *   node scripts/generate-mask-oracle.mjs
 *
 * Re-run it when cases are added or changed, and commit the fixture alongside them.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { COLOUR, MASK_CASES } from '../fixtures/mask-cases.ts';

const { chromium } = createRequire(import.meta.url)('playwright');

const page = `<!doctype html><style>
  body { margin: 0; background: white }
  .case { margin: 20px; background: ${COLOUR} }
  ${MASK_CASES.map((c) => `#${c.name} { width: ${c.width}px; height: ${c.height}px; ${c.css} }`).join('\n')}
</style>${MASK_CASES.map((c) => `<div class="case" id="${c.name}"></div>`).join('')}`;

const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 1 });
await tab.setContent(page);
const recorded = [];
for (const each of MASK_CASES) {
  const shot = await tab.locator(`#${each.name}`).screenshot();
  const pixels = await tab.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [image.width, image.height];
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let [left, top, right, bottom] = [Infinity, Infinity, -1, -1];
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const at = (y * image.width + x) * 4;
        if (data[at] === 255 && data[at + 1] === 255 && data[at + 2] === 255) continue;
        [left, top] = [Math.min(left, x), Math.min(top, y)];
        [right, bottom] = [Math.max(right, x), Math.max(bottom, y)];
      }
    }
    if (right < 0) return { painted: null, colour: null };
    const middle =
      (Math.floor((top + bottom) / 2) * image.width + Math.floor((left + right) / 2)) * 4;
    return {
      painted: [left, top, right - left + 1, bottom - top + 1],
      colour: `rgb(${data[middle]}, ${data[middle + 1]}, ${data[middle + 2]})`,
    };
  }, shot.toString('base64'));
  recorded.push({ name: each.name, ...pixels });
}
await browser.close();
const out = fileURLToPath(new URL('../fixtures/mask-oracle.json', import.meta.url));
// As the format check has it, so a fixture recorded again differs only where Chrome does.
const prettier = await import('prettier');
const options = (await prettier.resolveConfig(out)) ?? {};
writeFileSync(out, await prettier.format(JSON.stringify(recorded), { ...options, filepath: out }));
console.log(recorded);
