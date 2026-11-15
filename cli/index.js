#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import chalk from "chalk";
import figures from "figures";
import { Lexer } from "../engine/lexer.js";
import { Parser } from "../engine/parser.js";
import { Interpreter } from "../engine/interpreter.js";
import { Environment } from "../engine/runtime.js";
import { EazeError } from "../engine/errors.js";

let interpreter = new Interpreter();

// ============================================================================
// VERSION & CONSTANTS
// ============================================================================
function getVersion() {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, "utf-8"));
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}
const VERSION = getVersion();
const AI_DEBUG_URL =
  process.env.EAZE_AI_URL || "http://localhost:3001/api/ai/debug";
const HISTORY_PATH = path.join(os.homedir(), ".eaze_history");
const HISTORY_MAX = 500;

const KEYWORDS = [
  "true", "false", "modulo",
  "set",
  "to",
  "show",
  "say",
  "if",
  "else",
  "end",
  "repeat",
  "times",
  "while",
  "and",
  "or",
  "not",
  "ask",
  "into",
  "define",
  "return",
  "call",
];

const COMMAND_WORDS = [
  "h", "?",
  "help",
  "vars",
  "clear",
  "exit",
  "quit",
  "reset",
  "load",
  "save",
  "tokens",
  "ast",
  "time",
  "explain",
  "Eaze",
  ".help",
  ".vars",
  ".clear",
  ".exit",
  ".quit",
  ".reset",
  ".load",
  ".save",
  ".tokens",
  ".ast",
  ".time",
  ".explain",
];

// ============================================================================
// COLOR PALETTE & STYLING
// ============================================================================
const colors = {
  primary: chalk.hex("#91b4ff"), secondary: chalk.hex("#d6dfed"),
  success: chalk.hex("#82c9ad"), error: chalk.hex("#f08f98"),
  warning: chalk.hex("#e0bd81"), accent: chalk.hex("#647b9c"),
  muted: chalk.hex("#91a0b6"), highlight: chalk.hex("#edf2fa"),
};
const BUILTINS = "length append remove_last uppercase lowercase round absolute square_root minimum maximum random push pop upper lower abs sqrt min max".split(" ");
const terminalWidth = () => Math.max(20, process.stdout.columns || Number(process.env.COLUMNS) || 80);

function shorten(value, max) {
  const text = String(value);
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + "…";
}

function heading(title, detail = "") {
  console.log("\n  " + colors.highlight.bold(title) + (detail ? "  " + colors.muted(detail) : ""));
}

function printBrand(compact = false) {
  console.log("");
  if (!compact && terminalWidth() >= 40) {
    console.log(colors.primary("  █▀▀ ▄▀█ ▀█ █▀▀"));
    console.log(colors.primary("  ██▄ █▀█ █▄ ██▄") + colors.success("  ●"));
    console.log("");
  }
  console.log("  " + colors.highlight.bold("eaze") + colors.success(".") + colors.muted("  /  " + (compact ? "CLI" : "THE ENGLISH-LIKE LANGUAGE")));
  console.log("  " + colors.secondary("Less syntax. More ideas.") + colors.muted("  v" + VERSION));
}

// Keep descriptions readable on small terminals instead of cutting them off.
function rows(entries) {
  const stacked = terminalWidth() < 64;
  const labelWidth = Math.max(...entries.map(([label]) => label.length)) + 2;
  for (const [label, description] of entries) {
    const indent = stacked ? 4 : labelWidth + 2;
    const width = Math.max(10, terminalWidth() - indent - 2);
    const words = String(description).split(/\s+/);
    const lines = [""];
    for (const word of words) {
      if (lines.at(-1) && lines.at(-1).length + word.length + 1 > width) lines.push("");
      lines[lines.length - 1] += (lines.at(-1) ? " " : "") + word;
    }
    if (stacked) console.log("  " + colors.primary(label));
    lines.forEach((line, index) => console.log(
      (!stacked && index === 0 ? "  " + colors.primary(label.padEnd(labelWidth)) : " ".repeat(indent)) + colors.muted(line),
    ));
  }
}

