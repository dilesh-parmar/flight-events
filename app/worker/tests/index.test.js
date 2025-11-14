// app/worker/tests/index.test.js
const test = require('node:test');
const assert = require('node:assert');

const handler = require('../index').handler;

// Helper to intercept console.log so we can assert on logger output
function withInterceptedConsole(fn) {
  const original = console.log;
  const lines = [];
  console.log = (line) => { lines.push(String(line)); };

  return Promise.resolve()
    .then(() => fn(lines))
    .finally(() => {
      console.log = original;
    });
}

// Build a fake SQS-like event
const sqsEvent = (msgs) => ({
  Records: msgs.map((m) => ({
    body: JSON.stringify(m),
  })),
});

test('processes all records and logs worker.process for each message', async () => {
  const msgs = [
    { flightId: 'AB123', status: 'boarding' },
    { flightId: 'CD456', status: 'delayed' },
  ];

  await withInterceptedConsole(async (lines) => {
    const event = sqsEvent(msgs);

    const res = await handler(event);
    assert.deepStrictEqual(res, { processed: msgs.length });

    // One log line per record
    assert.strictEqual(lines.length, msgs.length);

    // Each line should be JSON from the logger
    lines.forEach((line, idx) => {
      const obj = JSON.parse(line);
      // logger formats as { level, msg, ...ctx }, and ctx={ msg }
      // so final "msg" is the original payload object
      assert.strictEqual(obj.level, 'info');
      assert.deepStrictEqual(obj.msg, msgs[idx]);
    });
  });
});

test('returns processed:0 when there are no records and logs nothing', async () => {
  await withInterceptedConsole(async (lines) => {
    const event = { Records: [] };

    const res = await handler(event);
    assert.deepStrictEqual(res, { processed: 0 });

    // No records => no logs
    assert.strictEqual(lines.length, 0);
  });
});

test('handles missing body gracefully by defaulting to {}', async () => {
  await withInterceptedConsole(async (lines) => {
    const event = {
      Records: [
        { body: '' },          // falsy -> '{}' in JSON.parse(rec.body || '{}')
        { /* no body at all */ },
      ],
    };

    const res = await handler(event);
    assert.deepStrictEqual(res, { processed: 2 });

    // Two records -> two log lines
    assert.strictEqual(lines.length, 2);

    lines.forEach((line) => {
      const obj = JSON.parse(line);
      assert.strictEqual(obj.level, 'info');
      // parsed {} -> logged as msg: {}
      assert.deepStrictEqual(obj.msg, {});
    });
  });
});
