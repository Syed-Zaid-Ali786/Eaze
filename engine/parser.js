import { TokenType } from "./lexer.js";
import { ParseError } from "./errors.js";

const { KEYWORD, OPERATOR, NEWLINE, IDENTIFIER } = TokenType;

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
    while (!this.isAtEnd() && !stops.some((k) => this.checkKeyword(k))) {
      if (this.match(NEWLINE)) continue;
      body.push(this.parseStatement());
    }
    return body;
  }

  parseStatement() {
    const kw = {
      set: () => this.parseSet(),
      show: () => this.parseShow(),
      say: () => this.parseShow(),
      repeat: () => this.parseRepeat(),
      while: () => this.parseWhile(),
      if: () => this.parseIf(),
      ask: () => this.parseAsk(),
      define: () => this.parseDefine(),
      return: () => this.parseReturn(),
    };
    for (const k in kw) if (this.matchKeyword(k)) return kw[k]();
    if (this.checkKeyword("call")) {
      const value = this.parseExpression();
      this.consumeStatementEnd();
      return { type: "ExpressionStatement", value };
    }
    throw this.error(this.peek(), `Unexpected token: '${this.peek().value}'`);
  }

  parseSet() {
    const nameToken = this.consume(IDENTIFIER, "Expected variable name.");
    let target = { type: "Identifier", name: nameToken.value };
    if (this.matchOperator("[")) {
      const index = this.parseExpression();
      this.consumeOperator("]", "Expected ']' after array index.");
      target = { type: "IndexExpression", object: target, index };
    }
    this.consumeKeyword("to", "Expected 'to' after variable name.");
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { type: "Assignment", target, value };
  }

  parseShow() {
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { type: "Show", value };
  }

  parseAsk() {
    const message = this.parseExpression();
    this.consumeKeyword("into", "Expected 'into' after ask message.");
    const id = this.consume(IDENTIFIER, "Expected variable name after 'into'.");
    this.consumeStatementEnd();
    return { type: "Ask", message, identifier: id.value };
  }

  parseRepeat() {
    const times = this.parseExpression();
    this.consumeKeyword("times", "Expected 'times' after repeat count.");
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
    if (this.matchKeyword("else")) {
      this.consumeStatementEnd();
      elseBody = this.parseUntil("end");
    }
    this.consumeKeyword("end", "Expected 'end' to close if block.");
    this.consumeStatementEnd();
    return { type: "IfStatement", condition, body, elseBody };
  }

  parseDefine() {
    const nameToken = this.consume(IDENTIFIER, "Expected function name after 'define'.");
    this.consumeOperator("(", "Expected '(' after function name.");
    const params = this.parseList(")", () => this.consume(IDENTIFIER, "Expected parameter name.").value);
    this.consumeOperator(")", "Expected ')' after parameters.");
    this.consumeStatementEnd();
    return { type: "FunctionDeclaration", name: nameToken.value, params, body: this.parseBlock() };
  }

  parseReturn() {
    const value = !this.check(NEWLINE) && !this.isAtEnd() ? this.parseExpression() : null;
    this.consumeStatementEnd();
    return { type: "ReturnStatement", value };
  }

  parseBlock() {
    const body = this.parseUntil("end");
    this.consumeKeyword("end", "Expected 'end' to close block.");
    this.consumeStatementEnd();
    return body;
  }

  // Comma-separated list, stopping before the closing operator.
  parseList(close, parseItem) {
    const items = [];
    if (!this.check(OPERATOR) || this.peek().value !== close) {
      do items.push(parseItem());
      while (this.matchOperator(","));
    }
    return items;
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    return this.parseLogical("or", () => this.parseLogicalAnd());
  }

  parseLogicalAnd() {
    return this.parseLogical("and", () => this.parseBinary(0));
  }

  parseLogical(operator, next) {
    let expr = next();
    while (this.matchKeyword(operator)) {
      expr = { type: "LogicalExpression", operator, left: expr, right: next() };
    }
    return expr;
  }

  // Binary precedence levels: comparison, additive, multiplicative.
  parseBinary(level) {
    const levels = [["==", "!=", "<", ">", "<=", ">="], ["+", "-"], ["*", "/"]];
    if (level === levels.length) return this.parseUnary();
    let expr = this.parseBinary(level + 1);
    while (levels[level].some((op) => this.matchOperator(op))) {
      const operator = this.previous().value;
      expr = { type: "BinaryExpression", operator, left: expr, right: this.parseBinary(level + 1) };
    }
    return expr;
  }

  parseUnary() {
    for (const [type, op] of [[KEYWORD, "not"], [OPERATOR, "-"]]) {
      if (type === KEYWORD ? this.matchKeyword(op) : this.matchOperator(op)) {
        return { type: "UnaryExpression", operator: op, right: this.parseUnary() };
      }
    }
    return this.parseCallOrIndex();
  }

  parseCallOrIndex() {
    if (this.matchKeyword("call")) {
      const nameToken = this.consume(IDENTIFIER, "Expected function name after 'call'.");
      this.consumeOperator("(", "Expected '(' after function name.");
      const args = this.parseList(")", () => this.parseExpression());
      this.consumeOperator(")", "Expected ')' after arguments.");
      return { type: "FunctionCall", name: nameToken.value, arguments: args };
    }
    let expr = this.parsePrimary();
    while (this.matchOperator("[")) {
      const index = this.parseExpression();
      this.consumeOperator("]", "Expected ']' after array index.");
      expr = { type: "IndexExpression", object: expr, index };
    }
    return expr;
  }

  parsePrimary() {
    if (this.match(TokenType.NUMBER)) return { type: "NumberLiteral", value: this.previous().value };
    if (this.match(TokenType.STRING)) return { type: "StringLiteral", value: this.previous().value };
    if (this.match(IDENTIFIER)) return { type: "Identifier", name: this.previous().value };
    if (this.matchOperator("(")) {
      const expr = this.parseExpression();
      this.consumeOperator(")", "Expected ')' after expression.");
      return expr;
    }
    if (this.matchOperator("[")) {
      const elements = this.parseList("]", () => this.parseExpression());
      this.consumeOperator("]", "Expected ']' after array elements.");
      return { type: "ArrayLiteral", elements };
    }
    throw this.error(this.peek(), `Expected expression, got '${this.peek().value}'`);
  }

  // --- Helper Methods ---

  consumeStatementEnd() {
    if (this.isAtEnd() || this.match(NEWLINE)) return;
    throw this.error(this.peek(), "Expected end of statement (newline or EOF).");
  }

  match(type) {
    return this.check(type) && (this.advance(), true);
  }

  matchKeyword(keyword) {
    return this.checkKeyword(keyword) && (this.advance(), true);
  }

  matchOperator(op) {
    return this.checkOperator(op) && (this.advance(), true);
  }

  check(type) {
    return !this.isAtEnd() && this.peek().type === type;
  }

  checkKeyword(keyword) {
    return this.check(KEYWORD) && this.peek().value === keyword;
  }

  checkOperator(op) {
    return this.check(OPERATOR) && this.peek().value === op;
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

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  consumeKeyword(keyword, message) {
    if (this.checkKeyword(keyword)) return this.advance();
    throw this.error(this.peek(), message);
  }

  consumeOperator(op, message) {
    if (this.checkOperator(op)) return this.advance();
    throw this.error(this.peek(), message);
  }

  error(token, message) {
    return new ParseError(message, token.line, token.column);
  }
}