// ============================================================================
// EASTER EGG
// ============================================================================
function printEasterEgg() {
  console.log("");
  console.log(colors.secondary(`  ${figures.star} You found a hidden command... ${figures.star}`));
  console.log("");
  console.log(colors.primary("  Eaze isn't just a language."));
  console.log(colors.primary("  It's a way to think in code."));
  console.log("");
  console.log(colors.muted("  Less syntax."));
  console.log(colors.muted("  More ideas."));
  console.log("");
  console.log(colors.accent("  Welcome to Eaze"));
  console.log("");
}

// ============================================================================
// BANNER & WELCOME
// ============================================================================
function printWelcomeBanner(opts = {}) {
  if (opts.clearScreen !== false && process.stdout.isTTY) console.clear();
  printBrand();
  console.log("\n  " + colors.muted("Start with ") + colors.primary('say "Hello, world!"'));
  rows([["help", "Commands and language guide"], ["vars", "See what your program remembers"]]);
  console.log("\n" + colors.muted("  Tab completes · ↑ history"));
  console.log(colors.muted("  end closes blocks · Ctrl+C cancels input\n"));
}

function printHelpMenu() {
  printBrand(true);
  heading("Your workspace", "REPL commands");
  rows([
    ["help / ?", "Show this guide; commands also accept a leading dot"],
    ["vars", "Inspect variables and functions"],
    ["reset", "Clear variables; keep your session history"],
    ["load <file>", "Run a file in the current environment; quote paths with spaces"],
    ["save <file>", "Save the code entered in this session"],
    ["tokens / ast / time", "Toggle a diagnostic view, or explicitly use on or off"],
    ["explain", "Ask the AI debugger about the last error"],
    ["clear", "Clear the screen and show the welcome message"],
    ["exit / quit", "Leave Eaze"],
  ]);
  heading("Write it like you mean it", "language basics");
  rows([
    ["Remember a value", "set score to 10"], ["Show a result", 'say "Hello!"'],
    ["Ask a question", 'ask "Name?" into name'], ["Make a decision", "if ready / else / end"],
    ["Repeat something", "repeat 5 times / end"], ["Keep going", "while score < 10 / end"],
    ["Define a function", "define add(a, b) / return a + b / end"],
    ["Use a function", "say call length([1, 2, 3])"],
    ["Booleans / remainder", "true, false · 10 modulo 3 (also 10 % 3)"],
  ]);
  heading("Built-in functions", "always start with call");
  rows([
    ["Lists and text", "length, append, remove_last, uppercase, lowercase"],
    ["Numbers", "round, absolute, square_root, minimum, maximum, random"],
  ]);
  console.log("\n" + colors.muted("  Close blocks with end. Ctrl+C discards an unfinished block.\n"));
}

function printCliHelp() {
  printBrand(true);
  console.log("");
  rows([["eaze", "Start an interactive session"], ["eaze [options] <file ...>", "Run files in one shared environment"], ['eaze -e "say 1 + 2"', "Run code directly"]]);
  heading("Options");
  rows([
    ["-h, --help", "Show this guide"], ["-v, --version", "Show the version"],
    ["-e, --eval CODE", "Evaluate code; repeat the flag to add more lines"],
    ["--check", "Check syntax without executing"], ["--tokens", "Show lexer tokens"],
    ["--ast", "Show the syntax tree"], ["--time", "Show execution time"],
    ["--no-color", "Disable colors; NO_COLOR is also supported"], ["--", "Treat the remaining arguments as file paths"],
  ]);
  heading("Try it");
  rows([["Run a file", "eaze examples/builtins.eaze"], ["Check a file", "eaze --check program.eaze"], ["Provide input", "echo 5 | eaze examples/fibonacci.eaze"]]);
  console.log("\n" + colors.muted("  Type help in a session for more.\n"));
}

