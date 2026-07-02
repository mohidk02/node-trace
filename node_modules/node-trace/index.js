"use strict";

const hook = require("./lib/hook"); // the require() interceptor
const context = require("./lib/context"); // trace ID + call-stack tracking
const collector = require("./lib/collector"); // where events get stored
const render = require("./lib/render"); // turns events into Mermaid text

module.exports = {
  // Call once at the very top of your entry file, before requiring
  // anything else you want traced.
  init: (options) => hook.init(options), // starts the auto-instrumentation — this is your one line of setup

  // Wrap a unit of work (e.g. one incoming HTTP request) so every
  // function called inside it shares one trace ID.
  runInNewTrace: context.runInNewTrace, // call this around each request to start a fresh trace
  currentTraceId: context.currentTraceId, // lets you grab the ID of whichever trace is currently active

  // Inspect / render results after the work finishes.
  getTrace: collector.getTrace, // fetch the raw event log for one trace ID
  listTraces: collector.listTraces, // see every trace ID collected so far
  renderMermaid: render.renderMermaid, // get a ready-to-paste Mermaid flowchart for one trace
  toJSON: render.toJSON, // same data, but as raw JSON instead of Mermaid text
};
