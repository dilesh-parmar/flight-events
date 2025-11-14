// Lambda handler for GET /flights/{id} and GET /flights.
// Validates the path parameter via an event bus, then loads the flight(s) from DynamoDB.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const makeBus = require('./lib/mini-bus');
const attachValidation = require('./lib/validation');

// v3 DocumentClient wrapper
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const bus = makeBus();
  attachValidation(bus);

  // Check if this is a request for all flights (GET /flights)
  // When pathParameters is null or undefined, it's a list request
  // When pathParameters exists, we expect an id parameter for single flight lookup
  if (!event?.pathParameters) {
    return await getAllFlights();
  }
  
  const id = event.pathParameters.id;

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
    bus.emit('validate:get', { flightId: id });
  });
};

// Get all flights from DynamoDB
async function getAllFlights() {
  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
      })
    );

    return resp(200, {
      flights: result.Items || [],
      count: result.Count || 0,
    });
  } catch (error) {
    return resp(500, { 
      message: 'Error retrieving flights', 
      error: error.message 
    });
  }
}

// Helper to build a JSON HTTP response
function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
