import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { engines, capture } from "./engine-cases.js";

for (const engine of engines) {
  const run = code => capture(engine, { code });
  test(`${engine}: the published example runs`, async () => {
    const result = await run(await readFile(new URL("../examples/builtins.eaze", import.meta.url), "utf8"));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.output.slice(0, -1), ["EAZE IS READY", 4, 1, 9, 3, 5, 9, 3, 7, "hello"]);
    assert.ok(result.output.at(-1) >= 0 && result.output.at(-1) < 1);
  });
  for (const [name, code, output] of [
    ["modulo and precedence", "say 10 modulo 3\nsay 10 % 3\nsay 2 + 10 modulo 4 * 3\nsay -10 modulo 3\nsay 5.5 modulo 2", [1, 1, 8, -1, 1.5]],
    ["boolean values", "set ready to true\nif ready and not false\nsay ready\nend\nsay false\nsay true == 1\nsay [true, false]", [true, false, false, [true, false]]],
    ["length", 'say call length("hello")\nsay call length([1, 2])\nsay call length([])', [5, 2, 0]],
    ["array utilities", "set items to [1]\nsay call append(items, 2)\nsay call push(items, 3)\nsay call remove_last(items)\nsay call pop(items)\nsay call length(items)\ncall pop(items)\nsay call pop(items)", [2, 3, 3, 2, 1, undefined]],
    ["text utilities", 'say call uppercase("Hello")\nsay call upper("Hello")\nsay call lowercase("Hello")\nsay call lower("Hello")', ["HELLO", "HELLO", "hello", "hello"]],
    ["math utilities", "say call round(2.6)\nsay call absolute(-4)\nsay call abs(-4)\nsay call square_root(9)\nsay call sqrt(9)\nsay call minimum(2, 4)\nsay call min(2, 4)\nsay call maximum(2, 4)\nsay call max(2, 4)", [3, 4, 4, 3, 3, 2, 2, 4, 4]],
    ["nested calls", 'say call uppercase(call lowercase("Eaze"))\nsay call square_root(call maximum(9, 4))', ["EAZE", 3]],
    ["user functions override built-ins", "define length(value)\nreturn 99\nend\nsay call length([])", [99]],
    ["arguments evaluated left to right", "set items to []\nsay call maximum(call append(items, 1), call append(items, 2))\nsay items[0]\nsay items[1]", [2, 1, 2]],
  ]) {
    test(`${engine}: ${name}`, async () => {
      const result = await run(code);
      assert.equal(result.error, undefined);
      assert.deepEqual(result.output, output);
    });
  }
  test(`${engine}: random returns a number from zero up to one`, async () => {
    const result = await run("repeat 20 times\nsay call random()\nend");
    assert.equal(result.error, undefined);
    assert.equal(result.output.length, 20);
    assert.ok(result.output.every(value => typeof value === "number" && value >= 0 && value < 1));
    assert.deepEqual(result.globals, []); // Built-ins do not clutter the user's variables.
  });
  for (const [code, message] of [
    ["say 1 modulo 0", "Modulo by zero"],
    ['say "a" modulo 2', "Modulo needs two numbers"],
    ["say true modulo 2", "Modulo needs two numbers"],
    ["say call length(2)", "argument 1 must be sequence"],
    ['say call append("text", 2)', "argument 1 must be array"],
    ["say call remove_last(2)", "argument 1 must be array"],
    ["say call uppercase([])", "argument 1 must be text"],
    ["say call lowercase(true)", "argument 1 must be text"],
    ['say call round("2")', "argument 1 must be number"],
    ["say call absolute(false)", "argument 1 must be number"],
    ["say call square_root(-1)", "Square root needs a non-negative number"],
    ["say call minimum(1)", "expects 2 arguments but got 1"],
    ["say call maximum(1, true)", "argument 2 must be number"],
    ["say call random(1)", "expects 0 arguments but got 1"],
    ["say call length()", "expects 1 arguments but got 0"],
    ["set length to 2\nsay call length([])", "'length' is not a function"],
  ]) {
    test(`${engine}: rejects ${code}`, async () => {
      const { error } = await run(code);
      assert.equal(error?.name, "RuntimeError");
      assert.ok(error.message.includes(message), error.message);
    });
  }
}
