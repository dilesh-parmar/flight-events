// Worker Lambda that processes messages from an event source (e.g. SQS)
// using a MiniBus event bus and a structured logger.

const makeBus = require('./lib/mini-bus');
const attachLogger = require('./lib/logger');

exports.handler = async (event) => {
  // Create an in-memory event bus and attach a logger to it
  const bus = makeBus();
  const log = attachLogger(bus);

  // Handler for our internal 'handle' event
  bus.on('handle', async (msg) => {
    // Simulate some downstream processing work
    log.info('worker.process', { msg });
  });

  // Process each incoming record one by one
  for (const rec of event.Records) {
    const msg = JSON.parse(rec.body || '{}');
    // emitAsync lets us await all listeners for 'handle'
    await bus.emitAsync('handle', msg);
  }

  // Return a simple summary of how many records were processed
  return { processed: event.Records.length };
};
