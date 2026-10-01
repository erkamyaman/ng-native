import { expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { boot, settle, waitFor } from './boot.ts';
import { PressOrderApp } from '../src/press-order-app.ts';

it('presses a button the first time, after another button was pressed', async () => {
  const { byId, componentRef } = boot(PressOrderApp);
  await settle();
  const app = componentRef.instance as PressOrderApp;

  await userEvent.click(byId('other'));
  await waitFor(() => app.others() === 1, 'the other button to press');
  await userEvent.click(byId('counter'));
  await settle();

  expect(app.count()).toBe(1);
});
