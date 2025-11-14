// Import the EventEmitter class from core
const { EventEmitter } = require('events');

/**
 * MiniBus - Lightweight extension of EventEmitter.
 * Adds async version of 'emit' method (emitAsync).
 * Returns a promise which resolves once all listeners have finished.
 */
class MiniBus extends EventEmitter {
    /**
     * @param {string} event - Event name to emit
     * @param {...any} args - Args to pass to each listener
     * @returns {Promise} Promise that resolves when all listeners complete.
     * Each listener executes asynchronously using Promise.resolve().then(),
     * ensuring synchronous listeners are non-blocking.
     */
  emitAsync(event, ...args) {
    // Register all listeners for this event
    const listeners = this.listeners(event);
    // Execute all listeners asynchronously and collect promises.
    // If listener returns promise it is awaited.
    // If synchronous, wrapped in Promise.resolve() to make async.
     const promises = listeners.map(listener =>
      Promise.resolve().then(() => listener(...args))
    );
    // Wait for all listeners to complete in parallel
    return Promise.all(promises);
  }
}

// Export factory function returning new instance when called
module.exports = () => new MiniBus();
