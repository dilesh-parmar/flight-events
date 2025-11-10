// Node >=18: built-in test runner + assert
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const attachLogger = require('../logger');

function withInterceptedConsoleLog(fn) {
  const original = console.log;
  const lines = [];
  console.log = (line) => { lines.push(String(line)); };
  return Promise.resolve()
    .then(() => fn(lines))
    .finally(() => { console.log = original; });
}

test('returns helpers: info, warn, error', () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);

  assert.strictEqual(typeof logger, 'object');
  assert.strictEqual(typeof logger.info, 'function');
  assert.strictEqual(typeof logger.warn, 'function');
  assert.strictEqual(typeof logger.error, 'function');
});

test('info() prints a structured JSON line with context', async () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);

  await withInterceptedConsoleLog(async (lines) => {
    logger.info('Server started', { port: 8080, env: 'test' });

    // Give the event loop a microtick to ensure the listener runs
    await Promise.resolve();

    assert.strictEqual(lines.length, 1, 'should print one line');
    const obj = JSON.parse(lines[0]);
    assert.deepStrictEqual(obj, { level: 'info', msg: 'Server started', port: 8080, env: 'test' });
  });
});

test('warn() and error() set correct levels', async () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);

  await withInterceptedConsoleLog(async (lines) => {
    logger.warn('Low disk', { freeGB: 1.2 });
    logger.error('Crash', { code: 'EFAIL' });

    await Promise.resolve();

    assert.strictEqual(lines.length, 2, 'should print two lines');

    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);

    assert.strictEqual(first.level, 'warn');
    assert.strictEqual(first.msg, 'Low disk');
    assert.strictEqual(first.freeGB, 1.2);

    assert.strictEqual(second.level, 'error');
    assert.strictEqual(second.msg, 'Crash');
    assert.strictEqual(second.code, 'EFAIL');
  });
});

test('defaults ctx to {} when omitted', async () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);

  await withInterceptedConsoleLog(async (lines) => {
    logger.info('No context');
    await Promise.resolve();

    const obj = JSON.parse(lines[0]);
    // Should only contain level and msg
    assert.deepStrictEqual(obj, { level: 'info', msg: 'No context' });
  });
});

test('does not mutate the provided context object', async () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);
  const ctx = { requestId: 'abc', retries: 0 };

  await withInterceptedConsoleLog(async () => {
    logger.info('Processing', ctx);
    await Promise.resolve();
    assert.deepStrictEqual(ctx, { requestId: 'abc', retries: 0 }, 'ctx should be unchanged');
  });
});

// Optional: If ctx contains keys that shadow level/msg, ctx wins (due to spread order)
// This test documents the current behavior, in case you want to change it later.
test('ctx keys can overwrite level/msg due to spread order', async () => {
  const bus = new EventEmitter();
  const logger = attachLogger(bus);

  await withInterceptedConsoleLog(async (lines) => {
    logger.info('Hello', { level: 'custom', msg: 'shadowed' });
    await Promise.resolve();

    const obj = JSON.parse(lines[0]);
    assert.deepStrictEqual(obj, { level: 'custom', msg: 'shadowed' });
  });
});
