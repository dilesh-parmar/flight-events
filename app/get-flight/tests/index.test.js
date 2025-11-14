const test = require('node:test');
const assert = require('node:assert');

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

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

test('returns 200 with all flights when no id parameter is provided', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(ScanCommand).resolves({
    Items: [
      { flightId: 'AB123', destination: 'LHR', status: 'boarding', gate: 'A5' },
      { flightId: 'CD456', destination: 'JFK', status: 'delayed', gate: 'B2' },
    ],
    Count: 2,
  });

  const handler = freshHandler();

  const event = {
    pathParameters: null, // No path parameters means GET /flights
  };

  const res = await handler(event);

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.count, 2);
  assert.strictEqual(body.flights.length, 2);
  assert.deepStrictEqual(body.flights[0], {
    flightId: 'AB123',
    destination: 'LHR',
    status: 'boarding',
    gate: 'A5',
  });
  assert.deepStrictEqual(body.flights[1], {
    flightId: 'CD456',
    destination: 'JFK',
    status: 'delayed',
    gate: 'B2',
  });

  // Check ScanCommand was called
  assert.strictEqual(ddbMock.calls().length, 1);
  const input = ddbMock.calls()[0].args[0].input;
  assert.strictEqual(input.TableName, 'test-flights');
});

test('returns empty array when no flights exist', async () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  ddbMock.reset().on(ScanCommand).resolves({
    Items: [],
    Count: 0,
  });

  const handler = freshHandler();

  const event = {
    pathParameters: null,
  };

  const res = await handler(event);

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.count, 0);
  assert.deepStrictEqual(body.flights, []);
});

test.after(() => {
  process.env.TABLE_NAME = OLD_TABLE;
});
