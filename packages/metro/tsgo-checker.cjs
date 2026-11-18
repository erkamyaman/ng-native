/**
 * Type checking for `compilation: 'ngp'`, through TypeScript 7's language server (`tsgo --lsp
 * --stdio`). Each file goes in as an in-memory document: its source with NGP's type-check block
 * appended, so nothing is written to disk. Ported from `@analogjs/vite-plugin-angular`'s
 * `LspTypeChecker` (MIT).
 */
const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parse } = require('@babel/parser');

const TCB_TEMPLATE_SOURCES_PREFIX = 'ngp-tcb-template-sources:';
const IGNORED_TCB_CODES = new Set([6133, 6199, 2695, 7006]);
const TCB_IMPORT_ALIAS = /^(?:_tcb_)?_?i\d+$/;
const TCB_LOCAL_NAME = /^(?:_tcb|_ctor|_pipe)\d+$/;
const SPAN_COMMENT = /^(\d+),(\d+)$/;
const LSP_ARGS = ['--lsp', '--stdio'];

/** @param {string} code */
function parseTs(code) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators'],
    errorRecovery: true,
  });
}

/** @param {any} node @param {(node: any) => void} visit */
function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key in node) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = node[key];
    if (value && typeof value === 'object') walk(value, visit);
  }
}

/** @param {any} statement */
function declaredName(statement) {
  if (statement.type === 'VariableDeclaration') return statement.declarations[0]?.id?.name;
  if (statement.type === 'FunctionDeclaration' || statement.type === 'TSDeclareFunction') {
    return statement.id?.name;
  }
  return undefined;
}

/** @param {any} statement */
function isTcbImport(statement) {
  const namespace = statement.type === 'ImportDeclaration' && statement.specifiers[0];
  return (
    namespace?.type === 'ImportNamespaceSpecifier' && TCB_IMPORT_ALIAS.test(namespace.local.name)
  );
}

/** @param {string} tcb */
function splitTcb(tcb) {
  if (!tcb.includes('/*tcb')) return null;
  let ast;
  try {
    ast = parseTs(tcb);
  } catch {
    return null;
  }
  if (ast.errors?.length) return null;
  /** @type {{ imports: any[], blocks: any[], templateSources: Record<string, any> }} */
  const parts = { imports: [], blocks: [], templateSources: {} };
  const footer = (ast.comments ?? []).find((comment) =>
    comment.value.startsWith(TCB_TEMPLATE_SOURCES_PREFIX),
  );
  if (footer) {
    parts.templateSources = JSON.parse(footer.value.slice(TCB_TEMPLATE_SOURCES_PREFIX.length));
  }
  for (const statement of ast.program.body) {
    if (TCB_LOCAL_NAME.test(declaredName(statement) ?? '')) parts.blocks.push(statement);
    else if (isTcbImport(statement)) parts.imports.push(statement);
  }
  return parts.blocks.length ? parts : null;
}

/** @param {string} tcb @param {any} node @param {string} directory */
function withExtension(tcb, node, directory) {
  const statement = tcb.slice(node.start, node.end);
  const specifier = node.source.value;
  if (!/^\.\.?\//.test(specifier) || path.extname(specifier)) return statement;
  const extension = ['.ts', '.tsx', '.mts'].find((candidate) =>
    existsSync(path.resolve(directory, specifier + candidate)),
  );
  if (!extension) return statement;
  const js = { '.ts': '.js', '.tsx': '.jsx', '.mts': '.mjs' }[extension];
  const at = node.source.start - node.start;
  return (
    statement.slice(0, at) +
    JSON.stringify(specifier + js) +
    statement.slice(node.source.end - node.start)
  );
}

/**
 * @param {string} filePath
 * @param {string} source
 * @param {string | undefined} tcb
 */
function documentOf(filePath, source, tcb) {
  const lines = source.split('\n');
  const sourceLineCount = lines.length;
  if (!tcb) return { text: source, sourceLineCount, lines, range: null };
  const parts = splitTcb(tcb);
  const suffix = parts
    ? [
        ...parts.imports.map((node) => withExtension(tcb, node, path.dirname(filePath))),
        ...parts.blocks.map((node) => tcb.slice(node.start, node.end)),
      ].join('\n')
    : tcb;
  lines.push(...suffix.split('\n'));
  return {
    text: lines.join('\n'),
    sourceLineCount,
    lines,
    range: {
      startLine: sourceLineCount,
      endLine: lines.length,
      filePath,
      source,
      templateSources: parts?.templateSources ?? {},
    },
  };
}

/** @param {string} text @param {number} offset */
function lineAndCharacter(text, offset) {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length, character: before[before.length - 1].length + 1 };
}

