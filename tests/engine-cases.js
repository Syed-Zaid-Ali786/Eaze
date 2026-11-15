import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { TEMPLATE_PROGRAMS } from "../eaze-react-app/src/constants/templates.js";

// Capture both engines independently: the playground also exposes locations and traces.
export const engines = ["engine", "eaze-react-app/src/engine"];
export const cases = [
  { name: "empty", code: "# Only a comment\n\n" },
  { name: "arithmetic", code: "say 2 + 3 * 4\nsay (2 + 3) * 4\nsay -8 / 2\nsay 9 - 4 - 2" },
  { name: "comparisons", code: "say 1 == 1\nsay 1 != 2\nsay 1 < 2\nsay 2 > 1\nsay 1 <= 1\nsay 2 >= 2" },
  { name: "logical precedence", code: "say not 0 and 2 or 3\nsay 0 and missing\nsay 1 or missing\nsay not -1\nsay 0 or 2 and 3" },
  { name: "arrays", code: "set a to [[1, 2], []]\nsay a[0][1]\nset a[1] to [3]\nsay a\nset a[0] to 9\nsay a[7]" },
  { name: "fractional indexes", code: "set a to []\nset a[-1] to 2\nset a[1.5] to 3\nsay a[-1]\nsay a[1.5]" },
  { name: "branches and scope", code: 'set x to 1\nif x\nset x to 4\nset local to 3\nelse\nsay "wrong"\nend\nif 0\nsay "wrong"\nelse\nsay x\nend\nsay local' },
  { name: "loops", code: "set x to 0\nrepeat 2.5 times\nset x to x + 1\nend\nwhile x < 5\nset x to x + 1\nend\nsay x\nrepeat -1 times\nsay missing\nend" },
  { name: "functions", code: "define factorial(n)\nif n <= 1\nreturn 1\nend\nreturn n * call factorial(n - 1)\nend\nsay call factorial(5)" },
  { name: "closure and parameter scope", code: "set x to 5\ndefine outer(a)\ndefine inner(b)\nreturn a + b + x\nend\nreturn call inner(2)\nend\nsay call outer(3)\ndefine change(x)\nset x to x + 1\nend\ncall change(8)\nsay x" },
  { name: "empty return", code: "define f()\nreturn\nend\nsay call f()" },
  { name: "input coercion", code: 'ask "one" into a\nask "two" into b\nask "three" into c\nask "four" into d\nsay a\nsay b\nsay c\nsay d', inputs: [" 12abc ", "", "Infinity", "  hi  "] },
  { name: "async input", code: 'ask "number" into x\nsay x + 1', inputs: ["7"], asyncInput: true },
  { name: "trace truncation", code: "repeat 5 times\nsay 1\nend", traceLimit: 3 },
  { name: "trace zero", code: "say 1", traceLimit: 0 },
  { name: "trace one", code: "say 1", traceLimit: 1 },
  { name: "repeated runs", code: "set x to 2\nsay x", secondCode: "set x to x + 3\nsay x" },
  { name: "output handler failure", code: "say 1\nsay 2", failOutput: true },
  ...["say 1 / 0", "say missing", 'repeat "x" times\nend', "return 3", "set f to 1\ncall f()", "define f(a)\nend\ncall f()", "set a to 1\nsay a[0]", 'set a to []\nsay a["x"]', "set a to 1\nset a[0] to 2", 'set a to []\nset a["x"] to 2', 'say "unterminated', "say @", "set to 1", "say", "if 1\nsay 2", "repeat 2\nend", "say [1,]", "define f(a,)\nend", "say call f(1,)", "say 1 say 2", "say !1", "say 1.2.3", "say 'a\nb'", "\t# comment\r\nsay 2"].map((code, i) => ({ name: `edge ${i + 1}`, code })),
];

for (const file of await readdir(new URL("../examples/", import.meta.url))) {
  // New language features have explicit assertions in language-features.test.js.
  if (file.endsWith(".eaze") && file !== "builtins.eaze") cases.push({ name: `example ${file}`, code: await readFile(new URL(`../examples/${file}`, import.meta.url), "utf8"), inputs: ["42", "4", "5"] });
}
cases.push(...TEMPLATE_PROGRAMS.map(t => ({ name: `template ${t.id}`, code: t.code, inputs: t.id === "guess-game" ? ["3", "9", "7"] : t.id === "password-lock" ? ["wrong", "eaze"] : ["42", "4", "5"] })));

export async function capture(engine, scenario) {
  const base = new URL(`../${engine}/`, import.meta.url);
  const [{ Lexer }, { Parser }, { Interpreter }] = await Promise.all(
    ["lexer", "parser", "interpreter"].map(file => import(new URL(`${file}.js`, base))),
  );
  const interpreter = new Interpreter();
  const result = { events: [] };
  let inputIndex = 0;
  interpreter.setInputHandler(prompt => {
    if (inputIndex > 100) throw new Error("Scenario exceeded input budget");
    result.events.push(["ask", prompt]);
    const answer = scenario.inputs?.[inputIndex++] ?? "42";
    return scenario.asyncInput ? Promise.resolve(answer) : answer;
  });
  interpreter.setOutputHandler(async value => {
    result.events.push(["show", value]);
    if (scenario.failOutput) throw new Error("Output unavailable");
  });
  if (scenario.traceLimit !== undefined) interpreter.setTraceLimit?.(scenario.traceLimit);
  try {
    result.tokens = new Lexer(scenario.code).tokenize();
    result.ast = new Parser(result.tokens).parse();
    result.output = await interpreter.run(result.ast);
    if (scenario.secondCode) {
      result.secondOutput = await interpreter.run(new Parser(new Lexer(scenario.secondCode).tokenize()).parse());
    }
  } catch (error) {
    result.error = { name: error.name, message: error.message, line: error.line, column: error.column, text: String(error) };
  }
  result.globals = [...interpreter.globalEnv.variables].map(([name, value]) => [name, value?.isFunction ? { name: value.name, params: value.params, body: value.body } : value]);
  result.trace = interpreter.trace;
  return result;
}

export function fingerprint(result) {
  return createHash("sha256").update(JSON.stringify(result)).digest("hex");
}
