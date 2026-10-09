import { describe, expect, it } from 'vitest';
import { candidatesIn, tailwindCss } from './tailwind.ts';

describe('candidatesIn', () => {
  it('takes class attributes, class bindings and quoted strings, and not stylesheet words', () => {
    const source = [
      '<view class="flex-1 ios:pt-4" [class.bg-emerald-500]="done()">',
      "  <text [class]=\"done() ? 'line-through' : 'font-bold'\">x</text>",
      '</view>',
      'styles: `.row { display: grid; }`',
    ].join('\n');
    const candidates = candidatesIn({ 'app.ts': source });
    expect(candidates).toEqual(
      expect.arrayContaining(['bg-emerald-500', 'flex-1', 'font-bold', 'ios:pt-4', 'line-through']),
    );
    expect(candidates.includes('grid')).toBe(false);
    expect(candidates.includes("'font-bold'")).toBe(false);
  });
});

describe('tailwindCss', () => {
  it('writes the utilities the files use, with the native preset variants', async () => {
    const { css, used } = await tailwindCss({
      'app.ts': '<view class="flex-row android:gap-2 dark:bg-black pt-safe"></view>',
    });
    expect(used).toBe(true);
    expect(css).toContain('.flex-row');
    expect(css).toContain('.platform-android .android\\:gap-2');
    expect(css).toContain('.dark\\:bg-black:where(.dark, .dark *)');
    expect(css).toContain('var(--safe-area-inset-top, 0px)');
  });

  it('says when nothing in the files is a utility', async () => {
    expect((await tailwindCss({ 'app.ts': '<text class="title">Hi</text>' })).used).toBe(false);
  });
});
