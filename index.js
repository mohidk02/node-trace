"use strict";

const hook = require("./lib/hook");
const context = require("./lib/context");
const collector = require("./lib/collector");
const render = require("./lib/render");
const autoHttp = require("./lib/autoHttp");

function init(options = {}) {
  hook.init(options); // patches require() so your files get instrumented

  if (options.autoHttp !== false) {
    // on by default - opt out with { autoHttp: false }
    autoHttp.installAutoRequestTracing((traceId) => {
      if (options.onRequestFinish) {
        options.onRequestFinish(traceId, render.renderMermaid(traceId)); // let the user handle it their own way
      } else {
        console.log(`\n--- Mermaid flowchart: ${traceId} ---\n`); // sensible default: just print it
        console.log(render.renderMermaid(traceId));
      }
    });
  }
}

module.exports = {
  init: (options) => init(options),

  // Still available for non-HTTP work (cron jobs, queue workers, scripts)
  // where there's no incoming request to auto-detect.
  runInNewTrace: context.runInNewTrace,
  currentTraceId: context.currentTraceId,

  getTrace: collector.getTrace,
  listTraces: collector.listTraces,
  renderMermaid: render.renderMermaid,
  toJSON: render.toJSON,
};
