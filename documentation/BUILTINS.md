# Booleans, modulo, and built-in functions

Use `true` and `false` as boolean values, including in arrays and conditions.
They are reserved words; existing variables with those names must be renamed.
`modulo` is also reserved. Write `10 modulo 3` or `10 % 3`; both return `1`.
Modulo has the same precedence as multiplication/division, requires numbers,
and rejects zero divisors. Negative results follow the dividend: `-10 modulo 3` is `-1`.

Functions use Eaze's existing `call` syntax:

```eaze
set ready to true
set items to [1, 2]
call append(items, 3)
if ready and not false
    say call length(items)
    say call uppercase("hello")
    say 10 modulo 3
end
```

| Function | Alias | Result |
| --- | --- | --- |
| `call length(value)` | — | Array length or string length in UTF-16 code units |
| `call append(items, value)` | `push` | Mutates the array and returns its new length |
| `call remove_last(items)` | `pop` | Mutates the array and returns the last item; undefined when empty |
| `call uppercase(text)` | `upper` | Uppercase text |
| `call lowercase(text)` | `lower` | Lowercase text |
| `call round(number)` | — | Nearest integer; half-way values round toward positive infinity |
| `call absolute(number)` | `abs` | Absolute value |
| `call square_root(number)` | `sqrt` | Square root; rejects negative values |
| `call minimum(a, b)` | `min` | Smaller of two numbers |
| `call maximum(a, b)` | `max` | Larger of two numbers |
| `call random()` | — | Random number greater than or equal to 0 and less than 1 |

Built-ins validate argument counts and types; math functions require finite numbers.
Arguments execute from left to right. User-defined functions and variables take
priority over built-ins. Built-ins do not appear in the variable tracker.
See `examples/builtins.eaze` for a runnable example.
