import { Environment } from "./runtime.js";
import { RuntimeError } from "./errors.js";

class ReturnValue {
  constructor(value) {
    this.value = value;
  }
}

const BINARY_OPS = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => {
    if (b === 0) throw new RuntimeError("Division by zero");
    return a / b;
  },
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  "<": (a, b) => a < b,
  ">": (a, b) => a > b,
  "<=": (a, b) => a <= b,
  ">=": (a, b) => a >= b,
};

export class Interpreter {
  constructor() {
    this.globalEnv = new Environment();
    this.output = [];
    this.outputHandler = null;
    this.inputHandler = (message) => {
      // Default input handler if not overridden
      console.log(message);
      return "0";
    };
  }

  setInputHandler(handler) {
    this.inputHandler = handler;
  }

  setOutputHandler(handler) {
    this.outputHandler = handler;
  }

  async run(ast) {
    this.output = [];
    try {
      await this.evaluate(ast, this.globalEnv);
    } catch (e) {
      if (e instanceof ReturnValue) {
        throw new RuntimeError("Return statement outside function");
      }
      throw e;
    }
    return this.output;
  }

  async indexed(node, env) {
    const array = await this.evaluate(node.object, env);
    const index = await this.evaluate(node.index, env);
    if (!Array.isArray(array)) throw new RuntimeError("Can only index arrays");
    if (typeof index !== "number") throw new RuntimeError("Array index must be a number");
    return [array, index];
  }

  async evaluate(node, env) {
    if (!node) return null;

    switch (node.type) {
      case "Program":
        return this.evaluateBlock(node.body, env);

      case "Assignment": {
        const value = await this.evaluate(node.value, env);
        if (node.target.type === "Identifier") {
          env.set(node.target.name, value);
        } else if (node.target.type === "IndexExpression") {
          const [array, index] = await this.indexed(node.target, env);
          array[index] = value;
        } else {
          throw new RuntimeError("Invalid assignment target");
        }
        return value;
      }

      case "Show": {
        const value = await this.evaluate(node.value, env);
        this.output.push(value);
        if (this.outputHandler) await this.outputHandler(value);
        return null;
      }

      case "Ask": {
        const message = await this.evaluate(node.message, env);
        let answer = await this.inputHandler(message);
        // Attempt to parse to number if it looks like one
        const trimmed = answer.toString().trim();
        const num = parseFloat(trimmed);
        if (isFinite(num) && trimmed !== "") answer = num;
        env.set(node.identifier, answer);
        return null;
      }

      case "RepeatLoop": {
        const times = await this.evaluate(node.times, env);
        if (typeof times !== "number") {
          throw new RuntimeError(`Repeat count must be a number, got ${typeof times}`);
        }
        for (let i = 0; i < times; i++) {
          await this.evaluateBlock(node.body, new Environment(env));
        }
        return null;
      }

      case "WhileLoop":
        while (await this.evaluate(node.condition, env)) {
          await this.evaluateBlock(node.body, new Environment(env));
        }
        return null;

      case "IfStatement": {
        const body = (await this.evaluate(node.condition, env)) ? node.body : node.elseBody;
        if (body) await this.evaluateBlock(body, new Environment(env));
        return null;
      }

      case "ExpressionStatement":
        return this.evaluate(node.value, env);

      case "FunctionDeclaration":
        env.set(node.name, {
          isFunction: true,
          name: node.name,
          params: node.params,
          body: node.body,
          closure: env,
        });
        return null;

      case "FunctionCall": {
        const fn = env.get(node.name);
        if (!fn || !fn.isFunction) {
          throw new RuntimeError(`'${node.name}' is not a function`);
        }
        if (fn.params.length !== node.arguments.length) {
          throw new RuntimeError(
            `Function '${node.name}' expects ${fn.params.length} arguments but got ${node.arguments.length}`,
          );
        }
        const callEnv = new Environment(fn.closure);
        for (let i = 0; i < fn.params.length; i++) {
          callEnv.set(fn.params[i], await this.evaluate(node.arguments[i], env));
        }
        try {
          await this.evaluateBlock(fn.body, callEnv);
        } catch (e) {
          if (e instanceof ReturnValue) return e.value;
          throw e;
        }
        return null;
      }

      case "ReturnStatement":
        throw new ReturnValue(node.value ? await this.evaluate(node.value, env) : null);

      case "LogicalExpression": {
        const left = await this.evaluate(node.left, env);
        if (node.operator === "or") return left || this.evaluate(node.right, env);
        if (node.operator === "and") return !left ? left : this.evaluate(node.right, env);
        throw new RuntimeError(`Unknown logical operator: ${node.operator}`);
      }

      case "UnaryExpression": {
        const right = await this.evaluate(node.right, env);
        if (node.operator === "not") return !right;
        if (node.operator === "-") return -right;
        throw new RuntimeError(`Unknown unary operator: ${node.operator}`);
      }

      case "BinaryExpression": {
        const left = await this.evaluate(node.left, env);
        const right = await this.evaluate(node.right, env);
        const op = BINARY_OPS[node.operator];
        if (!op) throw new RuntimeError(`Unknown operator: ${node.operator}`);
        return op(left, right);
      }

      case "ArrayLiteral":
        return Promise.all(node.elements.map((el) => this.evaluate(el, env)));

      case "IndexExpression": {
        const [array, index] = await this.indexed(node, env);
        return array[index];
      }

      case "NumberLiteral":
      case "StringLiteral":
        return node.value;

      case "Identifier":
        return env.get(node.name);

      default:
        throw new RuntimeError(`Unknown AST node type: ${node.type}`);
    }
  }

  async evaluateBlock(statements, env) {
    let result = null;
    for (const statement of statements) {
      result = await this.evaluate(statement, env);
    }
    return result;
  }
}
