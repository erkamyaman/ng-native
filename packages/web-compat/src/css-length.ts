/**
 * A length as CSS writes one, worked out to points once what its units are of is known: `px`,
 * `em`, `rem`, a percentage, the viewport's `vw`, `vh`, `vmin` and `vmax`, and a bare number, in
 * `calc()`, `min()`, `max()` and `clamp()` with `+`, `-`, `*`, `/` and brackets. What a mask's
 * size, `calc(min(1em, 100%) + 10 * var(--stroke))`, comes to once its tokens are put in, and
 * what an SVG's `stroke-width="calc((100vw - 100vh) / 10)"` comes to in the viewport it is drawn
 * in. Undefined for anything else, which CSS would make invalid too.
 */
export interface LengthUnits {
  readonly em?: number;
  readonly rem?: number;
  /** What a percentage is of. */
  readonly percent?: number;
  readonly vw?: number;
  readonly vh?: number;
}

/** A length's value in points, or a bare number's, by the units it is written in. */
export function settleLength(text: string, units: LengthUnits): number | undefined {
  const tokens = text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?[a-z%]*|[a-z-]+\(|[-+*/(),]/gi);
  if (!tokens || tokens.join('').length !== text.replace(/\s+/g, '').length) return undefined;
  const cursor = { tokens, at: 0, units };
  const value = sum(cursor);
  return value !== undefined && cursor.at === tokens.length && Number.isFinite(value)
    ? value
    : undefined;
}

interface Cursor {
  readonly tokens: readonly string[];
  at: number;
  readonly units: LengthUnits;
}

function sum(cursor: Cursor): number | undefined {
  let total = product(cursor);
  while (total !== undefined && /^[-+]$/.test(cursor.tokens[cursor.at] ?? '')) {
    const sign = cursor.tokens[cursor.at++] === '+' ? 1 : -1;
    const next = product(cursor);
    total = next === undefined ? undefined : total + sign * next;
  }
  return total;
}

function product(cursor: Cursor): number | undefined {
  let total = term(cursor);
  while (total !== undefined && /^[*/]$/.test(cursor.tokens[cursor.at] ?? '')) {
    const times = cursor.tokens[cursor.at++] === '*';
    const next = term(cursor);
    total = next === undefined ? undefined : times ? total * next : total / next;
  }
  return total;
}

function term(cursor: Cursor): number | undefined {
  const token = cursor.tokens[cursor.at++];
  if (token === undefined) return undefined;
  if (token === '(' || /^calc\($/i.test(token)) return closed(cursor, sum(cursor));
  const call = /^(min|max|clamp)\($/i.exec(token)?.[1]?.toLowerCase();
  if (call) return compared(cursor, call);
  return measured(token, cursor.units);
}

/** What is in brackets, once its `)` is read. */
function closed(cursor: Cursor, value: number | undefined): number | undefined {
  return cursor.tokens[cursor.at++] === ')' ? value : undefined;
}

function compared(cursor: Cursor, call: string): number | undefined {
  const values: (number | undefined)[] = [sum(cursor)];
  while (cursor.tokens[cursor.at] === ',') {
    cursor.at++;
    values.push(sum(cursor));
  }
  if (closed(cursor, 0) === undefined || values.some((each) => each === undefined))
    return undefined;
  const all = values as number[];
  if (call === 'min') return Math.min(...all);
  if (call === 'max') return Math.max(...all);
  return all.length === 3 ? Math.max(all[0]!, Math.min(all[1]!, all[2]!)) : undefined;
}

/** One number with its unit, in points. */
function measured(token: string, units: LengthUnits): number | undefined {
  const found = /^(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)([a-z%]*)$/i.exec(token);
  if (!found) return undefined;
  const value = Number(found[1]);
  const per: Record<string, number | undefined> = {
    '': 1,
    px: 1,
    em: units.em,
    rem: units.rem ?? 16,
    '%': units.percent === undefined ? undefined : units.percent / 100,
    vw: units.vw === undefined ? undefined : units.vw / 100,
    vh: units.vh === undefined ? undefined : units.vh / 100,
    vmin:
      units.vw === undefined || units.vh === undefined
        ? undefined
        : Math.min(units.vw, units.vh) / 100,
    vmax:
      units.vw === undefined || units.vh === undefined
        ? undefined
        : Math.max(units.vw, units.vh) / 100,
  };
  const scale = per[found[2]!.toLowerCase()];
  return scale === undefined ? undefined : value * scale;
}
