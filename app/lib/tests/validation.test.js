// Node >=18
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const attachValidators = require('../validation');

// Helper: set up a bus with capture listeners
function setup() {
  const bus = new EventEmitter();
  const invalid = [];
  const validated = [];

  // capture emitted results
  bus.on('invalid', (payload) => invalid.push(payload));
  bus.on('validated', (payload) => validated.push(payload));

  // attach code under test
  attachValidators(bus);

  return { bus, invalid, validated };
}

test('ingest: rejects non-object payload', () => {
  const { bus, invalid, validated } = setup();

  bus.emit('validate:ingest', undefined);

  assert.strictEqual(validated.length, 0);
  assert.strictEqual(invalid.length, 1);
  assert.strictEqual(invalid[0].domain, 'ingest');
  assert.ok(invalid[0].errors.includes('body must be JSON object'));
});

test('ingest: requires type', () => {
  const { bus, invalid } = setup();

  bus.emit('validate:ingest', { data: { flightId: 'AB123' } });

  assert.strictEqual(invalid.length, 1);
  assert.ok(invalid[0].errors.includes('type required'));
});

test('ingest: requires data.flightId', () => {
  const { bus, invalid } = setup();

  bus.emit('validate:ingest', { type: 'update', data: {} });

  assert.strictEqual(invalid.length, 1);
  assert.ok(invalid[0].errors.includes('data.flightId required'));
});

test('ingest: normalises valid payload and defaults fields', () => {
  const { bus, invalid, validated } = setup();

  bus.emit('validate:ingest', {
    type: 'FLIGHT_UPDATED',
    // source omitted -> should default to 'app.flights'
    data: {
      flightId: 123,                // coerced to string
      destination: 'LHR',           // kept
      // status, gate omitted -> default null
    }
  });

  assert.strictEqual(invalid.length, 0);
  assert.strictEqual(validated.length, 1);

  const res = validated[0];
  assert.strictEqual(res.domain, 'ingest');

  assert.deepStrictEqual(res.clean, {
    type: 'FLIGHT_UPDATED',
    source: 'app.flights',
    data: {
      flightId: '123',
      destination: 'LHR',
      status: null,
      gate: null
    }
  });
});

test('ingest: preserves provided source and nullish fields', () => {
  const { bus, validated } = setup();

  bus.emit('validate:ingest', {
    type: 'CREATE',
    source: 'api.gateway',
    data: {
      flightId: 'XY999',
      destination: null,   // stays null via ?? null
      status: 'boarding',
      gate: undefined      // becomes null via ?? null
    }
  });

  const res = validated[validated.length - 1];
  assert.deepStrictEqual(res.clean, {
    type: 'CREATE',
    source: 'api.gateway',
    data: {
      flightId: 'XY999',
      destination: null,
      status: 'boarding',
      gate: null
    }
  });
});

test('get: requires flightId', () => {
  const { bus, invalid, validated } = setup();

  bus.emit('validate:get', {}); // missing flightId

  assert.strictEqual(validated.length, 0);
  assert.strictEqual(invalid.length, 1);
  assert.strictEqual(invalid[0].domain, 'get');
  assert.deepStrictEqual(invalid[0].errors, ['flightId required']);
});

test('get: normalizes flightId to string', () => {
  const { bus, invalid, validated } = setup();

  bus.emit('validate:get', { flightId: 42 });

  assert.strictEqual(invalid.length, 0);
  assert.strictEqual(validated.length, 1);
  assert.strictEqual(validated[0].domain, 'get');
  assert.deepStrictEqual(validated[0].clean, { flightId: '42' });
});
