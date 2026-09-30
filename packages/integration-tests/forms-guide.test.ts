import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Type } from '@angular/core';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  type FakeFabricNode,
} from '@ng-native/testing';
import { compileSource } from './compile.ts';

const flatten = (n: FakeFabricNode[]): FakeFabricNode[] =>
  n.flatMap((x) => [x, ...flatten(x.children)]);

function submitExample(markdown: string): string {
  const blocks = [...markdown.matchAll(/```ts\n([\s\S]*?)\n```/g)].map((match) => match[1]!);
  const block = blocks.find((source) => source.includes('submit('));
  assert.ok(block, 'no ts block calling submit() in the forms guide');
  return block;
}

describe("the forms guide's submit example, extracted and compiled for real", () => {
  let SignUp: Type<unknown>;

  before(async () => {
    const markdown = readFileSync(
      fileURLToPath(
        new URL('../../apps/documentation/src/content/guide/forms.md', import.meta.url),
      ),
      'utf8',
    );
    const file = fileURLToPath(new URL('./fixtures/forms-guide.ts', import.meta.url));
    const out = fileURLToPath(new URL('./fixtures/forms-guide.generated.ts', import.meta.url));
    const mod = await compileSource(submitExample(markdown), file, out);
    SignUp = mod['SignUp'] as Type<unknown>;
  });

  afterEach(() => cleanup());

  async function signUp(name: string) {
    const { fabric } = await render(SignUp);
    const input = flatten(fabric.committed).find((node) => node.viewName === 'TextInput')!;
    if (name) await fireEvent.changeText(input, name);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
  }

  it('shows the errors and runs onInvalid for an empty name', async () => {
    await signUp('');
    await waitFor(() => screen.getByText('Fix the errors above, then try again.'));
    assert.ok(screen.queryByText(/error\(s\)/), 'submit() marked the field touched');
    assert.equal(screen.queryByText("You're signed up."), null);
  });

  it('signs up a valid name', async () => {
    await signUp('Grace');
    await waitFor(() => screen.getByText("You're signed up."));
    assert.equal(screen.queryByText(/error\(s\)/), null);
  });

  it("puts the server's error on the name field for a name that is taken", async () => {
    await signUp('ada');
    await waitFor(() => screen.getByText('1 error(s)'));
    assert.equal(screen.queryByText("You're signed up."), null);
    assert.equal(screen.queryByText('Fix the errors above, then try again.'), null);
  });
});
