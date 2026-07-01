"use strict";

const Module = require("node:module"); // Node's internal module system — this is what runs every time you `require()` something
const path = require("node:path"); // for safely comparing/joining file paths across OSes
const { instrumentModule } = require("./instrument"); // the wrapper logic from the previous file

let installed = false; // guard flag, so init() only patches things once even if called twice

function shouldInstrument(filename, projectRoot) {
  // decides: is this file "yours", or a library/ourselves?
  if (filename.includes(`${path.sep}node_modules${path.sep}`)) return false; // skip anything inside node_modules — libraries stay untouched
  if (!filename.startsWith(projectRoot)) return false; // skip anything outside the user's project folder entirely
  // never instrument this package's own files
  if (filename.includes(`${path.sep}trace-flow${path.sep}`)) return false; // safety net: don't accidentally wrap our own tracer code
  return true; // otherwise, it's the user's own source — instrument it
}

function init(options = {}) {
  // the one function consumers call: tracer.init({ root: __dirname })
  if (installed) return; // idempotent, safe to call init() more than once
  installed = true; // mark as done so a second init() call is a no-op

  const projectRoot = path.resolve(options.root || process.cwd()); // where "your code" starts — defaults to current working directory
  const originalJsLoader = Module._extensions[".js"]; // save Node's normal ".js file loader" before we override it

  Module._extensions[".js"] = function (module, filename) {
    // replace Node's loader with our own version
    originalJsLoader(module, filename); // first, let Node load the file completely normally (fills in module.exports)
    if (shouldInstrument(filename, projectRoot)) {
      // then check: should we touch this file's exports?
      module.exports = instrumentModule(
        module.exports,
        path.relative(projectRoot, filename),
      ); // if yes, swap in the wrapped versions of its functions
    }
  };
}

module.exports = { init };
