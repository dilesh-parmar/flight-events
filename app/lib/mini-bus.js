
//Import the EventEmiiter class from core
const { promises } = require('dns');
const { EventEmitter } = require('events');
/**
 * MiniBus- Lightweight extension of EventEmitter
 * add async version of 'emit' method (emitAsync)
 * returns- promise which reolves once all listeners have finished
 */
class MiniBus extends EventEmitter {
    /**
     * 
     * @param {string} event - event name to emit
     * @param  {...any} args - Args to pass to each listener
     * @returns {Promise} promise that resolves when all listeners complete
     * each listener executer aysnchrously using promise.resolve().then(),
     * ensures synchronous listeners are non-blocking
     */
  emitAsync(event, ...args) {
    //register all listeners for this event
    const listeners=this.listeners(event);
    // execute all listeners aync..ly and collect promises
    //if listener returns promise it is awaited
    //if syncronous, wrapped in promise.resolve() to make aysnc
     const promises = listeners.map(listener =>
      Promise.resolve().then(() => listener(...args))
    );
    // wait for all listeners to complete in parrallel
    return Promise.all(promises);
  }
}
// export factory func returning new instance when called
module.exports = () => new MiniBus();
