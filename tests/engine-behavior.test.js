import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cases, engines, capture, fingerprint } from "./engine-cases.js";
import * as coreLexer from "../engine/lexer.js";
import * as playgroundLexer from "../eaze-react-app/src/engine/lexer.js";
import { Interpreter as CoreInterpreter } from "../engine/interpreter.js";
import { Interpreter as PlaygroundInterpreter } from "../eaze-react-app/src/engine/interpreter.js";
import { Environment as CoreEnvironment } from "../engine/runtime.js";
import { Environment as PlaygroundEnvironment } from "../eaze-react-app/src/engine/runtime.js";
import * as coreErrors from "../engine/errors.js";
import * as playgroundErrors from "../eaze-react-app/src/engine/errors.js";
import { Parser as CoreParser } from "../engine/parser.js";
import { Parser as PlaygroundParser } from "../eaze-react-app/src/engine/parser.js";

for (const [name, Lexer, Parser] of [
  ["root", coreLexer.Lexer, CoreParser],
  ["playground", playgroundLexer.Lexer, PlaygroundParser],
]) {
  for (const [code, message, column] of [
    ["say [1, 2", "Expected ']' after array elements."],
    ["define f(a", "Expected ')' after parameters."],
    ["say call f(1", "Expected ')' after arguments."],
    ["say values[0", "Expected ']' after array index."],
    ["set values[0 to 1", "Expected ']' after array index.", 14],
    ["set values[0][1] to 1", "Expected 'to' after variable name.", 14],
  ]) {
    test(`${name}: preserves delimiter error for ${code}`, () => {
      assert.throws(() => new Parser(new Lexer(code).tokenize()).parse(), error => {
        assert.equal(error.name, "ParseError");
        assert.equal(error.message, message);
        assert.equal(error.line, 1);
        assert.equal(error.column, column ?? code.length + 1);
        return true;
      });
    });
  }
}

test("the playground uses the canonical root engine", () => {
  assert.equal(playgroundLexer.Lexer, coreLexer.Lexer);
  assert.equal(playgroundLexer.TokenType, coreLexer.TokenType);
  assert.equal(PlaygroundEnvironment, CoreEnvironment);
  for (const name of Object.keys(coreErrors)) assert.equal(playgroundErrors[name], coreErrors[name]);
  for (const method of ["run", "evaluate", "evaluateBlock", "indexed"]) {
    assert.equal(PlaygroundInterpreter.prototype[method], CoreInterpreter.prototype[method]);
  }
});

const baseline = JSON.parse(await readFile(new URL("./fixtures/engine-baseline.json", import.meta.url), "utf8"));
for (const engine of engines) {
  for (const scenario of cases) {
    test(`${engine}: ${scenario.name}`, { timeout: 3000 }, async () => {
      const result = await capture(engine, scenario);
      assert.equal(fingerprint(result), baseline[engine][scenario.name], JSON.stringify(result, null, 2));
    });
  }
  test(`${engine}: arithmetic produces the expected values`, async () => {
    assert.deepEqual((await capture(engine, cases.find(c => c.name === "arithmetic"))).output, [14, 20, -4, 3]);
  });
  test(`${engine}: recursive functions still return values`, async () => {
    assert.deepEqual((await capture(engine, cases.find(c => c.name === "functions"))).output, [120]);
  });
}
