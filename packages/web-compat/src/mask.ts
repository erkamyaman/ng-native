import { markComponentHost, type Engine, type EngineNode, type Mask } from '@ng-native/fabric';
import type { DefaultTreeAdapterMap } from 'parse5';
import { watchCommits } from './commit-watch.ts';
import { settleLength, type LengthUnits } from './css-length.ts';
import { documentOf } from './document.ts';
import { styled } from './geometry.ts';
import { setMarkup } from './html.ts';
import { shapesOf, type Parsed } from './image.ts';
import { keptOwn } from './in-document.ts';
import { parseUrl } from './parse-url.ts';

/**
 * A box with a mask, as a library's sheet writes an icon: `background: currentColor` and
 * `mask-image: url(icon.svg)`, which a browser draws as the icon's shapes in the background's
 * colour. A view has no mask, so the engine hands the mask over (`Engine.drawMasks`) and paints no
 * background, and here the SVG is drawn in the box in that colour: each paint of it that is not
 * `none` is the colour, with its opacity kept, which is what a mask of it lets through. It is
 * placed by `mask-size` and `mask-position` as a browser places a mask image: `auto`, `contain`,
 * `cover` or a size of each side, and an edge as a length or a share of the room left. What is
 * past the box is not drawn.
 *
 * The SVG is a `data:` URL's, or fetched once an app from where the page's address resolves its
 * URL to, as an `<img>`'s is (see `image.ts`): an app's own icons are best given as `data:` URLs,
 * since a device has no server the page came from. What an app fetched is kept for its others
 * until it goes, and one that failed is asked for again.
 *
 * A `mask-size` with a token in it, `calc(min(1em, 100%) + 10 * var(--stroke)) 1em`, is settled
 * against the box as it is laid out, and again after each commit that resizes the box. A length
 * in the SVG of the viewport it is drawn in, `stroke-width="calc((100vw - 100vh) / 10)"` as Taiga
 * UI's icons write their stroke, is worked out for the size it is drawn at.
 *
 * ponytail: a box taken out of the page and put back is not settled again as it resizes;
 * a mask is drawn once, whatever `mask-repeat` says, and an image that is no SVG draws
 * nothing; each is said once in development. A box's children are not masked, only its
 * background.
 */
export function drawMasksOf(engine: Engine): () => void {
  const sized: Sized = { nodes: new Set(), unwatch: null };
  const stop = engine.drawMasks((node, mask) => drawMask(node, mask, engine, sized));
  return () => {
    stop();
    sized.unwatch?.();
    sized.nodes.clear();
    fetched.delete(engine);
  };
}

/**
 * The boxes whose mask's size is settled against the box, and what stops hearing the app's
 * commits for them: heard only while there is one, so an app with none commits as it would
 * without this package.
 */
interface Sized {
  readonly nodes: Set<EngineNode>;
  unwatch: (() => void) | null;
}

/** Note whether a box's mask is settled against it, hearing commits while any is. */
function noteSized(node: EngineNode, settles: boolean, sized: Sized, engine: Engine): void {
  if (settles) sized.nodes.add(node);
  else sized.nodes.delete(node);
  if (sized.nodes.size && !sized.unwatch) {
    // A size settled against the box is settled again once the box may have changed.
    sized.unwatch = watchCommits(engine, () => resize(sized, engine));
  } else if (!sized.nodes.size && sized.unwatch) {
    sized.unwatch();
    sized.unwatch = null;
  }
}

/** What each box with a mask holds of it: a box as big as it, and the drawing placed in that. */
interface Drawn {
  readonly holder: EngineNode;
  readonly mask: Mask;
  /** The SVG's markup, once it has arrived. */
  markup?: string;
  /** The size it was drawn at, settled against the box, where its size is CSS: see `settled`. */
  size?: string;
}

const drawn = new WeakMap<EngineNode, Drawn>();
/** Each app's SVGs by URL, fetched once: see `drawMasksOf`. */
const fetched = new WeakMap<Engine, Map<string, Promise<string | undefined>>>();

