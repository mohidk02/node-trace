"use strict"; // strict mode again

// traceId -> { events: [...], startedAt }
const traces = new Map(); // in-memory storage: one entry per request/trace, lives only while the app is running

let nodeCounter = 0; // counter to give each function-call event a unique node ID
function nextNodeId() {
  // helper to generate that ID
  return `n${++nodeCounter}`; // e.g. "n1", "n2", "n3" — just needs to be unique across the app
}

function ensureTrace(traceId, label) {
  // makes sure a trace entry exists before we log into it
  if (!traces.has(traceId)) {
    // if this is the first event for this trace...
    traces.set(traceId, { traceId, label, startedAt: Date.now(), events: [] }); // ...create an empty record for it
  }
  return traces.get(traceId); // return the (now guaranteed to exist) trace record
}

function logEnter({ traceId, label, file, fnName, parentId }) {
  // called when a traced function STARTS running
  const nodeId = nextNodeId(); // give this specific function call its own unique ID
  const trace = ensureTrace(traceId, label); // get (or create) the trace record it belongs to
  trace.events.push({
    // append a new "enter" event to that trace's log
    type: "enter", // marks this as a function-start event
    nodeId, // this call's unique ID
    parentId: parentId || null, // whoever called it (or null if it's the root call)
    file, // which file this function lives in
    fnName, // the function's name
    ts: Date.now(), // timestamp, useful for ordering/debugging later
  });
  return nodeId; // hand the ID back so the caller (instrument.js) can remember it for the matching exit
}

function logExit({ traceId, nodeId, error }) {
  // called when a traced function FINISHES running
  const trace = traces.get(traceId); // find the trace this belongs to
  if (!trace) return; // safety check — shouldn't happen, but don't crash if it does
  trace.events.push({
    // append the matching "exit" event
    type: "exit", // marks this as a function-end event
    nodeId, // same ID as the matching "enter" — this is how we pair them up later
    ts: Date.now(), // when it finished
    error: error ? String(error.message || error) : null, // record if it threw, otherwise null
  });
}

function logExternal({ traceId, parentId, moduleName }) {
  // called when your code calls something OUTSIDE your source (e.g. a library)
  const trace = traces.get(traceId); // find the relevant trace
  if (!trace) return; // safety check
  const nodeId = nextNodeId(); // still gets its own node ID, since it'll show up as a leaf in the graph
  trace.events.push({
    // log it as a distinct event type
    type: "external", // marks this as "we called out, but didn't trace inside it"
    nodeId,
    parentId: parentId || null, // who called this external thing
    moduleName, // which library/module was called
    ts: Date.now(),
  });
  return nodeId;
}

function getTrace(traceId) {
  // fetch one full trace record by ID
  return traces.get(traceId) || null; // null if it doesn't exist
}

function listTraces() {
  // fetch all trace IDs currently stored
  return Array.from(traces.keys()); // useful for picking "the trace I just ran" in demos/tests
}

function clear() {
  // wipe everything — useful between test runs
  traces.clear();
}

module.exports = {
  // expose the public API of this file
  logEnter,
  logExit,
  logExternal,
  getTrace,
  listTraces,
  clear,
};
