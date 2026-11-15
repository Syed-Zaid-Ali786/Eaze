import { Interpreter as CoreInterpreter } from "../../../engine/interpreter.js";

// Execution lives entirely in the root engine. This adapter stores visualizer events.
export class Interpreter extends CoreInterpreter {
  constructor() {
    super();
    this.trace = [];
    this.traceLimit = 1000;
  }

  setTraceLimit(limit) { this.traceLimit = limit; }
  resetTrace() { this.trace = []; }

  logTrace(node, kind, message, data = {}) {
    const truncated = this.trace.length >= this.traceLimit;
    if (truncated && this.trace[this.trace.length - 1].kind === "truncated") return;
    this.trace.push({
      kind: truncated ? "truncated" : kind,
      message: truncated ? "Trace truncated (limit reached)" : message,
      ...(!truncated && { data }),
      loc: node ? node.loc : null,
      depth: 0,
      globals: this.getGlobals(),
      outputTail: this.output.slice(-5),
    });
  }

  getGlobals() {
    return [...this.globalEnv.variables].map(([name, value]) => ({
      name,
      value: typeof value === "object" && value.isFunction ? "[Function]" : value,
    }));
  }
}