function drawMask(node: EngineNode, mask: Mask | null, engine: Engine, sized: Sized): void {
  const had = drawn.get(node);
  noteSized(node, mask !== null && cssOf(mask.size) !== undefined, sized, engine);
  if (!mask) {
    drawn.delete(node);
    if (had?.holder.parent === node) engine.removeChild(node, had.holder);
    return;
  }
  const entry: Drawn = { holder: had?.holder ?? held(node, engine), mask };
  drawn.set(node, entry);
  if (!isNoRepeat(mask.repeat)) warnOnce('repeat', 'a repeated mask-image is drawn once');
  const url = urlOf(mask.image);
  if (url === undefined) return undrawn(entry.holder, engine);
  void markupOf(url, engine).then((markup) => {
    // Another mask since, or none: this one is no longer what the box shows.
    if (drawn.get(node) !== entry) return;
    entry.markup = markup;
    if (markup === undefined || !draw(node, entry, engine)) {
      warnOnce(`image ${url}`, `a mask-image that is no SVG, or not found, draws nothing: ${url}`);
      undrawn(entry.holder, engine);
    }
    // Drawn after the commit that asked: a commit of its own, before the frame.
    if (engine.pending) engine.commit();
  });
}

/**
 * Draw again each mask whose size, settled against its box, is not what it was drawn at. A box
 * out of the page is let go, and the app's commits with the last.
 */
function resize(sized: Sized, engine: Engine): void {
  for (const node of [...sized.nodes]) {
    const entry = drawn.get(node);
    if (!inPage(node, engine)) noteSized(node, false, sized, engine);
    else if (entry?.markup) {
      const size = settled(entry.mask.size, node, engine);
      if (JSON.stringify(size) !== entry.size) draw(node, entry, engine);
    }
  }
  // Before the frame: this commit's views are drawn only once the task is over.
  if (engine.pending) engine.commit();
}

function inPage(node: EngineNode, engine: Engine): boolean {
  let at: EngineNode | null = node;
  while (at?.parent) at = at.parent;
  return at === engine.root;
}

/** The CSS a `mask-size` is kept as where a token is in it. */
const cssOf = (size: unknown): string | undefined =>
  typeof (size as { css?: unknown } | null)?.css === 'string'
    ? (size as { css: string }).css
    : undefined;

/**
 * A `mask-size` as it is drawn: one kept as CSS settled against the box, with the tokens where
 * it is used put in, each side in points or `auto`; the initial `auto` where it does not come to
 * one, as CSS makes a size invalid where it is used. Any other as it is.
 */
function settled(size: unknown, node: EngineNode, engine: Engine): unknown {
  const css = cssOf(size);
  if (css === undefined) return size;
  const text = withTokens(css, node, engine);
  const sides = text === undefined ? [] : splitSides(text);
  const box = engine.layoutOf(node);
  const em = fontSizeOf(node);
  const side = (written: string | undefined, of: number | undefined) =>
    written === undefined || written === 'auto'
      ? 'auto'
      : settleLength(written, { em, percent: of });
  const [x, y] = [side(sides[0], box?.width), side(sides[1], box?.height)];
  if (sides.length < 1 || sides.length > 2 || x === undefined || y === undefined) {
    return { x: 'auto', y: 'auto' };
  }
  return { x, y };
}

/** A value with each `var()` in it put in from the tokens at a node: undefined for one not set. */
function withTokens(text: string, node: EngineNode, engine: Engine): string | undefined {
  const innermost = /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/;
  let out = text;
  for (let found = innermost.exec(out); found; found = innermost.exec(out)) {
    const value = engine.token(found[1]!, node) ?? found[2]?.trim();
    if (value === undefined || value === '') return undefined;
    out = out.slice(0, found.index) + value + out.slice(found.index + found[0].length);
  }
  return out;
}

/** The sides of a size, at the spaces between them that are not inside brackets. */
function splitSides(text: string): string[] {
  const sides: string[] = [];
  let [depth, from] = [0, 0];
  for (let at = 0; at <= text.length; at++) {
    const char = text[at];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === undefined || /\s/.test(char)) && depth === 0) {
      if (at > from) sides.push(text.slice(from, at));
      from = at + 1;
    }
  }
  return sides;
}

/** The font size a box's `em` is of: its own, or the one it inherits. */
function fontSizeOf(node: EngineNode): number {
  for (let at: EngineNode | null = node; at; at = at.parent) {
    const size = styled(at, 'fontSize');
    if (typeof size === 'number') return size;
  }
  return 16;
}

