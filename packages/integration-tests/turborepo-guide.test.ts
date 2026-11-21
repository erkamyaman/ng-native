/**
 * The Turborepo guide, followed in a workspace laid out as it describes: the template as
 * `apps/mobile` with its Metro config unchanged, and the guide's library as `packages/ui`.
 *
 * The workspace's packages link this repository's installs, as pnpm links its store, so what is
 * checked is the guide's files and the Metro config's reach across the workspace, not npm.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const template = path.join(repo, 'template');
const read = (file: string) => readFileSync(path.join(repo, file), 'utf8');

const guide = read('apps/documentation/src/content/guide/turborepo.md');

/** The first `lang` code block after `marker` in the guide. */
function block(marker: string, lang: string): string {
  const at = guide.indexOf(marker);
  assert.notEqual(at, -1, `the guide no longer says ${JSON.stringify(marker)}`);
  const open = guide.indexOf('```' + lang + '\n', at);
  assert.notEqual(open, -1, `no ${lang} block after ${JSON.stringify(marker)}`);
  const start = open + lang.length + 4;
  return guide.slice(start, guide.indexOf('\n```', start) + 1);
}

interface Manifest {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
interface Task {
  dependsOn?: string[];
  inputs?: string[];
  outputs?: string[];
  cache?: boolean;
  persistent?: boolean;
}

const appScripts = (JSON.parse(block('## Add the app', 'json')) as Manifest).scripts ?? {};
const library = JSON.parse(block('## Share an Angular library', 'json')) as Manifest;
const greeting = block('## Share an Angular library', 'ts');
const index = block('`src/index.ts` exports it', 'ts');
const libraryTsconfig = block('`ngc` needs a `tsconfig.json`', 'json');
const appDiff = block('apps/mobile/src/app/app.ts', 'diff');
const turbo = JSON.parse(block('## Configure the tasks', 'json')) as {
  tasks: Record<string, Task>;
};
const templateManifest = JSON.parse(read('template/package.json')) as Manifest;

/** Applies a diff block of context, `-` and `+` lines, each found from where the last one was. */
function patch(text: string, diff: string): string {
  const lines = text.split('\n');
  let cursor = -1;
  for (const line of diff.split('\n')) {
    if (line === '' || line.startsWith('@@')) continue;
    const [mark, content] = [line[0], line.slice(1)];
    if (mark === '+') {
      lines.splice(++cursor, 0, content);
      continue;
    }
    const found = lines.indexOf(content, cursor + 1);
    assert.notEqual(found, -1, `the diff's line is not in the file: ${content}`);
    if (mark === '-') {
      lines.splice(found, 1);
      cursor = found - 1;
    } else cursor = found;
  }
  return lines.join('\n');
}

/** Links each of `names` into `dir`/node_modules from where `from` resolves it. */
function link(dir: string, from: string, names: Iterable<string>): void {
  for (const name of names) {
    const target = path.join(dir, 'node_modules', name);
    mkdirSync(path.dirname(target), { recursive: true });
    symlinkSync(path.join(from, 'node_modules', name), target);
  }
}

describe('the Turborepo guide', () => {
  it('caches the bundle where expo export writes it, rehashed when an ignored .env file changes', () => {
    const build = turbo.tasks['build'];
    assert.ok(build, 'turbo.json has no build task');
    assert.match(appScripts['build'] ?? '', /^expo export --output-dir dist$/);
    assert.deepEqual(build.outputs, ['dist/**']);
    // Turborepo hashes no file git ignores, and the template ignores `.env*.local`, which Expo
    // inlines into the bundle: without `.env*` a changed one replays the old bundle.
    assert.match(read('template/gitignore'), /^\.env\*\.local$/m);
    assert.deepEqual(build.inputs, ['$TURBO_DEFAULT$', '.env*']);
    assert.ok(templateManifest.scripts?.['typecheck'], 'the guide says the template has typecheck');
    assert.deepEqual(turbo.tasks['dev'], { cache: false, persistent: true });
  });

  it("gives the library the app's Angular, as a peer and to typecheck with", () => {
    for (const name of ['@angular/core', '@angular/compiler-cli', 'typescript']) {
      const app = templateManifest.dependencies?.[name] ?? templateManifest.devDependencies?.[name];
      assert.equal(library.devDependencies?.[name], app, `${name} differs from the app's`);
    }
    assert.equal(
      library.peerDependencies?.['@angular/core'],
      templateManifest.dependencies?.['@angular/core'],
    );
    for (const [name, version] of Object.entries(library.peerDependencies ?? {})) {
      assert.equal(library.devDependencies?.[name], version, `${name} is not the peer's version`);
    }
  });

  describe("expo export of the app, with the library's component in it", () => {
    let root = '';
    let bundle = '';
    // Real, because Metro watches the project under the path it is given and macOS links the temp
    // directory from somewhere else.
    before(() => {
      root = mkdtempSync(path.join(realpathSync(tmpdir()), 'turborepo-guide-'));
      writeFileSync(path.join(root, 'package.json'), '{ "name": "acme", "private": true }\n');
      writeFileSync(
        path.join(root, 'pnpm-workspace.yaml'),
        "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
      );
      writeFileSync(path.join(root, 'turbo.json'), JSON.stringify(turbo, null, 2));

      const ui = path.join(root, 'packages/ui');
      mkdirSync(path.join(ui, 'src'), { recursive: true });
      writeFileSync(path.join(ui, 'package.json'), JSON.stringify(library, null, 2));
      writeFileSync(path.join(ui, 'tsconfig.json'), libraryTsconfig);
      writeFileSync(path.join(ui, 'src/greeting.ts'), greeting);
      writeFileSync(path.join(ui, 'src/index.ts'), index);
      link(ui, template, Object.keys(library.devDependencies ?? {}));

      const app = path.join(root, 'apps/mobile');
      cpSync(template, app, {
        recursive: true,
        filter: (source) => path.basename(source) !== 'node_modules',
      });
      const appTs = path.join(app, 'src/app/app.ts');
      writeFileSync(appTs, patch(readFileSync(appTs, 'utf8'), appDiff));
      link(app, template, readdirSync(path.join(template, 'node_modules')));
      mkdirSync(path.join(app, 'node_modules/@acme'));
      symlinkSync(ui, path.join(app, 'node_modules', library.name ?? ''));

      const expoCli = path.join(
        path.dirname(
          createRequire(path.join(template, 'package.json')).resolve('expo/package.json'),
        ),
        'bin/cli',
      );
      const out = path.join(app, 'dist');
      execFileSync(
        process.execPath,
        [expoCli, 'export', '--platform', 'ios', '--output-dir', out, '--no-bytecode'],
        { cwd: app, stdio: 'pipe', env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } },
      );
      const dir = path.join(out, '_expo/static/js/ios');
      const [name] = readdirSync(dir).filter((file) => file.endsWith('.js'));
      assert.ok(name, `no ios bundle in ${dir}`);
      bundle = readFileSync(path.join(dir, name), 'utf8');
    });
    after(() => rmSync(root, { recursive: true, force: true }));

    it("watches the library from the template's Metro config, as Expo finds the workspace", () => {
      // An export bundles a linked package Metro does not watch, so it is the config that says the
      // dev server sees an edit to the library.
      const app = path.join(root, 'apps/mobile');
      const config = createRequire(path.join(app, 'package.json'))('./metro.config.js') as {
        watchFolders?: string[];
      };
      assert.ok(
        config.watchFolders?.includes(path.join(root, 'packages/ui')),
        `packages/ui is not watched: ${JSON.stringify(config.watchFolders)}`,
      );
    });

    it('compiles the component ahead of time, styles and all, and places it in the app', () => {
      assert.match(bundle, /selectors:\[\["acme-greeting"\]\],inputs:\{name:/);
      assert.match(bundle, /"Hello from acme-ui, "/);
      // `rebeccapurple`, compiled into the sheet the engine reads.
      assert.match(bundle, /"rgb\(102, 51, 153\)"/);
      assert.match(bundle, /element\(\d+,"acme-greeting"/);
    });

    it('has one @angular/core, the one the app and the library share', () => {
      // A message in @angular/core alone, so a second copy is a second match.
      assert.equal(bundle.split('is not an Angular component').length - 1, 1);
    });
  });
});
