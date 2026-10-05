import { LexerError } from "./errors.js";

export const TokenType = {
  KEYWORD: "KEYWORD",
  IDENTIFIER: "IDENTIFIER",
  NUMBER: "NUMBER",
  STRING: "STRING",
  OPERATOR: "OPERATOR",
  NEWLINE: "NEWLINE",
  EOF: "EOF",
};

const KEYWORDS = new Set(
  "set to show say if else end repeat times while and or not ask into define return call".split(" "),
);

const TWO_CHAR_OPS = new Set(["==", "!=", "<=", ">="]);

export class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  tokenize() {
    const tokens = [];
    let token;
    do tokens.push((token = this.nextToken()));
    while (token.type !== TokenType.EOF);
    return tokens;
  }

  nextToken() {
    this.skipWhitespaceAndComments();
    if (this.position >= this.input.length) {
      return this.createToken(TokenType.EOF, "EOF");
    }
    const char = this.input[this.position];

    if (char === "\n") {
      const token = this.createToken(TokenType.NEWLINE, "\n");
      this.position++;
      this.line++;
      this.column = 1;
      return token;
    }
    if (/[0-9]/.test(char)) {
      const t = this.readWhile(/[0-9.]/, TokenType.NUMBER);
      t.value = parseFloat(t.value);
      return t;
    }
    if (/[a-zA-Z_]/.test(char)) {
      const t = this.readWhile(/[a-zA-Z0-9_]/, TokenType.IDENTIFIER);
      if (KEYWORDS.has(t.value)) t.type = TokenType.KEYWORD;
      return t;
    }
    if (char === '"' || char === "'") return this.readString(char);
    if (/[+\-*/=<>()[\],!]/.test(char)) return this.readOperator();

    throw new LexerError(`Unexpected character: '${char}'`, this.line, this.column);
  }

  skipWhitespaceAndComments() {
    const s = this.input;
    while (this.position < s.length) {
      const char = s[this.position];
      if (char === " " || char === "\t" || char === "\r") {
        this.position++;
        this.column++;
      } else if (char === "#") {
        while (this.position < s.length && s[this.position] !== "\n") this.position++;
      } else break;
    }
  }

  readWhile(re, type) {
    const start = this.position;
    const column = this.column;
    while (this.position < this.input.length && re.test(this.input[this.position])) {
      this.position++;
      this.column++;
    }
    return { type, value: this.input.slice(start, this.position), line: this.line, column };
  }

  readString(quote) {
    const column = this.column;
    const start = ++this.position;
    this.column++;
    while (this.position < this.input.length && this.input[this.position] !== quote) {
      this.position++;
      this.column++;
    }
    if (this.position >= this.input.length) {
      throw new LexerError("Unterminated string", this.line, column);
    }
    const value = this.input.slice(start, this.position++);
    this.column++;
    return { type: TokenType.STRING, value, line: this.line, column };
  }

  readOperator() {
    const column = this.column;
    let op = this.input[this.position++];
    this.column++;
    if (TWO_CHAR_OPS.has(op + this.input[this.position])) {
      op += this.input[this.position++];
      this.column++;
    }
    return { type: TokenType.OPERATOR, value: op, line: this.line, column };
  }

  createToken(type, value) {
    return { type, value, line: this.line, column: this.column };
  }
}