// ============================================================================
// ARG PARSING (no extra deps)
// ============================================================================
function parseArgs(argv) {
  const opts = {
    files: [],
    evalCode: null,
    check: false,
    tokens: false,
    ast: false,
    time: false,
    help: false,
    version: false,
    noColor: false,
  };
  const errors = [];
  let i = 0;
  let endOfFlags = false;
  while (i < argv.length) {
    const a = argv[i];
    if (!endOfFlags && a === "--") {
      endOfFlags = true;
      i++;
      continue;
    }
    if (!endOfFlags && (a === "-e" || a === "--eval")) {
      const next = argv[i + 1];
      if (next === undefined) {
        errors.push(`Missing value for ${a}`);
        i++;
        continue;
      }
      opts.evalCode = opts.evalCode === null ? next : opts.evalCode + "\n" + next;
      i += 2;
      continue;
    }
    if (!endOfFlags && a.startsWith("-") && a !== "-") {
      switch (a) {
        case "-h":
        case "--help":
          opts.help = true;
          break;
        case "-v":
        case "--version":
          opts.version = true;
          break;
        case "--check":
          opts.check = true;
          break;
        case "--tokens":
          opts.tokens = true;
          break;
        case "--ast":
          opts.ast = true;
          break;
        case "--time":
          opts.time = true;
          break;
        case "--no-color":
          opts.noColor = true;
          break;
        default:
          errors.push(`Unknown option: ${a}`);
      }
      i++;
      continue;
    }
    opts.files.push(a);
    i++;
  }
  return { opts, errors };
}

// ============================================================================
// VARIABLES DISPLAY
// ============================================================================
function formatValue(value, maxLen) {
  let raw;
  if (value && value.isFunction) {
    raw = `[Function: ${value.name}(${value.params.join(", ")})]`;
    return shorten(raw, maxLen);
  }
  if (Array.isArray(value)) {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
    return shorten(raw, maxLen);
  }
  try {
    raw = JSON.stringify(value);
    if (raw === undefined) raw = String(value);
  } catch {
    raw = String(value);
  }
  return shorten(raw, maxLen);
}

function printVariables(env) {
  const variables = Array.from(env.variables.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (variables.length === 0) {
    console.log("");
    console.log(colors.muted(`  ${figures.info}  No variables defined yet`));
    console.log("");
    return;
  }

  heading("Variables", String(variables.length) + " in this session");
  for (const [name, value] of variables) {
    console.log("  " + colors.primary(name) + colors.muted(" → ") + colors.secondary(formatValue(value, 240)));
  }
  console.log("");
}

// ============================================================================
// BLOCK COMPLETENESS (string/comment-aware, #1 fix)
// ============================================================================
function stripStringsAndComments(code) {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  let inComment = false;
  let unterminated = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inComment) {
      if (ch === "\n") {
        inComment = false;
        out += ch;
      } else {
        out += " ";
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
        out += " ";
      } else if (ch === "\n") {
        unterminated = true;
        out += ch;
      } else {
        out += " ";
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
        out += " ";
      } else if (ch === "\n") {
        unterminated = true;
        out += ch;
      } else {
        out += " ";
      }
      continue;
    }
    if (ch === "#") {
      inComment = true;
      out += " ";
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += " ";
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += " ";
      continue;
    }
    out += ch;
  }

  if (inSingle || inDouble) unterminated = true;
  return { text: out, unterminated };
}

function isStatementComplete(code) {
  if (!code || !code.trim()) return true;
  const { text, unterminated } = stripStringsAndComments(code);
  if (unterminated) return false;

  const blockOpeners = /\b(repeat|while|if|define)\b/g;
  const blockClosers = /\bend\b/g;

  const openers = (text.match(blockOpeners) || []).length;
  const closers = (text.match(blockClosers) || []).length;

  if (closers > openers) return true; // let the parser report the error
  if (openers !== closers) return false;

  const opens = (text.match(/[\(\[]/g) || []).length;
  const closes = (text.match(/[\)\]]/g) || []).length;
  if (opens !== closes) return false;

  return true;
}

// ============================================================================
// LEX / PARSE / EXECUTION
// ============================================================================
function lexAndParse(code) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return { tokens, ast };
}

