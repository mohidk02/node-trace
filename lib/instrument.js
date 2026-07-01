"use strict";

const context = require("./context"); // to know current trace ID + who the parent call is
const collector = require("./collector"); // to actually write the enter/exit events

function wrapFunction(fn, meta) {
  // fn = the real function, meta = { file, fnName } for labeling
  const wrapped = function (...args) {
    // this REPLACES fn wherever it's exported; args = whatever was passed in
    const traceId = context.currentTraceId(); // check: are we even inside a traced request right now?

    // Not inside an active trace (e.g. app boot code) -> just run normally.
    if (!traceId) {
      // if nobody called runInNewTrace() around this code...
      return fn.apply(this, args); // ...skip all tracing, just call the real function directly
    }

    const parentId = context.currentParent(); // find out who's "currently running" — that's our parent
    const nodeId = collector.logEnter({
      // record that this function is starting
      traceId,
      file: meta.file,
      fnName: meta.fnName,
      parentId,
    });
    context.pushFrame(nodeId); // put this call on top of the stack so if it calls anything else, THAT sees us as parent

    const finishOk = (result) => {
      // helper: what to do when the function finishes successfully
      collector.logExit({ traceId, nodeId }); // record that it ended
      context.popFrame(); // remove ourselves from the stack — we're done
      return result; // pass the real return value through untouched
    };
    const finishErr = (err) => {
      // helper: what to do when the function throws/rejects
      collector.logExit({ traceId, nodeId, error: err }); // record the error too
      context.popFrame(); // still clean up the stack even on failure
      throw err; // re-throw so the caller's error handling still works normally
    };

    try {
      const result = fn.apply(this, args); // actually call the real, original function
      if (result && typeof result.then === "function") {
        // is it a Promise (i.e. an async function)?
        // async function: pop the frame only once it actually settles
        return result.then(finishOk, finishErr); // wait for it to resolve/reject before logging exit
      }
      return finishOk(result); // synchronous function: log exit immediately
    } catch (err) {
      return finishErr(err); // synchronous function threw — log it as an error exit
    }
  };

  Object.defineProperty(wrapped, "name", {
    value: meta.fnName,
    configurable: true,
  }); // cosmetic: make the wrapper's name match the original (helps debugging)
  return wrapped; // hand back the wrapped version to replace the original export
}

/**
 * Instrument a module's exports in place.
 * Handles: `module.exports = function() {}` and
 * `module.exports = { a, b, c }` (one level of named exports).
 * Anything that isn't a function is left untouched.
 */
function instrumentModule(moduleExports, filePath) {
  // filePath = relative path, used for labeling
  if (typeof moduleExports === "function") {
    // case 1: the whole file exports a single function
    return wrapFunction(moduleExports, {
      // wrap that one function directly
      file: filePath,
      fnName: moduleExports.name || "anonymous", // fallback name if it's an unnamed function
    });
  }

  if (moduleExports && typeof moduleExports === "object") {
    // case 2: the file exports an object of functions
    for (const key of Object.keys(moduleExports)) {
      // go through every exported property
      const val = moduleExports[key]; // get its value
      if (typeof val === "function") {
        // only touch it if it's actually a function
        moduleExports[key] = wrapFunction(val, { file: filePath, fnName: key }); // replace it in-place with the wrapped version
      }
    }
  }

  return moduleExports; // hand back the (possibly modified) exports object
}

module.exports = { instrumentModule, wrapFunction }; // expose both — instrumentModule is the one hook.js will actually use
