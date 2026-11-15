import { TokenType } from "./lexer.js";
import { ParseError } from "./errors.js";

const { KEYWORD, OPERATOR, NEWLINE, IDENTIFIER } = TokenType;
const STATEMENTS = {
  set: "parseSet", show: "parseShow", say: "parseShow", repeat: "parseRepeat",
  while: "parseWhile", if: "parseIf", ask: "parseAsk", define: "parseDefine", return: "parseReturn",
};
const BINARY_LEVELS = [["or"], ["and"], ["==", "!=", "<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];

export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  parse() {
    return { type: "Program", body: this.parseUntil() };
  }

  // Parses statements until one of the given keywords (or EOF) is reached.
  parseUntil(...stops) {
    const body = [];
    while (!this.isAtEnd() && !(this.check(KEYWORD) && stops.includes(this.peek().value))) {
      if (this.match(NEWLINE)) continue;
      body.push(this.parseStatement());
    }
    return body;
  }

  parseStatement() {
    if (this.check(KEYWORD) && Object.hasOwn(STATEMENTS, this.peek().value)) {
      return this[STATEMENTS[this.advance().value]]();
    }
    if (this.check(KEYWORD, "call")) {
      return this.finishStatement("ExpressionStatement", this.parseExpression());
    }
    throw this.error(this.peek(), `Unexpected token: '${this.peek().value}'`);
  }

  parseSet() {
    const target = this.parseAssignmentTarget();
    this.consume(KEYWORD, "Expected 'to' after variable name.", "to");
    return this.finishStatement("Assignment", this.parseExpression(), { target });
  }

  parseAssignmentTarget() {
    const nameToken = this.consume(IDENTIFIER, "Expected variable name.");
    const target = { type: "Identifier", name: nameToken.value };
    return this.match(OPERATOR, "[") ? this.parseIndex(target) : target;
  }

  parseShow() {
    return this.finishStatement("Show", this.parseExpression());
  }

  parseAsk() {
    const message = this.parseExpression();
    this.consume(KEYWORD, "Expected 'into' after ask message.", "into");
    const id = this.consume(IDENTIFIER, "Expected variable name after 'into'.");
    this.consumeStatementEnd();
    return { type: "Ask", message, identifier: id.value };
  }

  parseRepeat() {
    const times = this.parseExpression();
    this.consume(KEYWORD, "Expected 'times' after repeat count.", "times");
    this.consumeStatementEnd();
    return { type: "RepeatLoop", times, body: this.parseBlock() };
  }

  parseWhile() {
    const condition = this.parseExpression();
    this.consumeStatementEnd();
    return { type: "WhileLoop", condition, body: this.parseBlock() };
  }

  parseIf() {
    const condition = this.parseExpression();
    this.consumeStatementEnd();
    const body = this.parseUntil("end", "else");
    let elseBody = null;
    if (this.match(KEYWORD, "else")) {
      this.consumeStatementEnd();
      elseBody = this.parseUntil("end");
    }
    this.consume(KEYWORD, "Expected 'end' to close if block.", "end");
    this.consumeStatementEnd();
    return { type: "IfStatement", condition, body, elseBody };
  }

  parseDefine() {
    const nameToken = this.consume(IDENTIFIER, "Expected function name after 'define'.");
    this.consume(OPERATOR, "Expected '(' after function name.", "(");
    const params = this.parseList(")", () => this.consume(IDENTIFIER, "Expected parameter name.").value, "Expected ')' after parameters.");
    this.consumeStatementEnd();
    return { type: "FunctionDeclaration", name: nameToken.value, params, body: this.parseBlock() };
  }

  parseReturn() {
    const value = !this.check(NEWLINE) && !this.isAtEnd() ? this.parseExpression() : null;
    return this.finishStatement("ReturnStatement", value);
  }

  finishStatement(type, value, fields = {}) {
    this.consumeStatementEnd();
    return { type, ...fields, value };
  }

  parseBlock() {
    const body = this.parseUntil("end");
    this.consume(KEYWORD, "Expected 'end' to close block.", "end");
    this.consumeStatementEnd();
    return body;
  }

  // Parse a comma-separated list and consume its closing delimiter.
  parseList(close, parseItem, message) {
    const items = [];
    if (!this.check(OPERATOR) || this.peek().value !== close) {
      do items.push(parseItem());
      while (this.match(OPERATOR, ","));
    }
    this.consume(OPERATOR, message, close);
    return items;
  }

  parseExpression() {
    return this.parseBinary(-2);
  }

  // Logical levels precede comparison (0), additive (1), and multiplicative (2).
  parseBinary(level) {
    if (level === 3) return this.parseUnary();
    let expr = this.parseBinary(level + 1);
    while (this.check(level < 0 ? KEYWORD : OPERATOR) && BINARY_LEVELS[level + 2].includes(this.peek().value)) {
      const operator = this.advance().value;
      expr = { type: level < 0 ? "LogicalExpression" : "BinaryExpression", operator, left: expr, right: this.parseBinary(level + 1) };
    }
    return expr;
  }

  parseUnary() {
    if (this.match(KEYWORD, "not") || this.match(OPERATOR, "-")) {
      return { type: "UnaryExpression", operator: this.previous().value, right: this.parseUnary() };
    }
    return this.parseCallOrIndex();
  }

  parseCallOrIndex() {
    if (this.match(KEYWORD, "call")) {
      const nameToken = this.consume(IDENTIFIER, "Expected function name after 'call'.");
      this.consume(OPERATOR, "Expected '(' after function name.", "(");
      const args = this.parseList(")", () => this.parseExpression(), "Expected ')' after arguments.");
      return { type: "FunctionCall", name: nameToken.value, arguments: args };
    }
    let expr = this.parsePrimary();
    while (this.match(OPERATOR, "[")) expr = this.parseIndex(expr);
    return expr;
  }

  parseIndex(object) {
    const index = this.parseExpression();
    this.consume(OPERATOR, "Expected ']' after array index.", "]");
    return { type: "IndexExpression", object, index };
  }

  parsePrimary() {
    if (this.match(KEYWORD, "true") || this.match(KEYWORD, "false")) return { type: "BooleanLiteral", value: this.previous().value === "true" };
    if (this.match(TokenType.NUMBER)) return { type: "NumberLiteral", value: this.previous().value };
    if (this.match(TokenType.STRING)) return { type: "StringLiteral", value: this.previous().value };
    if (this.match(IDENTIFIER)) return { type: "Identifier", name: this.previous().value };
    if (this.match(OPERATOR, "(")) {
      const expr = this.parseExpression();
      this.consume(OPERATOR, "Expected ')' after expression.", ")");
      return expr;
    }
    if (this.match(OPERATOR, "[")) {
      const elements = this.parseList("]", () => this.parseExpression(), "Expected ']' after array elements.");
      return { type: "ArrayLiteral", elements };
    }
    throw this.error(this.peek(), `Expected expression, got '${this.peek().value}'`);
  }

  // --- Helper Methods ---

  consumeStatementEnd() {
    if (this.isAtEnd() || this.match(NEWLINE)) return;
    throw this.error(this.peek(), "Expected end of statement (newline or EOF).");
  }

  match(type, value) {
    return this.check(type, value) && (this.advance(), true);
  }

  check(type, value) {
    return !this.isAtEnd() && this.peek().type === type && (value === undefined || this.peek().value === value);
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  consume(type, message, value) {
    if (this.check(type, value)) return this.advance();
    throw this.error(this.peek(), message);
  }

  error(token, message) {
    return new ParseError(message, token.line, token.column);
  }
}
