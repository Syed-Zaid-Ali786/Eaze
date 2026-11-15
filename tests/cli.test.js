import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cli = new URL("../cli/index.js", import.meta.url);
const invoke = (args, options = {}) => spawnSync(process.execPath, [fileURLToPath(cli), ...args], {
  encoding: "utf8", timeout: 10000,
  env: { ...process.env, NO_COLOR: "1", ...options.env }, input: options.input,
});

test("CLI help is readable at narrow widths without losing descriptions", () => {
  const result = invoke(["--help"], { env: { COLUMNS: "42" } });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--no-color/);
  assert.match(result.stdout, /NO_COLOR is also/);
  assert.ok(!result.stdout.includes("\x1b["));
  assert.ok(result.stdout.trim().split("\n").every(line => line.length <= 42));
});
test("CLI check labels its operation and never runs code", () => {
  const result = invoke(["--check", "examples/builtins.eaze"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Checking/);
  assert.match(result.stdout, /Syntax OK/);
  assert.doesNotMatch(result.stdout, /EAZE IS READY/);
});
test("CLI evaluation and errors preserve exit codes", () => {
  const good = invoke(["-e", 'say call uppercase("hello")']);
  assert.equal(good.status, 0);
  assert.match(good.stdout, /HELLO/);
  const bad = invoke(["-e", "say @"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /LexerError/);
  assert.match(bad.stdout, /1 │ say @/);
  assert.match(bad.stdout, /\^/);
  assert.doesNotMatch(bad.stdout, /type.*explain/i);
  assert.equal(invoke(["--unknown"]).status, 2);
});
test("CLI piped answers and diagnostic flags still work", () => {
  const result = invoke(["-e", 'ask "Number?" into number\nsay number + 1', "--time", "--tokens", "--ast"], { input: "4\n" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /▸ 5/);
  assert.match(result.stdout, /tokens/);
  assert.match(result.stdout, /AST/);
  assert.match(result.stdout, /done in/);
});
test("interactive commands, multiline code, and session history work", { timeout: 15000 }, async t => {
  const home = await mkdtemp(path.join(tmpdir(), "eaze-cli-"));
  const child = spawn(process.execPath, [fileURLToPath(cli)], {
    env: { ...process.env, NO_COLOR: "1", HOME: home, USERPROFILE: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(async () => { if (child.exitCode === null) child.kill(); await rm(home, { recursive: true, force: true }); });
  const commands = ['set greeting to "hello  world"', "vars", "repeat 2 times", "say greeting", "end", "?", "HELP", "exit"];
  let output = "", errors = "", sent = 0;
  child.stderr.on("data", data => { errors += data; });
  child.stdout.on("data", data => {
    output += data;
    if (/(?:eaze › |\d+ │ )$/.test(output) && sent < commands.length) child.stdin.write(commands[sent++] + "\n");
  });
  const status = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  assert.equal(status, 0, errors);
  assert.equal(sent, commands.length);
  assert.match(output, /✓ Done/);
  assert.match(output, /greeting → "hello  world"/);
  assert.match(output, /2 │ /);
  assert.match(output, /3 │ /);
  assert.equal((output.match(/▸ hello  world/g) || []).length, 2);
  assert.equal((output.match(/Your workspace/g) || []).length, 2);
  const history = await readFile(path.join(home, ".eaze_history"), "utf8");
  assert.equal(history.split("\n").filter(line => line === commands[0]).length, 1);
});
