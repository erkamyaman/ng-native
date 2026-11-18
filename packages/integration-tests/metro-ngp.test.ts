/**
 * `compilation: 'ngp'`: Angular's hybrid compiler (a Rust analysis pass and Angular's own template
 * compiler) in place of oxc, opted into from the Metro preset.
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { withAngularNative } = require('@ng-native/metro/config.cjs');
const { transformAngularWithNgp } = require('@ng-native/metro/angular-transform.cjs') as {
  transformAngularWithNgp(
    src: string,
    filename: string,
    options: Record<string, unknown>,
  ): Promise<{ code: string; dependencies: string[] }>;
};
const { closeNgp } = require('@ng-native/metro/ngp-compile.cjs') as { closeNgp(): Promise<void> };
const { documentOf } = require('@ng-native/metro/tsgo-checker.cjs') as {
  documentOf(
    filePath: string,
    source: string,
    tcb?: string,
  ): { text: string; sourceLineCount: number; range: unknown };
};

const EXPO = '/app/node_modules/@expo/metro-config/build/transform-worker/transform-worker.js';

interface Config {
  projectRoot: string;
  transformerPath?: string;
  transformer: { cacheVersion?: string; angularNativeCompilation?: Record<string, unknown> };
  resolver: { sourceExts: string[] };
  serializer: { getPolyfills(options: unknown): string[] };
}

const base = (): Config => ({
  projectRoot: '/app',
  transformerPath: EXPO,
  transformer: {},
  resolver: { sourceExts: ['ts', 'tsx', 'js'] },
  serializer: { getPolyfills: () => [] },
});

describe("the preset's compilation option", () => {
  it('compiles with oxc and records nothing when the option is not given', () => {
    const config = withAngularNative(base()) as Config;
    assert.equal(config.transformer.angularNativeCompilation, undefined);
    assert.doesNotMatch(config.transformer.cacheVersion!, /ngp-/);
  });

  it("records 'ngp' with type checking on, and puts the NGP build in Metro's cacheVersion", () => {
    const config = withAngularNative(base(), { compilation: 'ngp' }) as Config;
    assert.deepEqual(config.transformer.angularNativeCompilation, {
      compilation: 'ngp',
      typeCheck: true,
    });
    assert.match(config.transformer.cacheVersion!, /ngp-[0-9a-f]{12}-typecheck/);
  });

  it('turns type checking off with disableTypeChecking, under a different cacheVersion', () => {
    const checked = withAngularNative(base(), { compilation: 'ngp' }) as Config;
    const unchecked = withAngularNative(base(), {
      compilation: 'ngp',
      disableTypeChecking: true,
    }) as Config;
    assert.equal(unchecked.transformer.angularNativeCompilation!['typeCheck'], false);
    assert.notEqual(checked.transformer.cacheVersion, unchecked.transformer.cacheVersion);
    const oxc = withAngularNative(base(), { compilation: 'oxc' }) as Config;
    assert.notEqual(oxc.transformer.cacheVersion, checked.transformer.cacheVersion);
  });

  it('drops a recorded compilation when the option goes away', () => {
    const config = base();
    withAngularNative(config, { compilation: 'ngp' });
    withAngularNative(config, {});
    assert.equal(config.transformer.angularNativeCompilation, undefined);
  });

  it('refuses a compiler it does not know, and options of the wrong shape', () => {
    assert.throws(
      () => withAngularNative(base(), { compilation: 'ngtsc' }),
      /compilation must be 'oxc' or 'ngp'; got "ngtsc"/,
    );
    assert.throws(
      () => withAngularNative(base(), { compilation: 'ngp', disableTypeChecking: 'yes' }),
      /disableTypeChecking must be true or false/,
    );
    assert.throws(
      () => withAngularNative(base(), { compilation: 'ngp', tsconfig: '' }),
      /tsconfig must be a path/,
    );
  });

  it("refuses 'ngp' in front of a transform worker that is not Expo's, which it cannot reach", () => {
    const config = base();
    config.transformerPath = '/app/my-worker.js';
    assert.throws(
      () => withAngularNative(config, { compilation: 'ngp' }),
      /compilation: 'ngp' needs this preset in front of Expo's transform worker.*my-worker\.js/,
    );
  });

  it("carries the option to the babel transformer through the bundle's customTransformOptions", () => {
    const root = mkdtempSync(path.join(import.meta.dirname, '.ngp-worker-'));
    try {
      writeFileSync(
        path.join(root, 'transform-worker.cjs'),
        'module.exports = { transform: (c, p, f, d, options) => options };',
      );
      const ours = require('@ng-native/metro/transform-worker.cjs') as {
        transform(...args: unknown[]): { customTransformOptions?: Record<string, unknown> };
      };
      const run = (config: object) =>
        ours.transform(
          { angularNativeUpstreamTransformer: 'transform-worker.cjs', ...config },
          root,
          path.join(root, 'app.ts'),
          Buffer.from(''),
          { platform: 'ios', customTransformOptions: { dom: 'kept' } },
        ).customTransformOptions;
      assert.deepEqual(
        run({
          angularNativeCompilation: {
            compilation: 'ngp',
            typeCheck: false,
            tsconfig: 'tsconfig.app.json',
          },
        }),
        {
          dom: 'kept',
          angularNativeCompilation: 'ngp',
          angularNativeTypeCheck: false,
          angularNativeTsconfig: 'tsconfig.app.json',
        },
      );
      assert.deepEqual(run({}), { dom: 'kept' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the type-check document', () => {
  it("appends NGP's type-check blocks after the source, and only them", () => {
    const source = 'export class Hello {}\n';
    const tcb =
      "import * as i0 from './hello';\n" +
      'const unrelated = 1;\n' +
      'function _tcb1(this: i0.Hello) { /*tcb1*/ }\n';
    const document = documentOf('/app/hello.ts', source, tcb);
    assert.equal(document.sourceLineCount, 2);
    assert.ok(document.text.startsWith(source));
    assert.match(document.text, /import \* as i0 from '\.\/hello';\nfunction _tcb1/);
    assert.doesNotMatch(document.text, /unrelated/);
  });

  it('gives a relative import an extension, which a nodenext project needs', () => {
    const dir = mkdtempSync(path.join(import.meta.dirname, '.ngp-tcb-'));
    try {
      writeFileSync(path.join(dir, 'hello.ts'), 'export class Hello {}\n');
      const tcb =
        "import * as i0 from './hello';\n" +
        "import * as i1 from '@angular/core';\n" +
        "import * as i2 from './missing';\n" +
        'function _tcb1(this: i0.Hello) { /*tcb1*/ }\n';
      const { text } = documentOf(path.join(dir, 'hello.ts'), 'export class Hello {}\n', tcb);
      assert.match(text, /import \* as i0 from "\.\/hello\.js";/);
      assert.match(text, /import \* as i1 from '@angular\/core';/);
      assert.match(text, /import \* as i2 from '\.\/missing';/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is the source alone for a file with no type-check block', () => {
    const document = documentOf('/app/plain.ts', 'export const x = 1;\n');
    assert.equal(document.text, 'export const x = 1;\n');
    assert.equal(document.range, null);
  });
});

