/**
 * `compilation: 'ngp'`: Angular's hybrid compiler, a Rust analysis pass (`ng_analyze`) in front of
 * Angular's own TypeScript template compiler, run per file the way the oxc path is.
 */
const { readFileSync, realpathSync, statSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { TsgoChecker } = require('./tsgo-checker.cjs');

const BUNDLED = path.join(__dirname, 'ngp');
const ERROR = 1;

/**
 * @typedef {{
 *   projectRoot?: string,
 *   tsconfig?: string,
 *   typeCheck?: boolean,
 *   dev?: boolean,
 * }} NgpOptions
 */

/** @param {string} projectRoot */
function angularVersion(projectRoot) {
  const manifest = require.resolve('@angular/core/package.json', {
    paths: [projectRoot, __dirname],
  });
  const [major, minor] = JSON.parse(readFileSync(manifest, 'utf8')).version.split('.').map(Number);
  return major * 100 + minor;
}

/** @param {string} projectRoot */
async function loadNgp(projectRoot) {
  const nativeBinding = process.env['ANGULAR_NATIVE_NGP_NATIVE_BINDING'];
  let modulePath = process.env['ANGULAR_NATIVE_NGP_COMPILER'];
  if (!modulePath) {
    try {
      modulePath = require.resolve('@angular/ngp', { paths: [projectRoot] });
    } catch {
      if (angularVersion(projectRoot) < 2202) {
        throw new Error("[angular-native] compilation: 'ngp' requires Angular v22.2 or later.");
      }
      return {
        api: await import(pathToFileURL(path.join(BUNDLED, 'api.mjs')).href),
        analyzerOptions: nativeBinding
          ? { nativeBinding }
          : { backend: 'wasm', wasmBinding: path.join(BUNDLED, 'ng_analyze.cjs') },
      };
    }
  }
  return {
    api: await import(pathToFileURL(path.resolve(projectRoot, modulePath)).href),
    analyzerOptions: nativeBinding ? { nativeBinding } : {},
  };
}

/** @param {string} file */
function modified(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

/** @param {string} file */
function keyOf(file) {
  try {
    return realpathSync.native(file);
  } catch {
    return path.resolve(file);
  }
}

/** @param {unknown} text @returns {string} */
function messageOf(text) {
  if (typeof text === 'string') return text;
  const chain = /** @type {{ messageText?: unknown, next?: unknown[] }} */ (text ?? {});
  return [messageOf(chain.messageText), ...(chain.next ?? []).map(messageOf)]
    .filter(Boolean)
    .join('\n  ');
}

class Session {
  /**
   * @param {any} api
   * @param {any} analyzer
   * @param {any} compiler
   * @param {string} tsconfig
   */
  constructor(api, analyzer, compiler, tsconfig) {
    this.api = api;
    this.analyzer = analyzer;
    this.compiler = compiler;
    this.tsconfig = tsconfig;
    /** @type {Map<string, { filePath: string, mtime: number | null }>} */
    this.seen = new Map();
    /** @type {TsgoChecker | undefined} */
    this.checker = undefined;
    /** @type {Promise<unknown>} */
    this.queue = Promise.resolve();
  }

  /** @param {any} file */
  track(file) {
    if (!file?.filePath) return;
    this.see(file.filePath);
    for (const meta of file.classes ?? []) {
      const component = meta.component;
      if (!component) continue;
      const resources = [component.templateUrl, ...(component.styleUrls ?? [])];
      for (const resource of resources) {
        if (resource?.resolvedPath) this.see(resource.resolvedPath);
      }
    }
  }

  /** @param {string} filePath */
  see(filePath) {
    this.seen.set(keyOf(filePath), { filePath, mtime: modified(filePath) });
  }

  /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
  serial(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  /** @param {string} file @param {string} src */
  async sync(file, src) {
    /** @type {{ filePath: string, updateType: 'Created' | 'Deleted' | 'Changed' }[]} */
    const changes = [];
    for (const [key, known] of this.seen) {
      const now = modified(known.filePath);
      if (now === known.mtime) continue;
      if (now === null) this.seen.delete(key);
      else known.mtime = now;
      changes.push({
        filePath: known.filePath,
        updateType: now === null ? 'Deleted' : 'Changed',
      });
    }
    if (changes.length) await this.compiler.invalidateFiles(changes);
    if (!this.seen.has(keyOf(file))) {
      this.see(file);
      changes.push({ filePath: file, updateType: 'Created' });
    }
    if (changes.length) this.checker?.filesChanged(changes);
    if ((await this.analyzer.getFileContent(file)) !== src) {
      await this.compiler.updateFileContent([{ filePath: file, content: src }]);
    }
  }

  close() {
    this.checker?.close();
    this.checker = undefined;
    this.analyzer?.close?.();
  }
}

/** @type {Map<string, { session: Promise<Session>, signature: string }>} */
const sessions = new Map();

/** @param {string} tsconfig */
function tsconfigSignature(tsconfig) {
  const { tsconfigChain } = require('./config.cjs');
  return tsconfigChain(tsconfig)
    .map((file) => `${file}:${modified(file)}`)
    .join('|');
}

/** @param {NgpOptions} options */
function tsconfigOf(options) {
  const root = options.projectRoot ?? process.cwd();
  return path.resolve(root, options.tsconfig ?? 'tsconfig.json');
}

/** @param {string} projectRoot @param {string} tsconfig @returns {Promise<Record<string, any>>} */
async function angularCompilerOptions(projectRoot, tsconfig) {
  const cli = require.resolve('@angular/compiler-cli', { paths: [projectRoot, __dirname] });
  const { readConfiguration } = await import(pathToFileURL(cli).href);
  return readConfiguration(tsconfig).options;
}

/** @param {NgpOptions} options @returns {Promise<Session>} */
function sessionFor(options) {
  const tsconfig = tsconfigOf(options);
  const dev = options.dev === true;
  const key = `${tsconfig}\0${dev}`;
  const signature = tsconfigSignature(tsconfig);
  const open = sessions.get(key);
  if (open?.signature === signature) return open.session;
  if (open) {
    sessions.delete(key);
    open.session.then(
      (stale) => stale.queue.then(() => stale.close()),
      () => {},
    );
  }
  const session = (async () => {
    const projectRoot = options.projectRoot ?? process.cwd();
    const { api, analyzerOptions } = await loadNgp(projectRoot);
    const angular = await angularCompilerOptions(projectRoot, tsconfig);
    const analyzer = await api.createAnalyzer(tsconfig, { ...analyzerOptions, enableHmr: false });
    const compiler = new api.HybridCompiler(analyzer, {
      ...angular,
      optimize: true,
      enableHmr: false,
      supportTestBed: dev,
      supportJitMode: dev,
      tsconfigPath: tsconfig,
      tcbConfig: api.buildTypeCheckingConfig(angular),
    });
    const created = new Session(api, analyzer, compiler, tsconfig);
    for await (const chunk of compiler.analyzeOptimized()) {
      for (const file of chunk.files) created.track(file);
    }
    return created;
  })();
  session.catch(() => {
    if (sessions.get(key)?.session === session) sessions.delete(key);
  });
  sessions.set(key, { session, signature });
  return session;
}

/** @param {Session} session @param {string} file @param {string} source @param {string} [tcb] */
async function checkTypes(session, file, source, tcb) {
  session.checker ??= new TsgoChecker(session.tsconfig);
  const errors = await session.checker.check(file, source, tcb);
  if (errors.length) throw new Error(errors.join('\n'));
}

/**
 * @param {string} src
 * @param {string} filename
 * @param {NgpOptions} options
 * @returns {Promise<{ code: string, map: string } | null>}
 */
async function compileWithNgp(src, filename, options) {
  const session = await sessionFor(options);
  const file = path.resolve(options.projectRoot ?? process.cwd(), filename);
  return session.serial(async () => {
    await session.sync(file, src);
    const metadata = await session.analyzer.getMetadataForFile(file);
    if (!metadata) return null;
    session.track(metadata);
    const result = await session.compiler.processFile(file, src, metadata);
    const errors = [...(metadata.diagnostics ?? []), ...(result.diagnostics ?? [])].filter(
      (diagnostic) => diagnostic.category === ERROR,
    );
    if (errors.length) {
      throw new Error(
        `${filename}: ${errors.map((error) => messageOf(error.messageText)).join('\n')}`,
      );
    }
    if (options.typeCheck !== false) await checkTypes(session, file, src, result.tcb?.code);
    return {
      code: result.magicString.toString(),
      map: result.magicString
        .generateMap({ source: filename, includeContent: true, hires: true })
        .toString(),
    };
  });
}

/** @param {string} src @param {string} filename @param {NgpOptions} options */
async function typeCheckWithNgp(src, filename, options) {
  if (options.typeCheck === false) return;
  const session = await sessionFor(options);
  const file = path.resolve(options.projectRoot ?? process.cwd(), filename);
  await session.serial(async () => {
    await session.sync(file, src);
    await checkTypes(session, file, src);
  });
}

async function closeNgp() {
  const open = [...sessions.values()];
  sessions.clear();
  for (const { session } of open) (await session.catch(() => null))?.close();
}

module.exports = { compileWithNgp, typeCheckWithNgp, closeNgp, loadNgp, messageOf };
