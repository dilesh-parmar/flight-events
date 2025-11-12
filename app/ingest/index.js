// Lambda entrypoint for flight event ingestion.
// Validates incoming requests, logs outcomes, and publishes valid events to AWS EventBridge.

const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');
const makeBus = require('../lib/mini-bus');
const attachLogger = require('../lib/logger');
const attachValidation = require('../lib/validation');

const eb = new EventBridgeClient({});
const BUS_NAME = process.env.EVENT_BUS_NAME;

exports.handler = async (event) => {
  const bus = makeBus();
  const log = attachLogger(bus);
  attachValidation(bus);

  try {
    // Parse JSON body (if provided)
    const body = event.body ? JSON.parse(event.body) : {};

    // When validation succeeds, publish to EventBridge and respond 202
    bus.on('validated', async ({ domain, clean }) => {
      if (domain !== 'ingest') return;
      await eb.send ( new PutEventsCommand({
        Entries: [{
          EventBusName: BUS_NAME,
          Source: clean.source,
          DetailType: clean.type,
          Time: new Date(),
          Detail: JSON.stringify(clean.data)
        }]
      }));
      log.info('event.published', { type: clean.type, flightId: clean.data.flightId });
      bus.emit('respond', 202, { message: 'Event accepted' });
    });

    // On validation failure, respond 400 with error details
    bus.on('invalid', ({ errors }) =>
      bus.emit('respond', 400, { message: 'Invalid payload', errors })
    );

    // Wait for validation → response event chain to complete
    return await new Promise((resolve) => {
      bus.on('respond', (code, bodyObj) => resolve(resp(code, bodyObj)));
      bus.emit('validate:ingest', body);
    });
  } catch (err) {
    // Handle unexpected errors
    return resp(500, { message: 'Server error', error: err.message });
  }
};

// Helper to build standard JSON HTTP responses
function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
