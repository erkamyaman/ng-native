/**
 * `numberOfLines` on a `<text>`, which a device cuts to that many lines and ends in an ellipsis.
 * jsdom lays nothing out, so how many lines a paragraph takes is only answerable here.
 */
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { boot, settle, type Booted } from './boot.ts';
import { NumberOfLinesApp } from '../src/number-of-lines-app.ts';

async function scene(): Promise<Booted & { app: NumberOfLinesApp }> {
  await page.viewport(1200, 800);
  const booted = boot(NumberOfLinesApp);
  await settle();
  return { ...booted, app: booted.componentRef.instance as NumberOfLinesApp };
}

const height = (el: Element): number => el.getBoundingClientRect().height;

describe('numberOfLines', () => {
  it('cuts a long text to one line, with an ellipsis', async () => {
    const { byId } = await scene();
    expect(height(byId('long'))).toBe(height(byId('short')));
    expect(getComputedStyle(byId('long')).overflow).toBe('hidden');
    expect(byId('long').scrollHeight).toBeGreaterThan(height(byId('short')) * 2);
  });

  it('cuts to two lines when the prop changes to 2', async () => {
    const { byId, app, applicationRef } = await scene();
    app.lines.set(2);
    applicationRef.tick();
    await settle();
    expect(height(byId('long'))).toBe(height(byId('short')) * 2);
  });

  it('lets the text wrap onto every line again when the prop goes away', async () => {
    const { byId, app, applicationRef } = await scene();
    app.lines.set(undefined);
    applicationRef.tick();
    await settle();
    const long = getComputedStyle(byId('long'));
    expect(height(byId('long'))).toBeGreaterThan(height(byId('short')) * 2);
    expect(long.display).toBe('block');
    expect(long.overflow).toBe('visible');
    expect(long.webkitLineClamp).toBe('none');
  });

  it('takes 0 as no limit, as a device does', async () => {
    const { byId, app, applicationRef } = await scene();
    app.lines.set(0);
    applicationRef.tick();
    await settle();
    expect(height(byId('long'))).toBeGreaterThan(height(byId('short')) * 2);
  });

  it('keeps a nested text inline, where a device ignores its numberOfLines', async () => {
    const { byId } = await scene();
    expect(getComputedStyle(byId('nested')).display).toBe('inline');
  });

  it("ends the last line without an ellipsis for ellipsizeMode 'clip'", async () => {
    const { byId, app, applicationRef } = await scene();
    app.mode.set('clip');
    applicationRef.tick();
    await settle();
    expect(height(byId('long'))).toBe(height(byId('short')));
    expect(getComputedStyle(byId('long')).webkitLineClamp).toBe('none');

    app.mode.set(undefined);
    applicationRef.tick();
    await settle();
    expect(getComputedStyle(byId('long')).webkitLineClamp).toBe('1');
    expect(getComputedStyle(byId('long')).maxHeight).toBe('none');
  });
});
