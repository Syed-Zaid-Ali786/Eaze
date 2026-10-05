export class EazeError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = 'EazeError';
    this.line = line;
    this.column = column;
  }

  toString() {
    const location = this.line ? ` (line ${this.line}${this.column ? `, col ${this.column}` : ''})` : '';
    return `❌ ${this.name}${location}: ${this.message}`;
  }
}

const sub = (name) => ({ [name]: class extends EazeError {
  constructor(message, line, column) {
    super(message, line, column);
    this.name = name;
  }
} })[name];

export const LexerError = sub('LexerError');
export const ParseError = sub('ParseError');
export const RuntimeError = sub('RuntimeError');
