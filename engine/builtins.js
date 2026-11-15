import { RuntimeError } from "./errors.js";

const FUNCTIONS = {
  length: ["sequence", value => value.length],
  append: ["array any", (items, value) => items.push(value)],
  remove_last: ["array", items => items.pop()],
  uppercase: ["text", text => text.toUpperCase()],
  lowercase: ["text", text => text.toLowerCase()],
  round: ["number", Math.round],
  absolute: ["number", Math.abs],
  square_root: ["number", value => {
    if (value < 0) throw new RuntimeError("Square root needs a non-negative number");
    return Math.sqrt(value);
  }],
  minimum: ["number number", Math.min],
  maximum: ["number number", Math.max],
  random: ["", Math.random],
};
for (const [alias, name] of Object.entries({ push: "append", pop: "remove_last", upper: "uppercase", lower: "lowercase", abs: "absolute", sqrt: "square_root", min: "minimum", max: "maximum" })) FUNCTIONS[alias] = FUNCTIONS[name];
const TYPES = {
  any: () => true,
  array: Array.isArray,
  text: value => typeof value === "string",
  sequence: value => typeof value === "string" || Array.isArray(value),
  number: value => typeof value === "number" && Number.isFinite(value),
};

export async function callBuiltin(node, evaluate) {
  if (!Object.hasOwn(FUNCTIONS, node.name)) return null;
  const [signature, fn] = FUNCTIONS[node.name];
  const types = signature ? signature.split(" ") : [];
  if (types.length !== node.arguments.length) throw new RuntimeError(`Function '${node.name}' expects ${types.length} arguments but got ${node.arguments.length}`);
  const args = [];
  for (const [index, argument] of node.arguments.entries()) {
    const value = await evaluate(argument);
    if (!TYPES[types[index]](value)) throw new RuntimeError(`Function '${node.name}' argument ${index + 1} must be ${types[index]}`);
    args.push(value);
  }
  return { value: fn(...args) };
}