/** A box as big as the masked one, first in it, behind what it holds, that the mask is drawn in. */
function held(node: EngineNode, engine: Engine): EngineNode {
  const holder = engine.createElement('view');
  keptOwn.add(holder);
  markComponentHost(holder);
  engine.setProp(holder, 'style', {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  // After a generated `::before`, which the engine keeps first.
  const first = node.childList[0];
  engine.insertBefore(
    node,
    holder,
    first?.tag === '::before' ? (node.childList[1] ?? null) : (first ?? null),
  );
  return holder;
}

function undrawn(holder: EngineNode, engine: Engine): void {
  for (const child of [...holder.childList]) engine.removeChild(holder, child);
}

/** The URL of a `url()`, quoted or not: undefined for any other image. */
function urlOf(image: string): string | undefined {
  const found = /^url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^"'\s)][^)]*?))\s*\)$/s.exec(
    image.trim(),
  );
  if (!found) return undefined;
  const written = found[1] ?? found[2] ?? found[3]!;
  return written.replace(/\\(.)/gs, '$1');
}

/** An SVG's markup, from a `data:` URL or fetched: undefined where it is not one. */
function markupOf(url: string, engine: Engine): Promise<string | undefined> {
  if (/^data:/i.test(url)) return Promise.resolve(fromData(url));
  const base = (documentOf(engine) as { baseURI?: string } | undefined)?.baseURI ?? 'about:blank';
  const resolved = parseUrl(url, base)?.href ?? url;
  let known = fetched.get(engine);
  if (!known) fetched.set(engine, (known = new Map()));
  const asked = known.get(resolved);
  if (asked) return asked;
  const fetching = (globalThis as { fetch?: typeof fetch }).fetch;
  const answer = Promise.resolve(fetching?.(resolved))
    .then((response) => (response?.ok ? response.text() : undefined))
    .catch(() => undefined);
  known.set(resolved, answer);
  // One that failed is asked for again, next time a mask names it.
  void answer.then((markup) => {
    if (markup === undefined && known.get(resolved) === answer) known.delete(resolved);
  });
  return answer;
}

/** The markup of a `data:` URL that is an SVG, percent-encoded or in base 64. */
function fromData(url: string): string | undefined {
  const comma = url.indexOf(',');
  if (comma < 0) return undefined;
  const head = url.slice(5, comma).toLowerCase();
  if (!head.startsWith('image/svg+xml')) return undefined;
  const body = url.slice(comma + 1);
  try {
    return head.split(';').includes('base64') ? decodeBase64(body) : decodeURIComponent(body);
  } catch {
    return undefined;
  }
}

function decodeBase64(text: string): string {
  const bytes = Uint8Array.from(atob(text.replace(/\s+/g, '')), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

type Element = DefaultTreeAdapterMap['element'];

/** The attributes of the drawing a mask is drawn from, which say what it is drawn in. */
const PAINTS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);
const UNPAINTED = /^(?:none|transparent)$/i;

/**
 * Each paint of a drawing in `colour`, its opacity kept: what a mask of the drawing lets the
 * colour through by. The drawing fills what nothing says the fill of, as SVG fills in black.
 */
function recolour(drawing: Parsed, colour: string): void {
  const element = drawing as Element;
  if (!element.attrs.some((attr) => attr.name === 'fill')) {
    element.attrs.push({ name: 'fill', value: colour });
  }
  const paint = (each: Parsed) => {
    for (const attr of (each as Element).attrs ?? []) {
      if (PAINTS.has(attr.name) && !UNPAINTED.test(attr.value.trim())) {
        if (!/^url\(/i.test(attr.value.trim())) attr.value = colour;
      } else if (attr.name === 'style') {
        attr.value = attr.value.replace(
          /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*([^;]*)/gi,
          (whole, name: string, value: string) =>
            UNPAINTED.test(value.trim()) || /^url\(/i.test(value.trim())
              ? whole
              : `${name}: ${colour}`,
        );
      }
    }
    for (const child of each.childNodes ?? []) if ('attrs' in child) paint(child as Parsed);
  };
  paint(drawing);
}

/** The size in points a drawing is drawn at, where that is known before it is laid out. */
function viewportOf(size: unknown, own: Own): LengthUnits | undefined {
  const { x, y } = (size ?? {}) as { x?: unknown; y?: unknown };
  const auto = sized(size, own);
  const [width, height] = [
    typeof x === 'number' ? x : auto['width'],
    typeof y === 'number' ? y : auto['height'],
  ];
  const ratio = auto['aspectRatio'] as number | undefined;
  const vw =
    typeof width === 'number'
      ? width
      : ratio && typeof height === 'number'
        ? height * ratio
        : undefined;
  const vh =
    typeof height === 'number' ? height : ratio && vw !== undefined ? vw / ratio : undefined;
  return vw === undefined || vh === undefined ? undefined : { vw, vh };
}

/** A length of the viewport in a drawing, worked out for the size it is drawn at. */
function inViewport(drawing: Parsed, viewport: LengthUnits): void {
  const settle = (each: Parsed) => {
    for (const attr of (each as Element).attrs ?? []) {
      if (!/\dv(?:w|h|min|max)\b/i.test(attr.value) || attr.name === 'style') continue;
      const value = settleLength(attr.value.trim(), viewport);
      if (value !== undefined) attr.value = String(value);
    }
    for (const child of each.childNodes ?? []) if ('attrs' in child) settle(child as Parsed);
  };
  settle(drawing);
}

/** A drawing's own size, `width` and `height` in points, and its shape, from its view box. */
interface Own {
  width?: number;
  height?: number;
  ratio?: number;
}

function ownSize(drawing: Parsed): Own {
  const attrs = Object.fromEntries(
    (drawing as Element).attrs.map((attr) => [attr.name, attr.value]),
  );
  const side = (name: string): number | undefined => {
    const found = /^\s*(\d*\.?\d+)(?:px)?\s*$/.exec(attrs[name] ?? '');
    return found ? Number(found[1]) : undefined;
  };
  const box = (attrs['viewBox'] ?? attrs['viewbox'] ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [width, height] = [side('width'), side('height')];
  const fromBox = box.length === 4 && box[2]! > 0 && box[3]! > 0 ? box[2]! / box[3]! : undefined;
  const ratio = width && height ? width / height : fromBox;
  return { width, height, ratio };
}

/** Fill its viewport, with a view box where it has only a size, so it scales with it. */
function filling(drawing: Parsed, own: Own, align: string | undefined): void {
  const attrs = (drawing as Element).attrs;
  const named = (name: string) =>
    attrs.find((attr) => attr.name.toLowerCase() === name.toLowerCase());
  if (!named('viewBox') && own.width && own.height) {
    attrs.push({ name: 'viewBox', value: `0 0 ${own.width} ${own.height}` });
  }
  for (const name of ['width', 'height']) {
    const attr = named(name);
    if (attr) attr.value = '100%';
    else attrs.push({ name, value: '100%' });
  }
  if (align) {
    const attr = named('preserveAspectRatio');
    if (attr) attr.value = align;
    else attrs.push({ name: 'preserveAspectRatio', value: align });
  }
}

/** Build the drawing in the box it is held in, placed as the mask says: false for no drawing. */
function draw(node: EngineNode, entry: Drawn, engine: Engine): boolean {
  const { holder, markup = '' } = entry;
  const size = settled(entry.mask.size, node, engine);
  entry.size = JSON.stringify(size);
  const mask = { ...entry.mask, size };
  const colour = typeof mask.color === 'string' ? mask.color : undefined;
  if (colour === undefined) {
    // No background, or a colour only the platform knows: there is nothing to draw it in.
    if (mask.color != null) warnOnce('colour', 'a mask over a platform colour draws nothing');
    undrawn(holder, engine);
    return true;
  }
  let own: Own = {};
  const shapes = shapesOf(markup, (drawing) => {
    own = ownSize(drawing);
    recolour(drawing, colour);
    const fit = fitOf(mask.size, own);
    filling(drawing, own, fit && aligned(mask, fit));
    const viewport = fit ? undefined : viewportOf(mask.size, own);
    if (viewport) inViewport(drawing, viewport);
  });
  if (shapes === undefined) return false;
  const image = holder.childList[0] ?? engine.createElement('view');
  if (!image.parent) {
    keptOwn.add(image);
    markComponentHost(image);
    engine.appendChild(holder, image);
  }
  engine.setProp(image, 'style', placed(mask, own));
  setMarkup(image, shapes, engine);
  const drawing = image.childList.find((child) => child.tag === 'svg');
  for (const child of [...image.childList]) if (child !== drawing) engine.removeChild(image, child);
  if (!drawing) return false;
  keptOwn.add(drawing);
  engine.setProp(drawing, 'style', { width: '100%', height: '100%', pointerEvents: 'none' });
  return true;
}

type Edge = number | string;

/** Where the drawing is in the box, and how big, as a browser places a mask image. */
function placed(mask: Mask, own: Own): Record<string, unknown> {
  const style: Record<string, unknown> = { position: 'absolute' };
  const transform: Record<string, string>[] = [];
  const fill = fitOf(mask.size, own) !== undefined;
  Object.assign(style, fill ? { width: '100%', height: '100%' } : sized(mask.size, own));
  const position = (mask.position ?? {}) as Record<string, Edge>;
  for (const [start, end, axis] of [
    ['left', 'right', 'translateX'],
    ['top', 'bottom', 'translateY'],
  ] as const) {
    // A box that fills it is aligned inside the drawing: see `aligned`.
    if (fill) {
      style[start] = 0;
      continue;
    }
    const from = position[end] !== undefined ? end : start;
    const edge = position[from] ?? '0%';
    style[from] = edge;
    // A share of the room left: of the box, less as much of the drawing.
    if (typeof edge === 'string' && edge.endsWith('%') && parseFloat(edge) !== 0) {
      const back = from === start ? -parseFloat(edge) : parseFloat(edge);
      transform.push({ [axis]: `${back}%` });
    }
  }
  if (transform.length) style['transform'] = transform;
  return style;
}

/**
 * Whether the drawing is fitted to the box, kept in its shape: `contain` and `cover`, and an
 * `auto` size of a drawing with a shape and no size, which is contained.
 */
function fitOf(size: unknown, own: Own): 'meet' | 'slice' | undefined {
  if (size === 'contain') return 'meet';
  if (size === 'cover') return 'slice';
  const { x, y } = (size ?? {}) as { x?: Edge; y?: Edge };
  const sizeless = own.width === undefined && own.height === undefined;
  return x === 'auto' && y === 'auto' && sizeless && own.ratio ? 'meet' : undefined;
}

/** The size of the drawing: `mask-size` against its own size, and the box's where it has none. */
function sized(size: unknown, own: Own): Record<string, unknown> {
  const { x = 'auto', y = 'auto' } = (size ?? {}) as { x?: Edge; y?: Edge };
  if (x !== 'auto' && y !== 'auto') return { width: x, height: y };
  if (x === 'auto' && y === 'auto') return ownSized(own);
  const [given, side, other, otherOwn] =
    x !== 'auto' ? [x, 'width', 'height', own.height] : [y, 'height', 'width', own.width];
  if (own.ratio) return { [side]: given, aspectRatio: own.ratio };
  return { [side]: given, [other]: otherOwn ?? '100%' };
}

/** An `auto` size: the drawing's own, a side of it and its shape, or the box's for neither. */
function ownSized({ width, height, ratio }: Own): Record<string, unknown> {
  if (width !== undefined && height !== undefined) return { width, height };
  if (width !== undefined && ratio) return { width, aspectRatio: ratio };
  if (height !== undefined && ratio) return { height, aspectRatio: ratio };
  return { width: '100%', height: '100%' };
}

/** How a drawing that fills the box is aligned in it, by where the mask is placed. */
function aligned(mask: Mask, fit: 'meet' | 'slice'): string {
  const position = (mask.position ?? {}) as Record<string, Edge>;
  const axis = (start: string, end: string, name: string): string => {
    const edge = position[end] !== undefined ? 100 - share(position[end]) : share(position[start]);
    return `${name}${edge <= 25 ? 'Min' : edge >= 75 ? 'Max' : 'Mid'}`;
  };
  return `${axis('left', 'right', 'x')}${axis('top', 'bottom', 'Y')} ${fit}`;
}

const share = (edge: Edge | undefined): number =>
  typeof edge === 'string' && edge.endsWith('%') ? parseFloat(edge) : 0;

function isNoRepeat(repeat: unknown): boolean {
  const { x, y } = (repeat ?? {}) as { x?: string; y?: string };
  return x === 'no-repeat' && y === 'no-repeat';
}

const told = new Set<string>();

/** Say what of a mask is not drawn as a browser draws it, once, in development. */
function warnOnce(key: string, message: string): void {
  if ((typeof __DEV__ !== 'undefined' && !__DEV__) || told.has(key)) return;
  told.add(key);
  console.warn(`[angular-native] ${message}.`);
}

declare const __DEV__: boolean | undefined;