/**
 * @param {string} text
 * @param {number} at
 * @param {Map<number, any>} commentsByStart
 */
function trailingSpan(text, at, commentsByStart) {
  for (;;) {
    while (at < text.length && /\s/.test(text[at])) at++;
    const comment = commentsByStart.get(at);
    if (!comment) return null;
    const span = SPAN_COMMENT.exec(comment.value);
    if (span) return { start: Number(span[1]), end: Number(span[2]) };
    at = comment.end;
  }
}

/**
 * @param {NonNullable<ReturnType<typeof documentOf>['range']>} range
 * @param {string[]} lines
 * @param {{ line: number, character: number }} position
 */
function templateLocation(range, lines, position) {
  const chunk = lines.slice(range.startLine, range.endLine).join('\n');
  let offset = position.character;
  for (let i = range.startLine; i < position.line; i++) offset += lines[i].length + 1;
  const found = tcbAt(chunk, offset);
  if (!found) return null;
  const templateSource = range.templateSources[found.id];
  const file = templateSource?.templateFile ?? range.filePath;
  let content = range.source;
  if (templateSource?.templateFile) {
    try {
      content = readFileSync(templateSource.templateFile, 'utf8');
    } catch {
      return null;
    }
  }
  const start = templateSource?.templateExpression?.start ?? found.span.start;
  return { file, ...lineAndCharacter(content, start) };
}

/**
 * @param {string} chunk
 * @param {number} offset
 */
function tcbAt(chunk, offset) {
  let ast;
  try {
    ast = parseTs(chunk);
  } catch {
    return null;
  }
  /** @type {Map<number, any>} */
  const commentsByStart = new Map(
    (ast.comments ?? []).map((comment) => [/** @type {number} */ (comment.start), comment]),
  );
  /** @type {any[]} */
  const ancestors = [];
  walk(ast.program.body, (node) => {
    if (node.start <= offset && offset < node.end) ancestors.push(node);
  });
  const tcbFunction = ancestors.find(
    (node) => node.type === 'FunctionDeclaration' && /_tcb\d+$/.test(node.id?.name ?? ''),
  );
  let span = null;
  for (let i = ancestors.length - 1; i >= 0 && !span; i--) {
    span = trailingSpan(chunk, ancestors[i].end, commentsByStart);
  }
  if (!tcbFunction || !span) return null;
  const id = /** @type {RegExpExecArray} */ (/(tcb\d+)$/.exec(tcbFunction.id.name))[1];
  return { id, span };
}

/** @param {string} tsconfig */
function resolveTsgo(tsconfig) {
  const fromEnvironment = process.env['TSNATIVE_BINARY_PATH'];
  if (fromEnvironment) return fromEnvironment;
  const ext = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    {
      parent: 'typescript/package.json',
      platform: `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
      bin: `tsc${ext}`,
    },
    {
      parent: '@typescript/native-preview/package.json',
      platform: `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
      bin: `tsgo${ext}`,
    },
  ];
  for (const base of [path.dirname(tsconfig), __dirname]) {
    for (const candidate of candidates) {
      try {
        const parent = require.resolve(candidate.parent, { paths: [base] });
        const platform = require.resolve(candidate.platform, { paths: [path.dirname(parent)] });
        return path.resolve(path.dirname(platform), 'lib', candidate.bin);
      } catch {
        // The next candidate.
      }
    }
  }
  throw new Error(
    "[angular-native] compilation: 'ngp' type-checks with TypeScript 7: install typescript@^7, " +
      '@typescript/native-preview, or set TSNATIVE_BINARY_PATH. disableTypeChecking: true turns ' +
      'the check off.',
  );
}

class TsgoChecker {
  /** @param {string} tsconfig */
  constructor(tsconfig) {
    const cwd = path.dirname(tsconfig);
    this.seq = 1;
    /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
    this.pending = new Map();
    /** @type {Map<string, number>} */
    this.versions = new Map();
    this.buffer = Buffer.alloc(0);
    /** @type {Error | undefined} */
    this.exitError = undefined;
    this.proc = spawn(resolveTsgo(tsconfig), LSP_ARGS, { cwd, stdio: ['pipe', 'pipe', 'ignore'] });
    this.proc.stdout?.on('data', (chunk) => this.onData(chunk));
    /** @param {Error} error */
    const fail = (error) => {
      this.exitError ??= error;
      for (const { reject } of this.pending.values()) reject(this.exitError);
      this.pending.clear();
    };
    this.proc.on('error', fail);
    this.proc.stdin?.on('error', fail);
    this.proc.on('exit', (code) => fail(new Error(`type checker exited with code ${code}`)));
    this.proc.unref();
    const rootUri = pathToFileURL(cwd).href;
    this.ready = this.request('initialize', {
      processId: process.pid,
      rootUri,
      capabilities: { textDocument: { diagnostic: {} } },
      workspaceFolders: [{ uri: rootUri, name: 'root' }],
    }).then(() => this.notify('initialized', {}));
    this.ready.catch(() => {});
  }

