# Eaze CLI

Run `npm start` for an interactive session or `node cli/index.js --help` for flags.
The compact welcome message leaves space for your code. Help stacks its columns
on narrow terminals and wraps descriptions instead of truncating them.

```text
eaze › set ready to true
  ✓ Done
eaze › repeat 2 times
  2 │ say ready
  3 │ end
  ▸ true
  ▸ true
```

- Tab completes keywords, built-in function names, commands, and variables.
- Up-arrow recalls history. Multiline prompts show the next line number.
- `help`, `h`, and `?` show the language guide. Commands accept a leading dot
  and are case-insensitive, except the existing `Eaze` easter egg.
- `vars` shows current variables and functions. `reset` clears those values.
- `load "path with spaces.eaze"` runs a file; `save <file>` saves session code.
- `tokens`, `ast`, and `time` toggle diagnostics; add `on` or `off` explicitly.
- Ctrl+C discards an unfinished block. At the main prompt, press it twice to quit.
- Parse and lexer errors show a line number and caret. Use `explain` in a
  session to ask the configured AI server about the last error.

Use `--check` to check a file without running it. Output colors respect
`--no-color` and the presence of `NO_COLOR`. Existing exit codes remain:
0 for success, 1 for program/file errors, and 2 for invalid command-line options.
