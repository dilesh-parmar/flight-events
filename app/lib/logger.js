/**
 * Logging module using event-based bus to handle log events.
 * 
 * When a 'log' event is emitted on the bus, this module will:
 * - Format log messages as JSON string
 * - Print it to console
 * 
 * Provides logs with structure ('info', 'warn', 'error').
 * 
 * @param {EventEmitter} bus - Event bus to attach logger to
 * @returns {object} An object with logging helper methods:
 * - info/warn/error (msg, ctx)
 */
module.exports = (bus) => {
    // Attach listener for all 'log' events
    bus.on('log', (level, msg, ctx = {}) => {
        const line = JSON.stringify({ level, msg, ...ctx });
        // Print structured log to console
        console.log(line);
    });
    return {
        info: (msg, ctx) => bus.emit('log', 'info', msg, ctx),
        warn: (msg, ctx) => bus.emit('log', 'warn', msg, ctx),
        error: (msg, ctx) => bus.emit('log', 'error', msg, ctx),
    };
};