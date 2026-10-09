/**
 * `pagingEnabled` on a `<scroll-view>`, which a device settles on a whole page once the user lets
 * go. Where a scroll comes to rest is a question about real scrolling, which jsdom does not do.
 */
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { boot, settle, waitFor, type Booted } from './boot.ts';
import { PagingApp } from '../src/paging-app.ts';

async function scene(paging: boolean | undefined = true): Promise<Booted> {
  await page.viewport(1200, 800);
  const booted = boot(PagingApp);
  (booted.componentRef.instance as PagingApp).paging.set(paging);
  booted.applicationRef.tick();
  await settle();
  return booted;
}

const PAGE = 200;

describe('pagingEnabled', () => {
  it('settles a horizontal scroll view on a whole page', async () => {
    const { byId } = await scene();
    const row = byId('row');
    await userEvent.wheel(row, { delta: { x: 130 } });
    await waitFor(() => row.scrollLeft > 0 && row.scrollLeft % PAGE === 0, 'a whole page', 1500);
    await settle();
    expect(row.scrollLeft % PAGE).toBe(0);
  });

  it('settles a vertical scroll view on a whole page', async () => {
    const { byId } = await scene();
    const column = byId('column');
    await userEvent.wheel(column, { delta: { y: 130 } });
    await waitFor(
      () => column.scrollTop > 0 && column.scrollTop % PAGE === 0,
      'a whole page',
      1500,
    );
    await settle();
    expect(column.scrollTop % PAGE).toBe(0);
  });

  it('scrolls freely with pagingEnabled false', async () => {
    const { byId } = await scene(false);
    const row = byId('row');
    expect(getComputedStyle(row).scrollSnapType).toBe('none');
    await userEvent.wheel(row, { delta: { x: 130 } });
    await waitFor(() => row.scrollLeft === 130, 'the wheel distance', 1500);
  });

  it('scrolls freely again once pagingEnabled goes away', async () => {
    const { byId, componentRef, applicationRef } = await scene();
    (componentRef.instance as PagingApp).paging.set(undefined);
    applicationRef.tick();
    await settle();
    const column = byId('column');
    expect(getComputedStyle(column).scrollSnapType).toBe('none');
    await userEvent.wheel(column, { delta: { y: 130 } });
    await waitFor(() => column.scrollTop === 130, 'the wheel distance', 1500);
  });
});
