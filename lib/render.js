"use strict";

const collector = require("./collector"); // to fetch the stored events for a given trace

function renderMermaid(traceId) {
  // turns one trace's events into Mermaid diagram text
  const trace = collector.getTrace(traceId); // fetch the full record for this trace
  if (!trace) return 'flowchart TD\n  empty["No trace found"]'; // safety fallback if the ID doesn't exist

  const labels = {}; // will map nodeId -> the text shown inside its box
  for (const e of trace.events) {
    // walk through every event in this trace, in order
    if (e.type === "enter") {
      // a function started running
      labels[e.nodeId] = `${e.fnName}\\n${e.file}`; // label = "functionName" then a line break then the file it's in
    } else if (e.type === "external") {
      // a call went out to a library/node_modules
      labels[e.nodeId] = `external: ${e.moduleName}`; // label it clearly as external
    }
    // note: 'exit' events are ignored here — they don't add new boxes, only enter/external do
  }

  const lines = ["flowchart TD"]; // start building the Mermaid text, "TD" = top-down layout
  for (const [id, label] of Object.entries(labels)) {
    // declare every box first
    lines.push(`  ${id}["${label.replace(/"/g, "'")}"]`); // e.g.  n1["getUser\nuserService.js"]  (swap " for ' so it doesn't break Mermaid's syntax)
  }
  for (const e of trace.events) {
    // now draw the arrows between boxes
    if ((e.type === "enter" || e.type === "external") && e.parentId) {
      // only if this call actually has a parent
      lines.push(`  ${e.parentId} --> ${e.nodeId}`); // e.g.  n1 --> n2   (parent called this one)
    }
  }
  return lines.join("\n"); // join every line into one multi-line string, ready to paste into mermaid.live
}

function toJSON(traceId) {
  // escape hatch: get the raw data instead of Mermaid text, e.g. for a custom UI
  return collector.getTrace(traceId);
}

module.exports = { renderMermaid, toJSON };