function printErrorWithContext(error, code) {
  heading(colors.error(error.name || "Error"));
  console.log("  " + colors.secondary(error.message || String(error)));
  if (error.line) {
    const lines = String(code).split("\n");
    const target = lines[error.line - 1];
    if (target !== undefined) {
      const prefix = "  " + error.line + " │ ";
      const offset = Math.max(0, (error.column || 1) - 1);
      const start = Math.max(0, offset - Math.max(5, terminalWidth() - prefix.length - 12));
      console.log("\n" + colors.muted(prefix) + shorten((start ? "…" : "") + target.slice(start).replace(/\t/g, " "), terminalWidth() - prefix.length));
      console.log(" ".repeat(prefix.length + offset - start + (start ? 1 : 0)) + colors.error("^"));
    }
  }
  console.log("\n" + colors.muted(process.argv.length <= 2
    ? '  Edit the code and try again. Type explain for AI help.'
    : '  Edit the code and run it again. Use --check to check syntax.'));
  console.log("");
}

async function run(code, opts = {}) {
  const t0 = Date.now();
  const previousOutputHandler = interpreter.outputHandler;
  let printedAnyOutput = false;

  interpreter.setOutputHandler((output) => {
    printedAnyOutput = true;
    process.stdout.write(
      `  ${colors.success("▸")} ${colors.secondary(String(output))}\n`,
    );
  });

  try {
    const { tokens, ast } = lexAndParse(code);

    if (opts.showTokens) {
      console.log(colors.muted(`  tokens (${tokens.length}):`));
      console.log(
        colors.muted(
          "  " +
            shorten(
              tokens.map((t) => `${t.type}:${t.value}`).join(" "),
              500,
            ),
        ),
      );
    }
    if (opts.showAst) {
      console.log(colors.muted("  AST:"));
      const pretty = JSON.stringify(ast, null, 2)
        .split("\n")
        .map((l) => "  " + l)
        .join("\n");
      console.log(colors.muted(shorten(pretty, 4000)));
    }

    await interpreter.run(ast);
    if (!printedAnyOutput && opts.feedback) console.log(colors.success("  ✓ Done"));

    if (printedAnyOutput) {
      process.stdout.write("\n");
    }
    if (opts.showTime) {
      console.log(colors.muted(`  ${figures.info} done in ${Date.now() - t0}ms`));
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof EazeError) {
      printErrorWithContext(error, code);
    } else {
      console.log("");
      console.log(
        `  ${colors.error(figures.cross)} ${chalk.white("Unexpected Error: " + error.message)}`,
      );
      console.log("");
    }
    return { ok: false, error };
  } finally {
    interpreter.setOutputHandler(previousOutputHandler);
  }
}

async function checkOnly(code, opts = {}) {
  try {
    const { tokens, ast } = lexAndParse(code);
    console.log(
      `  ${colors.success(figures.tick)} Syntax OK (${tokens.length} tokens, ${ast.body.length} statements)`,
    );
    if (opts.showTokens) {
      console.log(
        colors.muted(
          "  " +
            shorten(
              tokens.map((t) => `${t.type}:${t.value}`).join(" "),
              500,
            ),
        ),
      );
    }
    if (opts.showAst) {
      console.log(colors.muted(shorten(JSON.stringify(ast, null, 2), 4000)));
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof EazeError) {
      printErrorWithContext(error, code);
    } else {
      console.log(
        `  ${colors.error(figures.cross)} ${chalk.white("Unexpected Error: " + error.message)}`,
      );
    }
    return { ok: false, error };
  }
}

// Read piped stdin lines (non-TTY). Resolves on end/close, never hangs if
// stdin is already ended.
function readPipedStdinLines() {
  return new Promise((resolve) => {
    if (process.stdin.readableEnded) {
      resolve([]);
      return;
    }
    let buffer = "";
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(buffer.split("\n"));
    };
    const onData = (chunk) => {
      buffer += chunk;
    };
    const cleanup = () => {
      try {
        process.stdin.removeListener("data", onData);
      } catch {}
      try {
        process.stdin.removeListener("end", done);
      } catch {}
      try {
        process.stdin.removeListener("close", done);
      } catch {}
    };
    try {
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", onData);
      process.stdin.on("end", done);
      process.stdin.on("close", done);
      if (process.stdin.readableEnded) done();
    } catch {
      done();
    }
  });
}

