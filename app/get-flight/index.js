// Lambda handler for GET /flights/{id}.
// Validates the path parameter via an event bus, then loads the flight from DynamoDB.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const makeBus = require('../lib/mini-bus');
const attachValidation = require('../lib/validation');

// v3 DocumentClient wrapper
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const bus = makeBus();
  attachValidation(bus);

  return await new Promise((resolve) => {
    // When validation succeeds for GET /flights/{id}
    bus.on('validated', async ({ domain, clean }) => {
      if (domain !== 'get') return;

      const result = await ddb.send(
        new GetCommand({
          TableName: TABLE,
          Key: { flightId: clean.flightId },
        })
      );

      if (!result.Item) {
        return resolve(resp(404, { message: 'Flight not found' }));
      }

      resolve(resp(200, result.Item));
    });

    // On validation failure, return 400 with error details
    bus.on('invalid', ({ errors }) =>
      resolve(resp(400, { message: 'Bad Request', errors }))
    );

    // Extract ID from path parameters and trigger validation
    const id = event?.pathParameters?.id;
    bus.emit('validate:get', { flightId: id });
  });
};

// Helper to build a JSON HTTP response
function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
