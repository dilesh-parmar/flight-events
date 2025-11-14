const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const makeBus = require('./lib/mini-bus');
const attachLogger = require('./lib/logger');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const bus = makeBus();
  const log = attachLogger(bus);

  return await new Promise((resolve, reject) => {
    bus.on('prepared:put', async (params) => {
      try {
        await ddb.send(new PutCommand(params));
        
        log.info('ddb.put.ok', { pk: params.Item.flightId });
        resolve({ ok: true });
      } catch (e) {
        log.error('ddb.put.err', { error: e.message });
        reject(e);
      }
    });

    // prepare item from EB event
    const detail = event.detail || {};
    const type = event['detail-type'];
    if (!detail.flightId) return resolve({ ok: false, reason: 'missing flightId' });

    const item = {
      flightId: String(detail.flightId),
      destination: detail.destination ?? null,
      status: detail.status ?? null,
      gate: detail.gate ?? null,
      updatedAt: new Date().toISOString(),
      lastEventType: type
    };
    bus.emit('prepared:put', { TableName: TABLE, Item: item });
  });
};
