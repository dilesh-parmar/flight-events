module.exports = (bus) => { 
  // Validate payloads for POST /events (flight ingestion)
  bus.on('validate:ingest', (payload) => {
    const errors = [];

    // Basic shape checks
    if (!payload || typeof payload !== 'object') errors.push('body must be JSON object');
    if (!payload?.type) errors.push('type required');
    if (!payload?.data?.flightId) errors.push('data.flightId required');

    // If validation fails, emit an 'invalid' event
    if (errors.length) return bus.emit('invalid', { domain: 'ingest', errors });

    // Normalise valid data to a consistent structure
    const clean = {
      type: String(payload.type),
      source: payload.source || 'app.flights',
      data: {
        flightId: String(payload.data.flightId),
        destination: payload.data.destination ?? null,
        status: payload.data.status ?? null,
        gate: payload.data.gate ?? null
      }
    };

    // Emit a 'validated' event with cleaned data
    bus.emit('validated', { domain: 'ingest', clean });
  });

  // Validate query parameters for GET /flights/{id}
  bus.on('validate:get', (params) => {
    if (!params?.flightId)
      return bus.emit('invalid', { domain: 'get', errors: ['flightId required'] });

    // Emit validated result with cleaned flightId
    bus.emit('validated', { domain: 'get', clean: { flightId: String(params.flightId) } });
  });
};