  /** @param {Buffer} chunk */
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const length = /Content-Length: (\d+)/i.exec(
        this.buffer.subarray(0, headerEnd).toString('utf8'),
      );
      if (!length) return;
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + Number(length[1]);
      if (this.buffer.length < bodyEnd) return;
      const message = JSON.parse(this.buffer.subarray(bodyStart, bodyEnd).toString('utf8'));
      this.buffer = this.buffer.subarray(bodyEnd);
      if (message.id !== undefined && message.method !== undefined) {
        this.send({ jsonrpc: '2.0', id: message.id, result: null });
      } else if (message.id !== undefined && this.pending.has(message.id)) {
        const entry = /** @type {NonNullable<ReturnType<typeof this.pending.get>>} */ (
          this.pending.get(message.id)
        );
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
      }
    }
  }

  /** @param {object} payload */
  send(payload) {
    const json = JSON.stringify(payload);
    this.proc.stdin?.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
  }

  /** @param {string} method @param {object} params */
  notify(method, params) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  /** @param {string} method @param {object} params @returns {Promise<any>} */
  request(method, params) {
    if (this.exitError) return Promise.reject(this.exitError);
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  /** @param {string} filePath @param {string} text */
  updateDocument(filePath, text) {
    const uri = pathToFileURL(path.resolve(filePath)).href;
    if (!this.versions.has(uri)) {
      this.versions.set(uri, 1);
      this.notify('textDocument/didOpen', {
        textDocument: { uri, languageId: 'typescript', version: 1, text },
      });
      return;
    }
    const version = /** @type {number} */ (this.versions.get(uri)) + 1;
    this.versions.set(uri, version);
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  /** @param {{ filePath: string, updateType: 'Created' | 'Deleted' | 'Changed' }[]} changes */
  filesChanged(changes) {
    const types = { Created: 1, Changed: 2, Deleted: 3 };
    const closed = [];
    const watched = [];
    for (const { filePath, updateType } of changes) {
      const uri = pathToFileURL(path.resolve(filePath)).href;
      if (this.versions.delete(uri)) closed.push(uri);
      watched.push({ uri, type: types[updateType] });
    }
    this.ready.then(
      () => {
        for (const uri of closed) this.notify('textDocument/didClose', { textDocument: { uri } });
        this.notify('workspace/didChangeWatchedFiles', { changes: watched });
      },
      () => {},
    );
  }

  /**
   * @param {string} filePath
   * @param {string} source
   * @param {string} [tcb]
   * @returns {Promise<string[]>}
   */
  async check(filePath, source, tcb) {
    await this.ready;
    const document = documentOf(filePath, source, tcb);
    this.updateDocument(filePath, document.text);
    const diagnostics = await this.request('textDocument/diagnostic', {
      textDocument: { uri: pathToFileURL(path.resolve(filePath)).href },
    });
    /** @type {string[]} */
    const errors = [];
    for (const item of diagnostics?.items ?? []) {
      if (item.severity !== 1) continue;
      const line = item.range.start.line;
      if (line < document.sourceLineCount) {
        errors.push(
          `${filePath}:${line + 1}:${item.range.start.character + 1} - error TS${item.code}: ` +
            item.message,
        );
        continue;
      }
      if (IGNORED_TCB_CODES.has(Number(item.code))) continue;
      if (document.lines[line]?.includes('/*D:ignore*/')) continue;
      const location =
        document.range && templateLocation(document.range, document.lines, item.range.start);
      errors.push(
        location
          ? `${location.file}:${location.line}:${location.character} - error TS${item.code}: ` +
              item.message
          : `${filePath} (template): error TS${item.code}: ${item.message}`,
      );
    }
    return errors;
  }

  close() {
    this.proc.kill();
  }
}

module.exports = { TsgoChecker, resolveTsgo, documentOf, splitTcb };
