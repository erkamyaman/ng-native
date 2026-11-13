/**
 * The boxes `web-compat-mask.test.ts` draws with a mask, and `scripts/generate-mask-oracle.mjs`
 * has Chrome draw, recording where Chrome paints each and in what colour
 * (`mask-oracle.json`). Each drawing is a square of one colour filling its view box, so where it
 * is painted is where the mask image is placed. The box's background is `COLOUR`.
 */
export interface MaskCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** The rest of the box's declarations: the mask. */
  readonly css: string;
}

export const COLOUR = 'rgb(200, 0, 0)';

/** A drawing of a square filling it, as a `data:` URL, of a size and a view box. */
export const square = (attributes: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}><rect width="100%" height="100%" /></svg>`,
  )}")`;

/** A Lucide-style icon: no fill, a stroke of `currentColor`, which is the mask's colour. */
export const STROKED = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="24"><path d="M0 12h24" /></svg>',
)}")`;

/**
 * Taiga's icons: a stroke as wide as the drawing's viewport is wider than it is tall, a tenth of
 * it, which the library's `mask-size` widens by ten times its stroke width.
 */
export const TAIGA_STROKED = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="calc((100vw - 100vh) / 10)"><path vector-effect="non-scaling-stroke" d="M0 12h24" /></svg>',
)}")`;

const ICON = square('width="24" height="24" viewBox="0 0 24 24"');
const SMALL = square('width="10" height="10" viewBox="0 0 10 10"');
const WIDE = square('width="10" height="5" viewBox="0 0 10 5"');
const SHAPE_ONLY = square('viewBox="0 0 20 10"');

export const MASK_CASES: readonly MaskCase[] = [
  {
    name: 'icon',
    width: 24,
    height: 24,
    css: `mask-image: ${ICON}; mask-repeat: no-repeat; mask-position: center`,
  },
  {
    name: 'centred',
    width: 40,
    height: 20,
    css: `mask-image: ${SMALL}; mask-repeat: no-repeat; mask-position: center`,
  },
  {
    name: 'shape-only',
    width: 40,
    height: 40,
    css: `mask-image: ${SHAPE_ONLY}; mask-repeat: no-repeat; mask-position: center`,
  },
  {
    name: 'contain',
    width: 40,
    height: 20,
    css: `mask: ${SMALL} center / contain no-repeat`,
  },
  {
    name: 'sized-from-the-end',
    width: 40,
    height: 20,
    css: `mask-image: ${SMALL}; mask-repeat: no-repeat; mask-size: 8px 4px; mask-position: right 2px bottom 0`,
  },
  {
    name: 'by-shares',
    width: 50,
    height: 30,
    css: `mask-image: ${SMALL}; mask-repeat: no-repeat; mask-position: 25% 75%`,
  },
  {
    name: 'half-wide',
    width: 40,
    height: 20,
    css: `mask-image: ${WIDE}; mask-repeat: no-repeat; mask-size: 50% auto`,
  },
  {
    name: 'stroked',
    width: 24,
    height: 24,
    css: `-webkit-mask-image: ${STROKED}; mask-image: ${STROKED}; mask-repeat: no-repeat`,
  },
  {
    name: 'taiga',
    width: 24,
    height: 24,
    css:
      `--stroke: 0.125rem; font-size: 24px; mask-image: ${TAIGA_STROKED}; mask-repeat: no-repeat;` +
      ' mask-position: center; mask-size: calc(min(1em, 100%) + 10 * var(--stroke)) min(1em, 100%), 100%',
  },
  {
    name: 'taiga-large',
    width: 32,
    height: 32,
    css:
      `--stroke: 0.125rem; font-size: 32px; mask-image: ${TAIGA_STROKED}; mask-repeat: no-repeat;` +
      ' mask-position: center; mask-size: calc(min(1em, 100%) + 10 * var(--stroke)) min(1em, 100%), 100%',
  },
];
