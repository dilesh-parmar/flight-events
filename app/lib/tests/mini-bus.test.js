// Node >=18: built-in test runner + assert
const test = require('node:test');
const assert = require('node:assert');
const createBus = require('../mini-bus');

test('emitAsync resolves when all listeners (sync + async) complete', async () => {
  const bus = createBus();
  const calls = [];

  bus.on('data', (x) => { calls.push(`sync:${x}`); return 1; });
  bus.on('data', async (x) => {
    await new Promise(r => setTimeout(r, 10));
    calls.push(`async:${x}`);
    return 2;
  });

  const results = await bus.emitAsync('data', 'hello');
  assert.deepStrictEqual(results.sort(), [1, 2]); // Promise.all returns listener return values
  assert.deepStrictEqual(calls, ['sync:hello', 'async:hello']);
});

test('emitAsync rejects if any listener throws or rejects', async () => {
  const bus = createBus();

  bus.on('boom', () => { throw new Error('kaboom'); });
  bus.on('boom', async () => 42); // still runs, but overall Promise should reject

  await assert.rejects(() => bus.emitAsync('boom'), /kaboom/);
});

test('each require() call returns a fresh MiniBus instance from the factory', () => {
  const bus1 = createBus();
  const bus2 = createBus();
  assert.notStrictEqual(bus1, bus2);
});

test('listeners are invoked asynchronously (microtask), even if they are sync', async () => {
  const bus = createBus();
  let flag = 'before';
  bus.on('tick', () => { flag = 'after'; });

  const p = bus.emitAsync('tick');
  // At this point, listener should not have run yet (scheduled via Promise.then)
  assert.strictEqual(flag, 'before');
  await p;
  assert.strictEqual(flag, 'after');
});
