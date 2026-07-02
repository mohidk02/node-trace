"use strict";

const http = require("node:http");
const context = require("./context");

let installed = false;

/**
 * Patches http.Server so that every incoming request - regardless of
 * whether it's raw http, Express, Fastify, etc (they all sit on top
 * of Node's http.Server) - automatically runs inside its own trace.
 * No manual runInNewTrace() call needed in route handlers.
 */
function installAutoRequestTracing(onFinish) {
  if (installed) return; // idempotent, safe if init() is called more than once
  installed = true;

  const originalEmit = http.Server.prototype.emit; // save Node's normal event dispatcher

  http.Server.prototype.emit = function (event, ...args) {
    // override it for ALL http servers in the process
    if (event === "request") {
      // only care about incoming requests, ignore other events (e.g. 'connection')
      const [req, res] = args; // Node always emits 'request' with (req, res)
      const label = `${req.method} ${req.url}`; // e.g. "GET /users/42" - used as a human-readable trace label

      return context.runInNewTrace(label, () => {
        // start a fresh trace for this request
        const traceId = context.currentTraceId(); // grab the ID we just created
        res.on("finish", () => {
          // fires when the response has fully been sent
          if (onFinish) onFinish(traceId); // let the caller (index.js) know this trace is complete
        });
        return originalEmit.apply(this, [event, ...args]); // now let Express/Fastify/etc actually handle the request as normal
      });
    }
    return originalEmit.apply(this, [event, ...args]); // any other event: pass through untouched
  };
}

module.exports = { installAutoRequestTracing };
