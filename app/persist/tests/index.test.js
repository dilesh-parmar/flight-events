// Node >=18 built-in test runner
const test = require('node:test');
const assert = require('node:assert');

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const OLD_TABLE = process.env.TABLE_NAME;
process.env.TABLE_NAME = 'test-table';

// Fresh import so each test has a clean module graph
function freshHandler() {
  delete require.cache[require.resolve('../index')]; // adjust path if needed
  return require('../index').handler;
}

// Build an EventBridge-like event (what your Lambda receives from EB rules)
const ebEvent = (detailType, detailObj) => ({
  'detail-type': detailType,
  detail: detailObj,
});

test('returns {ok:false, reason:"missing flightId"} when detail.flightId absent', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(PutCommand).resolves({});

  const handler = freshHandler();

  const res = await handler(ebEvent('FLIGHT_UPDATED', { destination: 'LHR' }));
  assert.deepStrictEqual(res, { ok: false, reason: 'missing flightId' });

  // No write attempted
  assert.strictEqual(ddbMock.calls().length, 0);
});

test('successful put: coerces types, defaults nulls, includes lastEventType; returns {ok:true}', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(PutCommand).resolves({});

  const handler = freshHandler();

  const res = await handler(ebEvent('FLIGHT_UPDATED', {
    flightId: 123,           // should be coerced to string
    destination: 'LHR',      // kept
    // status, gate omitted -> null
  }));

  assert.deepStrictEqual(res, { ok: true });

  // Verify DynamoDB PutCommand input
  assert.strictEqual(ddbMock.calls().length, 1);
  const input = ddbMock.calls()[0].args[0].input; // command input
  assert.strictEqual(input.TableName, 'test-table');

  const item = input.Item;
  assert.strictEqual(item.flightId, '123');
  assert.strictEqual(item.destination, 'LHR');
  assert.strictEqual(item.status, null);
  assert.strictEqual(item.gate, null);
  assert.strictEqual(item.lastEventType, 'FLIGHT_UPDATED');

  // updatedAt should be an ISO timestamp string
  assert.strictEqual(typeof item.updatedAt, 'string');
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.updatedAt));
});

test('uses provided status/gate and preserves source detail', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(PutCommand).resolves({});

  const handler = freshHandler();

  const res = await handler(ebEvent('CREATE', {
    flightId: 'XY999',
    destination: null,      // should remain null (explicit null)
    status: 'boarding',
    gate: 'A12',
  }));

  assert.deepStrictEqual(res, { ok: true });
  const input = ddbMock.calls()[0].args[0].input;
  const item = input.Item;

  assert.strictEqual(item.flightId, 'XY999');
  assert.strictEqual(item.destination, null);
  assert.strictEqual(item.status, 'boarding');
  assert.strictEqual(item.gate, 'A12');
  assert.strictEqual(item.lastEventType, 'CREATE');
});

test('bubbles up DynamoDB error (promise rejects) and attempted put is visible in calls()', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(PutCommand).rejects(new Error('DDBServiceError'));

  const handler = freshHandler();

  await assert.rejects(
    () => handler(ebEvent('UPDATE', { flightId: 'ERR1' })),
    /DDBServiceError/
  );

  // Ensure we attempted a put
  assert.strictEqual(ddbMock.calls().length, 1);
  const input = ddbMock.calls()[0].args[0].input;
  assert.strictEqual(input.TableName, 'test-table');
  assert.strictEqual(input.Item.flightId, 'ERR1');
});

// Restore env
test.after(() => { process.env.TABLE_NAME = OLD_TABLE; });