describe('a component compiled with NGP', () => {
  const root = mkdtempSync(path.join(import.meta.dirname, '.ngp-'));
  writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
      },
      include: ['*.ts'],
      angularCompilerOptions: { strictTemplates: true, typeCheckHostBindings: false },
    }),
  );
  const write = (name: string, text: string) => writeFileSync(path.join(root, name), text);
  const component = (name: string, decorator: string) =>
    `import { Component, NO_ERRORS_SCHEMA } from '@angular/core';\n` +
    `@Component({ selector: '${name}', schemas: [NO_ERRORS_SCHEMA], ${decorator} })\n` +
    `export class ${name[0]!.toUpperCase()}${name.slice(1)} { protected name = 'ngp'; }\n`;
  write('hello.ts', component('hello', "templateUrl: './hello.html'"));
  write('hello.html', '<text>hello {{ name }}</text>');
  write('inline.ts', component('inline', "template: '<text>{{ name }}</text>'"));

  const compile = (name: string, dev = false) =>
    transformAngularWithNgp(require('node:fs').readFileSync(path.join(root, name), 'utf8'), name, {
      projectRoot: root,
      platform: 'ios',
      dev,
      typeCheck: false,
    });

  after(async () => {
    await closeNgp();
    rmSync(root, { recursive: true, force: true });
  });

  it('compiles the decorator away into a component definition', async () => {
    const { code } = await compile('inline.ts');
    assert.match(code, /ɵɵdefineComponent/);
    assert.doesNotMatch(code, /@Component\(/);
  });

  it('leaves the class metadata TestBed reads out of a release build, as oxc does', async () => {
    const release = await compile('inline.ts');
    assert.doesNotMatch(release.code, /ɵsetClassMetadata/);
    const dev = await compile('inline.ts', true);
    assert.match(dev.code, /ɵsetClassMetadata/);
  });

  it('reads an external template and makes it an edge Metro watches', async () => {
    const { code, dependencies } = await compile('hello.ts');
    assert.deepEqual(dependencies, ['./hello.html']);
    assert.match(code, /import "\.\/hello\.html";/);
    assert.match(code, /ɵɵtextInterpolate1\('hello ',/);
  });

  it('compiles an edited template again in a dev build, rather than the one it analysed first', async () => {
    await compile('hello.ts', true);
    write('hello.html', '<text>goodbye {{ name }}</text>');
    const later = new Date(Date.now() + 5000);
    utimesSync(path.join(root, 'hello.html'), later, later);
    const { code } = await compile('hello.ts', true);
    assert.match(code, /ɵɵtextInterpolate1\('goodbye ',/);
    assert.doesNotMatch(code, /ɵɵtextInterpolate1\('hello ',/);
  });

  it('compiles a component file added after the first analysis', async () => {
    await compile('inline.ts', true);
    write('added.ts', component('added', "template: '<text>added</text>'"));
    const { code } = await compile('added.ts', true);
    assert.match(code, /ɵɵdefineComponent/);
    assert.match(code, /ɵɵtext\(1,\s*'added'\)/);
  });

  it('compiles the source Metro hands it, not the copy on disk', async () => {
    const { code } = await transformAngularWithNgp(
      component('inline', "template: '<text>from metro</text>'"),
      'inline.ts',
      { projectRoot: root, platform: 'ios', typeCheck: false },
    );
    assert.match(code, /ɵɵtext\(1,\s*'from metro'\)/);
  });

  it('analyses the source Metro hands it, so metadata only it has reaches the definition', async () => {
    const { code } = await transformAngularWithNgp(
      component('inline', "template: '<text>{{ name }}</text>'").replace(
        "selector: 'inline'",
        "selector: 'metro-inline'",
      ),
      'inline.ts',
      { projectRoot: root, platform: 'ios', typeCheck: false },
    );
    assert.match(code, /selectors: \[\['metro-inline'\]\]/);
  });

  it("goes through NGP from Metro's babel transformer when the bundle carries 'ngp'", async () => {
    const transformer = require('@ng-native/metro/transformer.cjs') as {
      transform(params: object): unknown;
    };
    const transform = (customTransformOptions: object) =>
      transformer.transform({
        filename: 'inline.ts',
        src: component('inline', "template: '<text>{{ name }}</text>'").replace(
          "selector: 'inline'",
          "selector: 'through-babel'",
        ),
        options: { dev: false, projectRoot: root, platform: 'ios', customTransformOptions },
        plugins: [],
      });
    const viaNgp = transform({ angularNativeCompilation: 'ngp', angularNativeTypeCheck: false });
    assert.ok(viaNgp instanceof Promise);
    const { ast } = (await viaNgp) as { ast: object };
    const generate = (require('@babel/generator') as { default: Function }).default;
    assert.match(generate(ast).code, /through-babel/);
    assert.equal(transform({}) instanceof Promise, false);
  });

  it('type-checks a template with tsgo, and places the error in the template file', async () => {
    write(
      'typed.ts',
      `import { Component, NO_ERRORS_SCHEMA } from '@angular/core';\n` +
        `@Component({ selector: 'typed', schemas: [NO_ERRORS_SCHEMA], templateUrl: './typed.html' })\n` +
        `export class Typed { protected count = 'one'; }\n`,
    );
    write('typed.html', '<view>\n  <text>{{ count.toFixed(2) }}</text>\n</view>\n');
    const typed = (dev: boolean) =>
      transformAngularWithNgp(
        require('node:fs').readFileSync(path.join(root, 'typed.ts'), 'utf8'),
        'typed.ts',
        { projectRoot: root, platform: 'ios', dev },
      );
    await assert.rejects(
      typed(false),
      /typed\.html:2:\d+ - error TS\d+: Property .toFixed. does not exist/,
    );
    write('typed.html', '<view>\n  <text>{{ count.length }}</text>\n</view>\n');
    const later = new Date(Date.now() + 10000);
    utimesSync(path.join(root, 'typed.html'), later, later);
    const { code } = await typed(true);
    assert.match(code, /ɵɵdefineComponent/);
  });

  it('type-checks a plain module of the app as well', async () => {
    write('plain.ts', 'export const total: number = "three";\n');
    await assert.rejects(
      transformAngularWithNgp('export const total: number = "three";\n', 'plain.ts', {
        projectRoot: root,
        platform: 'ios',
      }),
      /plain\.ts:1:14 - error TS2322/,
    );
    const { code } = await transformAngularWithNgp(
      'export const total: number = 3;\n',
      'plain.ts',
      { projectRoot: root, platform: 'ios', typeCheck: false },
    );
    assert.match(code, /total: number = 3/);
  });

  it("compiles with the tsconfig's angularCompilerOptions, not NGP's defaults", async () => {
    write(
      'host.ts',
      `import { Component } from '@angular/core';\n` +
        `@Component({ selector: 'x-map', template: '', host: { '[markers]': 'markers' } })\n` +
        `export class XMap { protected markers = []; }\n`,
    );
    const { code } = await compile('host.ts', true);
    assert.match(code, /ɵɵdomProperty\('markers'|ɵɵproperty\('markers'/);
  });

  it('fails the build on a template error, naming the file', async () => {
    write('broken.ts', component('broken', "template: '<text>{{ name | missing }}</text>'"));
    await assert.rejects(compile('broken.ts', true), /broken\.ts: .*'missing'/);
  });
});
