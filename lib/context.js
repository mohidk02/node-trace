"use strict"; // enables strict mode: catches silent JS bugs (undeclared vars, etc)

const { AsyncLocalStorage } = require("node:async_hooks"); // Node's built-in tool for passing data through async calls without manually threading it through every function

const als = new AsyncLocalStorage(); // one instance, shared by every request in the app, holds a separate "store" per active trace

let traceCounter = 0; // simple incrementing number, just to make trace IDs unique

function runInNewTrace(label, fn) {
  // call this once per request; fn is the code you want traced
  const traceId = `trace_${Date.now()}_${++traceCounter}`; // unique ID: timestamp + counter so two requests never collide

  const store = {
    // this object is what AsyncLocalStorage will carry through the whole request
    traceId, // so any function can ask "what trace am I in?"
    label: label || traceId, // human-readable name, e.g. "GET /users/42"
    stack: [], // will hold the chain of currently-running function IDs (who called who)
  };

  return als.run(store, fn); // runs fn with `store` attached to it — every await inside fn can still see this store
}

function getStore() {
  // low-level helper: read whatever store is active right now
  return als.getStore() || null; // returns null if called outside any trace (e.g. during app boot)
}

function currentTraceId() {
  // convenience wrapper around getStore()
  const s = getStore(); // grab the active store, if any
  return s ? s.traceId : null; // return its trace ID, or null if we're not inside a trace
}

function currentParent() {
  // used to figure out "who called the function that's about to run?"
  const s = getStore(); // grab the active store
  if (!s || s.stack.length === 0) return null; // no store, or nobody on the stack yet = no parent (this is the root call)
  return s.stack[s.stack.length - 1]; // the last item pushed is whoever is "currently running" = the parent
}

function pushFrame(nodeId) {
  // called right when a traced function starts running
  const s = getStore(); // grab the active store
  if (s) s.stack.push(nodeId); // add this function's ID to the top of the call stack
}

function popFrame() {
  // called right when a traced function finishes running
  const s = getStore(); // grab the active store
  if (s) s.stack.pop(); // remove the top of the stack — we're done, control returns to the caller
}

module.exports = {
  // expose only what other files need to use
  runInNewTrace,
  getStore,
  currentTraceId,
  currentParent,
  pushFrame,
  popFrame,
};
