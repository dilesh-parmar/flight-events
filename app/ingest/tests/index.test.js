// Node >=18 built-in test runner
const test = require('node:test');
const assert = require('node:assert');

const { mockClient } = require('aws-sdk-client-mock');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

// Ensure bus name for tests
const OLD_BUS = process.env.EVENT_BUS_NAME;
process.env.EVENT_BUS_NAME = 'test-bus';

// Fresh import so each test gets a clean module graph
function freshHandler() {
  delete require.cache[require.resolve('../index')];
  return require('../index').handler;
}

// Build an API Gateway-like event
const apiEvent = (bodyObj) => ({ body: JSON.stringify(bodyObj) });

test('202 on valid payload; EventBridge receives normalized entry', async () => {
  const ebMock = mockClient(EventBridgeClient);
  ebMock.reset().on(PutEventsCommand).resolves({});

  const handler = freshHandler();

  const res = await handler(apiEvent({
    type: 'FLIGHT_UPDATED',
    data: { flightId: 123, destination: 'LHR' } // flightId should be coerced to string
  }));

  assert.strictEqual(res.statusCode, 202);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.message, 'Event accepted');

  // Assert EB call
  assert.strictEqual(ebMock.calls().length, 1);
  const input = ebMock.calls()[0].args[0].input;
  const e = input.Entries[0];

  assert.strictEqual(e.EventBusName, 'test-bus');
  assert.strictEqual(e.Source, 'app.flights'); // defaulted by validation
  assert.strictEqual(e.DetailType, 'FLIGHT_UPDATED');

  const detail = JSON.parse(e.Detail);
  assert.deepStrictEqual(detail, {
    flightId: '123',
    destination: 'LHR',
    status: null,
    gate: null,
  });
});

test('400 on validation error; no EventBridge call', async () => {
  const ebMock = mockClient(EventBridgeClient);
  ebMock.reset().on(PutEventsCommand).resolves({});

  const handler = freshHandler();

  // Missing type and data.flightId
  const res = await handler(apiEvent({ data: {} }));

  assert.strictEqual(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.message, 'Invalid payload');
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.includes('type required'));
  assert.ok(body.errors.includes('data.flightId required'));

  assert.strictEqual(ebMock.calls().length, 0);
});

test('500 on malformed JSON body; no EventBridge call', async () => {
  const ebMock = mockClient(EventBridgeClient);
  ebMock.reset().on(PutEventsCommand).resolves({});

  const handler = freshHandler();

  const res = await handler({ body: '{bad json' });

  assert.strictEqual(res.statusCode, 500);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.message, 'Server error');
  assert.match(body.error, /Unexpected token|JSON/);

  assert.strictEqual(ebMock.calls().length, 0);
});

test('respects provided source; passes through status/gate', async () => {
  const ebMock = mockClient(EventBridgeClient);
  ebMock.reset().on(PutEventsCommand).resolves({});

  const handler = freshHandler();

  const res = await handler(apiEvent({
    type: 'CREATE',
    source: 'api.gateway',
    data: { flightId: 'XY999', status: 'boarding', gate: 'A12' }
  }));

  assert.strictEqual(res.statusCode, 202);
  assert.strictEqual(ebMock.calls().length, 1);

  const input = ebMock.calls()[0].args[0].input;
  const e = input.Entries[0];

  assert.strictEqual(e.Source, 'api.gateway');
  assert.strictEqual(e.DetailType, 'CREATE');

  const detail = JSON.parse(e.Detail);
  assert.deepStrictEqual(detail, {
    flightId: 'XY999',
    destination: null,
    status: 'boarding',
    gate: 'A12',
  });
});

// Restore env after tests
test.after(() => { process.env.EVENT_BUS_NAME = OLD_BUS; });
