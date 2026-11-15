import { Parser as CoreParser } from "../../../engine/parser.js";

// Grammar lives in the root engine; the visualizer needs statement locations.
export class Parser extends CoreParser {
  parse() {
    return { ...super.parse(), loc: { line: 1, column: 1 } };
  }

  parseStatement() {
    const token = this.peek();
    const node = super.parseStatement();
    if (node && !node.loc) node.loc = { line: token.line, column: token.column };
    return node;
  }

  // Keep the playground parser's existing entry points available.
  parseComparison() { return this.parseBinary(0); }
  parseAdditive() { return this.parseBinary(1); }
  parseMultiplicative() { return this.parseBinary(2); }
}
