
/**
 * logging module using event-based bus to handle log events
 * 
 * when a 'log' event is emitted on the but this module will:-
 * -formats log messages as JSON string 
 * --prints it to console
 * 
 * provides logs with structure ('Info', 'warn', 'error,)
 * 
 * @param {EventEmitter} bus -Event bus to attach logger to
 * @returns {object} an object with logging helper methods:
 * -info/warn/error (msg, ctx)
 */
module.exports= (bus) => {
    //attach listerner for all 'log'events
    bus.on('log', (level,msg,ctx={}) => {
        const line =JSON.stringify({ level,msg,...ctx});
        // print structured log to console
        console.log(line);
    });
    return {
        info: (msg,ctx)=> bus.emit('log','info',msg,ctx),
        warn: (msg, ctx) => bus.emit('log', 'warn', msg, ctx),
        error: (msg, ctx) => bus.emit('log', 'error', msg, ctx),
    };
};