// Run fn with an `ask` handler wired to TTY prompts or piped stdin.
async function withAutoInput(fn) {
  const isTTY = process.stdin.isTTY;
  if (isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    interpreter.setInputHandler((message) => {
      return new Promise((resolve) => {
        rl.question(`  ${colors.secondary(String(message))} `, (answer) => {
          resolve(answer);
        });
      });
    });
    try {
      return await fn();
    } finally {
      rl.close();
    }
  }

  const inputLines = await readPipedStdinLines();
  let lineIndex = 0;
  interpreter.setInputHandler((message) => {
    process.stdout.write(`  ${colors.secondary(String(message))} `);
    if (lineIndex < inputLines.length) {
      const line = inputLines[lineIndex];
      lineIndex++;
      process.stdout.write(line + "\n");
      return line;
    }
    return "";
  });
  return await fn();
}

async function runFile(filename, opts = {}) {
  let code;
  try {
    code = fs.readFileSync(filename, "utf-8");
  } catch (error) {
    console.log(
      `  ${colors.error(figures.cross)} Could not read file ${filename}: ${error.message}\n`,
    );
    return false;
  }

  console.log(
    `\n  ${colors.primary(figures.play)} ${opts.check ? "Checking" : "Running"} ${colors.secondary(filename)}\n`,
  );

  if (opts.check) {
    const res = await checkOnly(code, opts);
    return res.ok;
  }

  const runOpts = {
    showTokens: opts.tokens,
    showAst: opts.ast,
    showTime: opts.time,
  };
  const result = await withAutoInput(() => run(code, runOpts));
  return result.ok;
}

async function runEval(code, opts = {}) {
  if (opts.check) {
    const res = await checkOnly(code, opts);
    return res.ok;
  }
  const runOpts = {
    showTokens: opts.tokens,
    showAst: opts.ast,
    showTime: opts.time,
  };
  const result = await withAutoInput(() => run(code, runOpts));
  return result.ok;
}

// ============================================================================
// HISTORY
// ============================================================================
function loadHistoryLines() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
    return raw
      .split("\n")
      .map((l) => l.replace(/\r$/, ""))
      .filter((l) => l.trim() !== "")
      .slice(-HISTORY_MAX);
  } catch {
    return [];
  }
}

function saveSessionHistory(rl, typedHistory, preloaded = []) {
  try {
    const fromFile = loadHistoryLines();
    const live = [...(rl.history || [])].reverse().map((l) => String(l));
    // rl.history only auto-tracks on TTYs, but it DOES keep entries we
    // preloaded ourselves — exclude those (plus this session's lines) so
    // nothing is recorded twice.
    const known = new Set([...preloaded, ...typedHistory]);
    const extra = live.filter((l) => l.trim() !== "" && !known.has(l));
    const merged = [...fromFile, ...typedHistory, ...extra]
      .map((l) => String(l).replace(/\r$/, ""))
      .filter((l) => l.trim() !== "")
      .slice(-HISTORY_MAX);
    fs.writeFileSync(HISTORY_PATH, merged.join("\n") + "\n", "utf-8");
  } catch {
    // history is best-effort; never crash the REPL over it
  }
}

// ============================================================================
// AI EXPLAIN (graceful when server is down)
// ============================================================================
async function explainLastError(lastCode, lastError) {
  if (!lastError || !lastCode) {
    console.log("");
    console.log(colors.muted(`  ${figures.info} No errors yet — run some code first.`));
    console.log("");
    return;
  }
  console.log(colors.muted(`  ${figures.info} Asking the AI debugger...`));
  try {
    if (typeof fetch !== "function") {
      throw new Error("global fetch is not available (need Node 18+)");
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let res;
    try {
      res = await fetch(AI_DEBUG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lastCode, error: String(lastError) }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`server responded ${res.status} ${body.slice(0, 120)}`);
    }
    const data = await res.json();
    const suggestion = data.suggestion || data.explanation || JSON.stringify(data);
    console.log("");
    console.log(colors.secondary(`  ${figures.star} AI suggestion:`));
    String(suggestion)
      .split("\n")
      .forEach((l) => console.log("  " + colors.muted(l)));
    console.log("");
  } catch (e) {
    console.log("");
    console.log(
      `  ${colors.warning(figures.warning)} Could not reach the AI server (${e.message})`,
    );
    console.log(
      colors.muted("  Start it with:  npm run dev --prefix server   (port 3001)"),
    );
    console.log(
      colors.muted(`  Or set EAZE_AI_URL to a running instance (tried ${AI_DEBUG_URL})`),
    );
    console.log("");
  }
}

