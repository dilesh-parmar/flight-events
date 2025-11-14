const test = require('node:test');
const assert = require('node:assert');

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const OLD_TABLE = process.env.TABLE_NAME;
process.env.TABLE_NAME = 'test-flights';

// Helper: fresh import of handler so it picks up mocks
function freshHandler() {
  delete require.cache[require.resolve('../index')]; // adjust if filename differs
  return require('../index').handler;
}

test('returns 400 when flightId is missing (validation failure)', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(GetCommand).resolves({});

  const handler = freshHandler();

  const event = {
    // no pathParameters.id
    pathParameters: {},
  };

  const res = await handler(event);

  assert.strictEqual(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.message, 'Bad Request');
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.includes('flightId required'));
  // no DB call expected
  assert.strictEqual(ddbMock.calls().length, 0);
});

test('returns 404 when flight is not found in DynamoDB', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(GetCommand).resolves({}); // no Item

  const handler = freshHandler();

  const event = {
    pathParameters: { id: 'AB123' },
  };

  const res = await handler(event);

  assert.strictEqual(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.message, 'Flight not found');

  // Check GetCommand input
  assert.strictEqual(ddbMock.calls().length, 1);
  const input = ddbMock.calls()[0].args[0].input;
  assert.strictEqual(input.TableName, 'test-flights');
  assert.deepStrictEqual(input.Key, { flightId: 'AB123' });
});

test('returns 200 and the flight item when found', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(GetCommand).resolves({
    Item: {
      flightId: 'CD456',
      destination: 'LHR',
      status: 'boarding',
      gate: 'A5',
    },
  });

  const handler = freshHandler();

  const event = {
    pathParameters: { id: 'CD456' },
  };

  const res = await handler(event);

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepStrictEqual(body, {
    flightId: 'CD456',
    destination: 'LHR',
    status: 'boarding',
    gate: 'A5',
  });

  assert.strictEqual(ddbMock.calls().length, 1);
  const input = ddbMock.calls()[0].args[0].input;
  assert.strictEqual(input.TableName, 'test-flights');
  assert.deepStrictEqual(input.Key, { flightId: 'CD456' });
});

test.after(() => {
  process.env.TABLE_NAME = OLD_TABLE;
});