// ============================================================================
// REPL
// ============================================================================
function makeCompleter() {
  return (line) => {
    const tokenMatch = line.match(/[A-Za-z_.]*$/);
    const prefix = tokenMatch ? tokenMatch[0] : "";
    if (!prefix) return [[], line];
    const varNames = Array.from(interpreter.globalEnv.variables.keys());
    const pool = [...new Set([...COMMAND_WORDS, ...KEYWORDS, ...BUILTINS, ...varNames])];
    const hits = pool.filter((w) => w.startsWith(prefix) && w !== prefix);
    return [hits, prefix];
  };
}

function startREPL(cliOpts = {}) {
  printWelcomeBanner();

  const mainPrompt = colors.primary("eaze") + colors.muted(" › ");
  const contPrompt = () => colors.muted(String(buffer.split("\n").length + 1).padStart(3) + " │ ");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: makeCompleter(),
    historySize: HISTORY_MAX,
  });

  // Preload persistent history (newest-first internally) so Up-arrow
  // works on TTYs. Tracked separately so saving never duplicates it.
  let preloadedHistory = [];
  try {
    preloadedHistory = loadHistoryLines();
    for (const h of [...preloadedHistory].reverse()) {
      try {
        rl.history.push(h);
      } catch {}
    }
  } catch {}

  let buffer = "";
  let isRunning = false;
  let awaitingAsk = false;
  let pendingAskResolve = null;
  let lastCode = null;
  let lastError = null;
  let lastSigint = 0;
  let sigintDuringRun = 0;
  let showTokens = !!cliOpts.tokens;
  let showAst = !!cliOpts.ast;
  let showTime = !!cliOpts.time;
  const sessionInputs = [];
  let pendingLines = [];
  // Our own history: readline only maintains rl.history on TTYs, so piped
  // sessions would otherwise lose history entirely.
  const typedHistory = [];

  function showPrompt() {
    rl.setPrompt(mainPrompt);
    rl.prompt();
  }

  function showContinuationPrompt() {
    rl.setPrompt(contPrompt());
    rl.prompt();
  }

  // `ask` handler: routes through the same readline, guarded so answers
  // are not also interpreted as REPL code.
  interpreter.setInputHandler((message) => {
    return new Promise((resolve) => {
      awaitingAsk = true;
      pendingAskResolve = resolve;
      rl.question(`  ${colors.secondary(String(message))} `, (answer) => {
        awaitingAsk = false;
        pendingAskResolve = null;
        resolve(answer);
      });
    });
  });

  async function handleCommand(cmd, arg) {
    switch (cmd) {
      case "help":
        printHelpMenu();
        break;
      case "vars":
        printVariables(interpreter.globalEnv);
        break;
      case "reset": {
        interpreter.globalEnv = new Environment();
        lastCode = null;
        lastError = null;
        console.log("");
        console.log(colors.muted(`  ${figures.tick} Environment cleared.`));
        console.log("");
        break;
      }
      case "clear":
        printWelcomeBanner();
        break;
      case "exit":
      case "quit":
        console.log("");
        console.log(colors.secondary("  Keep your ideas running.") + colors.primary("  eaze.\n"));
        rl.close();
        return;
      case "tokens":
      case "ast":
      case "time": {
        const key = cmd;
        const val = (arg || "").toLowerCase();
        if (val === "on") {
          if (key === "tokens") showTokens = true;
          if (key === "ast") showAst = true;
          if (key === "time") showTime = true;
        } else if (val === "off") {
          if (key === "tokens") showTokens = false;
          if (key === "ast") showAst = false;
          if (key === "time") showTime = false;
        } else {
          // bare `tokens` toggles
          if (key === "tokens") showTokens = !showTokens;
          if (key === "ast") showAst = !showAst;
          if (key === "time") showTime = !showTime;
        }
        const state = key === "tokens" ? showTokens : key === "ast" ? showAst : showTime;
        console.log(colors.muted(`  ${figures.info} ${key} ${state ? "on" : "off"}`));
        break;
      }
      case "load": {
        if (!arg) {
          console.log(colors.muted(`  ${figures.info} Usage: load <file>`));
          break;
        }
        const target = arg.replace(/^["']|["']$/g, "");
        let code;
        try {
          code = fs.readFileSync(target, "utf-8");
        } catch (e) {
          console.log(
            `  ${colors.error(figures.cross)} Could not read file ${target}: ${e.message}`,
          );
          break;
        }
        console.log(
          `  ${colors.primary(figures.play)} Loading ${colors.secondary(target)}`,
        );
        sessionInputs.push(code);
        isRunning = true;
        rl.pause();
        try {
          const res = await run(code, { showTokens, showAst, showTime, feedback: true });
          lastCode = code;
          lastError = res.ok ? null : res.error;
        } finally {
          isRunning = false;
          rl.resume();
        }
        break;
      }
      case "save": {
        if (!arg) {
          console.log(colors.muted(`  ${figures.info} Usage: save <file>`));
          break;
        }
        const target = arg.replace(/^["']|["']$/g, "");
        try {
          const content = sessionInputs.join("\n") + "\n";
          fs.writeFileSync(target, content, "utf-8");
          console.log(
            `  ${colors.success(figures.tick)} Session saved to ${colors.secondary(target)} (${sessionInputs.length} blocks)`,
          );
        } catch (e) {
          console.log(
            `  ${colors.error(figures.cross)} Could not save: ${e.message}`,
          );
        }
        break;
      }
      case "explain":
        isRunning = true;
        rl.pause();
        try {
          await explainLastError(lastCode, lastError);
        } finally {
          isRunning = false;
          rl.resume();
        }
        break;
      case "Eaze":
        printEasterEgg();
        break;
      default:
        console.log(
          colors.muted(
            `  ${figures.info} Unknown command "${cmd}". Type "help" for commands.`,
          ),
        );
    }
  }

  function parseReplCommand(trimmed) {
    const normalized = trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
    const spaceIdx = normalized.search(/\s/);
    const cmd = spaceIdx === -1 ? normalized : normalized.slice(0, spaceIdx);
    const arg =
      spaceIdx === -1 ? "" : normalized.slice(spaceIdx + 1).trim();
    if (COMMAND_WORDS.includes(cmd.toLowerCase()) || cmd === "?" || cmd === "Eaze") {
      // `Eaze` easter egg stays case-sensitive; everything else lowercase
      if (cmd === "Eaze") return { cmd, arg };
      const lower = cmd.toLowerCase();
      const known = [
        "help",
        "h",
        "?",
        "vars",
        "clear",
        "exit",
        "quit",
        "reset",
        "load",
        "save",
        "tokens",
        "ast",
        "time",
        "explain",
      ];
      if (["h", "?"].includes(lower)) return { cmd: "help", arg };
      if (known.includes(lower)) return { cmd: lower, arg };
    }
    return null;
  }

  showPrompt();

  async function processLine(line) {
    const input = line.trim();
    if (input) {
      typedHistory.push(line);
      if (typedHistory.length > HISTORY_MAX * 2) {
        typedHistory.splice(0, typedHistory.length - HISTORY_MAX * 2);
      }
    }

    // Handle special commands only if buffer is empty
    if (!buffer) {
      if (!input) {
        showPrompt();
        return;
      }
      const parsed = parseReplCommand(input);
      if (parsed) {
        await handleCommand(parsed.cmd, parsed.arg);
        if (!rl.closed) showPrompt();
        return;
      }
      if (input.startsWith(".")) {
        console.log(
          colors.muted(
            `  ${figures.info} Unknown command "${input}". Type "help" for commands.`,
          ),
        );
        showPrompt();
        return;
      }
    }

    // Add input to buffer (keep raw line for caret-accurate errors)
    buffer = buffer ? buffer + "\n" + line : line;
    sessionInputs.push(line);

    // Check if statement is complete
    if (buffer.trim() && isStatementComplete(buffer)) {
      const code = buffer;
      buffer = "";
      isRunning = true;
      sigintDuringRun = 0;
      rl.pause();
      try {
        const res = await run(code, { showTokens, showAst, showTime, feedback: true });
        lastCode = code;
        lastError = res.ok ? null : res.error;
      } finally {
        isRunning = false;
        rl.resume();
      }
      if (buffer.trim()) showContinuationPrompt();
      else showPrompt();
    } else if (buffer.trim()) {
      showContinuationPrompt();
    } else {
      buffer = "";
      showPrompt();
    }
  }

  async function handleLine(line) {
    // Answers to `ask "…"` are consumed by rl.question — ignore them here.
    if (awaitingAsk) return;

    // Arrived while a run is in flight: queue and replay in order later
    // (keeps commands like `vars` from being swallowed as code).
    if (isRunning) {
      pendingLines.push(line);
      return;
    }

    await processLine(line);

    // Replay lines that arrived mid-run, in order.
    while (
      pendingLines.length > 0 &&
      !isRunning &&
      !awaitingAsk &&
      !rl.closed
    ) {
      const next = pendingLines.shift();
      await processLine(next);
    }
  }

  rl.on("line", (line) => {
    void handleLine(line).catch((err) => {
      console.log(
        `  ${colors.error(figures.cross)} ${chalk.white("Unexpected Error: " + err.message)}`,
      );
      isRunning = false;
      try {
        rl.resume();
      } catch {}
      if (!rl.closed) showPrompt();
    });
  });

  rl.on("SIGINT", () => {
    // Cancel a pending `ask` instead of killing the REPL
    if (awaitingAsk && pendingAskResolve) {
      const resolve = pendingAskResolve;
      pendingAskResolve = null;
      awaitingAsk = false;
      console.log("");
      console.log(colors.muted("  (input cancelled)"));
      resolve("");
      rl.setPrompt(mainPrompt);
      rl.prompt();
      return;
    }
    if (isRunning) {
      sigintDuringRun++;
      if (sigintDuringRun >= 2) {
        console.log(colors.muted("\n  Force quitting."));
        saveSessionHistory(rl, typedHistory, preloadedHistory);
        process.exit(130);
      }
      console.log(
        colors.muted("\n  (busy — finishing current run, Ctrl+C again to force quit)"),
      );
      return;
    }
    if (buffer.trim()) {
      buffer = "";
      console.log(colors.muted("  ^C (buffer cleared)"));
      showPrompt();
      return;
    }
    const now = Date.now();
    if (now - lastSigint < 2000) {
      console.log("");
      console.log(colors.secondary("  Keep your ideas running.") + colors.primary("  eaze.\n"));
      saveSessionHistory(rl, typedHistory, preloadedHistory);
      process.exit(0);
    }
    lastSigint = now;
    console.log(colors.muted("  (press Ctrl+C again or type exit to quit)"));
    showPrompt();
  });

  rl.on("close", () => {
    saveSessionHistory(rl, typedHistory, preloadedHistory);
    process.exit(0);
  });
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
async function main() {
  const { opts, errors } = parseArgs(process.argv.slice(2));

  if (opts.noColor || process.env.NO_COLOR !== undefined) {
    try {
      chalk.level = 0;
    } catch {}
  }

  if (errors.length > 0) {
    errors.forEach((e) =>
      console.error(`  ${colors.error(figures.cross)} ${e}`),
    );
    printCliHelp();
    process.exitCode = 2;
    return;
  }

  if (opts.help) {
    printCliHelp();
    return;
  }

  if (opts.version) {
    console.log(`eaze v${VERSION}`);
    return;
  }

  if (opts.evalCode !== null) {
    const ok = await runEval(opts.evalCode, opts);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (opts.files.length > 0) {
    let failed = false;
    for (const file of opts.files) {
      const ok = await runFile(file, opts);
      if (!ok) failed = true;
    }
    process.exitCode = failed ? 1 : 0;
    return;
  }

  startREPL(opts);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
