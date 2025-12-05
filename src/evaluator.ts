import {
	ProgramNode,
	StatementNode,
	ExpressionNode,
	VariableNode,
	FunctionNode,
	IfNode,
	ForNode,
	WhileNode,
	ReturnNode,
	FunctionCallNode,
	AnonymousFunctionNode,
	BlockNode,
	StringNode,
	TemplateStringNode,
	NumberNode,
	BooleanNode,
	ArrayNode,
	ArrayIndexNode,
	ArrayIndexAssignmentNode,
	IdentifierNode,
	ConcatenationNode,
	BinaryOpNode,
	UnaryOpNode,
} from "./types/ast.types";

export class RuntimeError extends Error {
	constructor(message: string, public line: number, public column: number) {
		super(`Runtime error at line ${line}, column ${column}: ${message}`);
		this.name = "RuntimeError";
	}
}

export class ReturnValue {
	constructor(public value?: EvaluatedValue) {}
}

export interface EvaluatedValue {
	value: string | number | boolean | EvaluatedValue[];
	isMarkdown: boolean;
	styles?: string[];
	children?: EvaluatedValue[];
}

export interface FunctionDefinition {
	params: string[];
	styles: string[];
	body: StatementNode[];
}

export class ExecutionContext {
	private variables: Map<string, EvaluatedValue> = new Map();
	private functions: Map<string, FunctionDefinition> = new Map();
	private parent?: ExecutionContext;
	private globalContext?: ExecutionContext;

	constructor(parent?: ExecutionContext, globalContext?: ExecutionContext) {
		this.parent = parent;
		this.globalContext = globalContext;
	}

	setGlobalContext(global: ExecutionContext): void {
		this.globalContext = global;
	}

	getGlobalContext(): ExecutionContext | undefined {
		return this.globalContext;
	}

	setVariable(
		name: string,
		value: EvaluatedValue,
		isGlobal: boolean = false
	): void {
		if (isGlobal && this.globalContext) {
			this.globalContext.variables.set(name, value);
		} else {
			if (this.globalContext && this.globalContext.variables.has(name)) {
				this.globalContext.variables.set(name, value);
			} else {
				this.variables.set(name, value);
			}
		}
	}

	getVariable(name: string): EvaluatedValue | undefined {
		const value = this.variables.get(name);
		if (value !== undefined) {
			return value;
		}

		if (this.globalContext) {
			const globalValue = this.globalContext.variables.get(name);
			if (globalValue !== undefined) {
				return globalValue;
			}
		}

		return this.parent?.getVariable(name);
	}

	hasVariable(name: string): boolean {
		return (
			this.variables.has(name) ||
			(this.globalContext?.variables.has(name) ?? false) ||
			(this.parent?.hasVariable(name) ?? false)
		);
	}

	isGlobalVariable(name: string): boolean {
		return this.globalContext?.variables.has(name) ?? false;
	}

	setFunction(
		name: string,
		func: FunctionDefinition,
		isGlobal: boolean = false
	): void {
		if (isGlobal && this.globalContext) {
			this.globalContext.functions.set(name, func);
		} else {
			this.functions.set(name, func);
		}
	}

	getFunction(name: string): FunctionDefinition | undefined {
		const func = this.functions.get(name);
		if (func !== undefined) {
			return func;
		}

		if (this.globalContext) {
			const globalFunc = this.globalContext.functions.get(name);
			if (globalFunc !== undefined) {
				return globalFunc;
			}
		}

		return this.parent?.getFunction(name);
	}

	hasFunction(name: string): boolean {
		return (
			this.functions.has(name) ||
			(this.globalContext?.functions.has(name) ?? false) ||
			(this.parent?.hasFunction(name) ?? false)
		);
	}

	clear(): void {
		this.variables.clear();
		this.functions.clear();
	}

	getAllVariables(): Map<string, EvaluatedValue> {
		return new Map(this.variables);
	}

	getAllFunctions(): Map<string, FunctionDefinition> {
		return new Map(this.functions);
	}
}

export class Evaluator {
	private context: ExecutionContext;

	constructor(context?: ExecutionContext) {
		this.context = context || new ExecutionContext();
	}

	getContext(): ExecutionContext {
		return this.context;
	}

	evaluate(program: ProgramNode): EvaluatedValue[] {
		const results: EvaluatedValue[] = [];

		for (const statement of program.statements) {
			const result = this.evaluateStatement(statement);
			if (result) {
				results.push(result);
			}
		}

		return results;
	}

	private evaluateStatement(statement: StatementNode): EvaluatedValue | null {
		switch (statement.type) {
			case "Variable":
				return this.evaluateVariableDeclaration(
					statement as VariableNode
				);
			case "Function":
				return this.evaluateFunctionDefinition(
					statement as FunctionNode
				);
			case "ArrayIndexAssignment":
				return this.evaluateArrayIndexAssignment(
					statement as ArrayIndexAssignmentNode
				);
			case "Return":
				return this.evaluateReturn(statement as ReturnNode);
			case "If":
				return this.evaluateIfStatement(statement as IfNode);
			case "For":
				return this.evaluateForStatement(statement as ForNode);
			case "While":
				return this.evaluateWhileStatement(statement as WhileNode);
			case "String":
			case "TemplateString":
			case "Number":
			case "Boolean":
			case "Identifier":
			case "Array":
			case "ArrayIndex":
			case "Concatenation":
			case "BinaryOp":
			case "UnaryOp":
			case "FunctionCall":
			case "AnonymousFunction":
			case "Block":
				return this.evaluateExpression(statement as ExpressionNode);
			default:
				throw new RuntimeError(
					`Unknown statement type: ${(statement as any).type}`,
					(statement as any).line,
					(statement as any).column
				);
		}
	}

	private evaluateVariableDeclaration(node: VariableNode): null {
		const value = this.evaluateExpression(node.value);
		this.context.setVariable(node.name, value, node.isGlobal);
		return null;
	}

	private evaluateExpression(expr: ExpressionNode): EvaluatedValue {
		switch (expr.type) {
			case "String":
				return this.evaluateString(expr as StringNode);
			case "TemplateString":
				return this.evaluateTemplateString(expr as TemplateStringNode);
			case "Number":
				return this.evaluateNumber(expr as NumberNode);
			case "Boolean":
				return this.evaluateBoolean(expr as BooleanNode);
			case "Array":
				return this.evaluateArray(expr as ArrayNode);
			case "ArrayIndex":
				return this.evaluateArrayIndex(expr as ArrayIndexNode);
			case "Identifier":
				return this.evaluateIdentifier(expr as IdentifierNode);
			case "Concatenation":
				return this.evaluateConcatenation(expr as ConcatenationNode);
			case "BinaryOp":
				return this.evaluateBinaryOp(expr as BinaryOpNode);
			case "UnaryOp":
				return this.evaluateUnaryOp(expr as UnaryOpNode);
			case "FunctionCall":
				return this.evaluateFunctionCall(expr as FunctionCallNode);
			case "AnonymousFunction":
				return this.evaluateAnonymousFunction(
					expr as AnonymousFunctionNode
				);
			case "Block":
				return this.evaluateBlock(expr as BlockNode);
			default:
				throw new RuntimeError(
					`Unknown expression type: ${(expr as any).type}`,
					(expr as any).line,
					(expr as any).column
				);
		}
	}

	private convertCodeBlocks(text: string): string {
		return text.replace(/:::([a-zA-Z0-9]*)/g, "```$1");
	}

	private evaluateString(node: StringNode): EvaluatedValue {
		const value = node.isMarkdown
			? this.convertCodeBlocks(node.value)
			: node.value;
		return {
			value,
			isMarkdown: node.isMarkdown,
		};
	}

	private evaluateTemplateString(node: TemplateStringNode): EvaluatedValue {
		let result = "";

		for (const part of node.parts) {
			if (part.type === "text") {
				result += part.value;
			} else {
				const value = this.evaluateExpression(part.expr);
				result += String(value.value);
			}
		}

		result = this.convertCodeBlocks(result);

		return {
			value: result,
			isMarkdown: true,
		};
	}

	private evaluateNumber(node: NumberNode): EvaluatedValue {
		return {
			value: node.value,
			isMarkdown: true,
		};
	}

	private evaluateBoolean(node: BooleanNode): EvaluatedValue {
		return {
			value: node.value,
			isMarkdown: false,
		};
	}

	private evaluateArray(node: ArrayNode): EvaluatedValue {
		const elements = node.elements.map((elem) =>
			this.evaluateExpression(elem)
		);
		return {
			value: elements,
			isMarkdown: false,
		};
	}

	private evaluateArrayIndex(node: ArrayIndexNode): EvaluatedValue {
		const arrayValue = this.evaluateExpression(node.array);
		const indexValue = this.evaluateExpression(node.index);

		if (!Array.isArray(arrayValue.value)) {
			throw new RuntimeError(
				`Cannot index non-array value (got ${typeof arrayValue.value})`,
				node.line,
				node.column
			);
		}

		if (typeof indexValue.value !== "number") {
			throw new RuntimeError(
				`Array index must be a number (got ${typeof indexValue.value})`,
				node.line,
				node.column
			);
		}

		const index = Math.floor(indexValue.value);
		const array = arrayValue.value as EvaluatedValue[];

		if (index < 0 || index >= array.length) {
			throw new RuntimeError(
				`Array index out of bounds: ${index} (array length: ${array.length})`,
				node.line,
				node.column
			);
		}

		return array[index];
	}

	private evaluateArrayIndexAssignment(node: ArrayIndexAssignmentNode): null {
		const value = this.evaluateExpression(node.value);

		if (node.array.type !== "Identifier") {
			throw new RuntimeError(
				`Can only assign to array variable, not expression`,
				node.line,
				node.column
			);
		}

		const arrayName = (node.array as IdentifierNode).name;
		const arrayValue = this.context.getVariable(arrayName);

		if (arrayValue === undefined) {
			throw new RuntimeError(
				`Undefined variable: ${arrayName}`,
				node.line,
				node.column
			);
		}

		if (!Array.isArray(arrayValue.value)) {
			throw new RuntimeError(
				`Cannot index non-array value (got ${typeof arrayValue.value})`,
				node.line,
				node.column
			);
		}

		const indexValue = this.evaluateExpression(node.index);

		if (typeof indexValue.value !== "number") {
			throw new RuntimeError(
				`Array index must be a number (got ${typeof indexValue.value})`,
				node.line,
				node.column
			);
		}

		const index = Math.floor(indexValue.value);
		const array = arrayValue.value as EvaluatedValue[];

		if (index < 0 || index >= array.length) {
			throw new RuntimeError(
				`Array index out of bounds: ${index} (array length: ${array.length})`,
				node.line,
				node.column
			);
		}

		array[index] = value;

		return null;
	}

	private evaluateIdentifier(node: IdentifierNode): EvaluatedValue {
		const value = this.context.getVariable(node.name);

		if (value === undefined) {
			throw new RuntimeError(
				`Undefined variable: ${node.name}`,
				node.line,
				node.column
			);
		}

		return value;
	}

	private evaluateConcatenation(node: ConcatenationNode): EvaluatedValue {
		const parts = node.parts.map((part) => this.evaluateExpression(part));

		const concatenated = parts.map((p) => p.value).join("");

		const isMarkdown = parts.some((p) => p.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
		};
	}

	private evaluateBinaryOp(node: BinaryOpNode): EvaluatedValue {
		if (["==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
			const left = this.evaluateExpression(node.left);
			const right = this.evaluateExpression(node.right);

			let result: boolean;
			switch (node.operator) {
				case "==":
					result = left.value === right.value;
					break;
				case "!=":
					result = left.value !== right.value;
					break;
				case "<":
					result = (left.value as number) < (right.value as number);
					break;
				case "<=":
					result = (left.value as number) <= (right.value as number);
					break;
				case ">":
					result = (left.value as number) > (right.value as number);
					break;
				case ">=":
					result = (left.value as number) >= (right.value as number);
					break;
				default:
					throw new RuntimeError(
						`Unknown comparison operator: ${node.operator}`,
						node.line,
						node.column
					);
			}

			return {
				value: result,
				isMarkdown: false,
			};
		}

		if (node.operator === "&&" || node.operator === "||") {
			const left = this.evaluateExpression(node.left);
			const leftBool = this.toBoolean(left.value);

			if (node.operator === "&&" && !leftBool) {
				return { value: false, isMarkdown: false };
			}
			if (node.operator === "||" && leftBool) {
				return { value: true, isMarkdown: false };
			}

			const right = this.evaluateExpression(node.right);
			const rightBool = this.toBoolean(right.value);

			return {
				value: node.operator === "&&" ? rightBool : rightBool,
				isMarkdown: false,
			};
		}

		const left = this.evaluateExpression(node.left);
		const right = this.evaluateExpression(node.right);

		if (node.operator === "+") {
			if (
				typeof left.value === "string" ||
				typeof right.value === "string"
			) {
				return {
					value: String(left.value) + String(right.value),
					isMarkdown: left.isMarkdown || right.isMarkdown,
				};
			}

			return {
				value: (left.value as number) + (right.value as number),
				isMarkdown: true,
			};
		}

		const leftNum = this.toNumber(left.value, node.line, node.column);
		const rightNum = this.toNumber(right.value, node.line, node.column);

		let result: number;
		switch (node.operator) {
			case "-":
				result = leftNum - rightNum;
				break;
			case "*":
				result = leftNum * rightNum;
				break;
			case "/":
				if (rightNum === 0) {
					throw new RuntimeError(
						"Division by zero",
						node.line,
						node.column
					);
				}
				result = leftNum / rightNum;
				break;
			case "%":
				if (rightNum === 0) {
					throw new RuntimeError(
						"Modulo by zero",
						node.line,
						node.column
					);
				}
				result = leftNum % rightNum;
				break;
			default:
				throw new RuntimeError(
					`Unknown binary operator: ${node.operator}`,
					node.line,
					node.column
				);
		}

		return {
			value: result,
			isMarkdown: true,
		};
	}

	private evaluateUnaryOp(node: UnaryOpNode): EvaluatedValue {
		if (node.operator === "!") {
			const operand = this.evaluateExpression(node.operand);
			const boolValue = this.toBoolean(operand.value);
			return {
				value: !boolValue,
				isMarkdown: false,
			};
		}

		if (node.operator === "-") {
			const operand = this.evaluateExpression(node.operand);
			const numValue = this.toNumber(
				operand.value,
				node.line,
				node.column
			);
			return {
				value: -numValue,
				isMarkdown: true,
			};
		}

		if (!("name" in node.operand)) {
			throw new RuntimeError(
				`${node.operator} requires a variable`,
				node.line,
				node.column
			);
		}

		const current = this.context.getVariable(node.operand.name);
		if (current === undefined) {
			throw new RuntimeError(
				`Undefined variable: ${node.operand.name}`,
				node.line,
				node.column
			);
		}

		const currentNum = this.toNumber(current.value, node.line, node.column);

		const newValue =
			node.operator === "++" ? currentNum + 1 : currentNum - 1;

		const isGlobalVar = this.context.isGlobalVariable(node.operand.name);

		this.context.setVariable(
			node.operand.name,
			{
				value: newValue,
				isMarkdown: true,
			},
			isGlobalVar
		);

		return {
			value: node.prefix ? newValue : currentNum,
			isMarkdown: true,
		};
	}

	private toNumber(
		value: string | number | boolean | EvaluatedValue[],
		line: number,
		column: number
	): number {
		if (typeof value === "number") {
			return value;
		}
		if (typeof value === "boolean") {
			return value ? 1 : 0;
		}
		if (Array.isArray(value)) {
			throw new RuntimeError(
				`Cannot convert array to number`,
				line,
				column
			);
		}
		const num = parseFloat(value);
		if (isNaN(num)) {
			throw new RuntimeError(
				`Cannot convert "${value}" to number`,
				line,
				column
			);
		}
		return num;
	}

	private toBoolean(
		value: string | number | boolean | EvaluatedValue[]
	): boolean {
		if (typeof value === "boolean") {
			return value;
		}
		if (typeof value === "number") {
			return value !== 0;
		}
		if (Array.isArray(value)) {
			return true;
		}

		return value !== "";
	}

	private evaluateFunctionDefinition(node: FunctionNode): null {
		this.context.setFunction(
			node.name,
			{
				params: node.params,
				styles: node.styles,
				body: node.body,
			},
			node.isGlobal
		);
		return null;
	}

	private evaluateReturn(node: ReturnNode): never {
		if (node.value) {
			const value = this.evaluateExpression(node.value);
			throw new ReturnValue(value);
		} else {
			throw new ReturnValue();
		}
	}

	private evaluateIfStatement(node: IfNode): EvaluatedValue | null {
		const conditionResult = this.evaluateExpression(node.condition);
		const conditionValue = this.toBoolean(conditionResult.value);

		if (conditionValue) {
			return this.evaluateStatementBlock(node.then);
		}

		for (const elseIf of node.elseIfs) {
			const elseIfCondition = this.evaluateExpression(elseIf.condition);
			const elseIfValue = this.toBoolean(elseIfCondition.value);

			if (elseIfValue) {
				return this.evaluateStatementBlock(elseIf.then);
			}
		}

		if (node.else) {
			return this.evaluateStatementBlock(node.else);
		}

		return null;
	}

	private evaluateForStatement(node: ForNode): EvaluatedValue | null {
		this.evaluateStatement(node.init);

		const results: EvaluatedValue[] = [];

		while (true) {
			const conditionValue = this.evaluateExpression(node.condition);
			const conditionBoolean = this.toBoolean(conditionValue.value);

			if (!conditionBoolean) {
				break;
			}

			for (const stmt of node.body) {
				const result = this.evaluateStatement(stmt);
				if (result !== null) {
					results.push(result);
				}
			}

			this.evaluateExpression(node.update);
		}

		if (results.length === 0) {
			return null;
		}

		if (results.length === 1) {
			return results[0];
		}

		const concatenated = results.map((r) => r.value).join(" ");
		const isMarkdown = results.some((r) => r.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
		};
	}

	private evaluateWhileStatement(node: WhileNode): EvaluatedValue | null {
		const results: EvaluatedValue[] = [];

		while (true) {
			const conditionValue = this.evaluateExpression(node.condition);
			const conditionBoolean = this.toBoolean(conditionValue.value);

			if (!conditionBoolean) {
				break;
			}

			for (const stmt of node.body) {
				const result = this.evaluateStatement(stmt);
				if (result !== null) {
					results.push(result);
				}
			}
		}

		if (results.length === 0) {
			return null;
		}

		if (results.length === 1) {
			return results[0];
		}

		const concatenated = results.map((r) => r.value).join(" ");
		const isMarkdown = results.some((r) => r.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
		};
	}

	private evaluateStatementBlock(
		statements: StatementNode[]
	): EvaluatedValue | null {
		let lastValue: EvaluatedValue | null = null;

		for (const stmt of statements) {
			const result = this.evaluateStatement(stmt);
			if (result !== null) {
				lastValue = result;
			}
		}

		return lastValue;
	}

	private evaluateFunctionCall(node: FunctionCallNode): EvaluatedValue {
		const funcDef = this.context.getFunction(node.name);

		if (!funcDef) {
			throw new RuntimeError(
				`Undefined function: ${node.name}`,
				node.line,
				node.column
			);
		}

		const argValues = node.args.map((arg) => this.evaluateExpression(arg));

		return this.executeFunction(funcDef, argValues, node.line, node.column);
	}

	private evaluateAnonymousFunction(
		node: AnonymousFunctionNode
	): EvaluatedValue {
		const argValues = node.args.map((arg) => this.evaluateExpression(arg));

		const concatenated = argValues.map((v) => v.value).join(" ");
		const isMarkdown = argValues.some((v) => v.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
			styles: node.styles.length > 0 ? node.styles : undefined,
		};
	}

	private evaluateBlock(node: BlockNode): EvaluatedValue {
		const results: EvaluatedValue[] = [];
		for (const stmt of node.body) {
			const result = this.evaluateStatement(stmt);
			if (result) {
				results.push(result);
			}
		}

		if (results.length === 0) {
			return {
				value: "",
				isMarkdown: true,
				styles: node.styles.length > 0 ? node.styles : undefined,
			};
		}

		if (results.length === 1) {
			return {
				...results[0],
				styles:
					node.styles.length > 0 ? node.styles : results[0].styles,
			};
		}

		const concatenated = results.map((r) => r.value).join(" ");
		const isMarkdown = results.some((r) => r.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
			styles: node.styles.length > 0 ? node.styles : undefined,
			children: results,
		};
	}

	private executeFunction(
		funcDef: FunctionDefinition,
		args: EvaluatedValue[],
		line: number,
		column: number
	): EvaluatedValue {
		const funcContext = new ExecutionContext(this.context);

		const globalCtx = this.context.getGlobalContext();
		if (globalCtx) {
			funcContext.setGlobalContext(globalCtx);
		}

		for (let i = 0; i < funcDef.params.length; i++) {
			const paramName = funcDef.params[i];
			const argValue = args[i];

			if (argValue === undefined) {
				throw new RuntimeError(
					`Missing argument for parameter ${paramName}`,
					line,
					column
				);
			}

			funcContext.setVariable(paramName, argValue);
		}

		if (!funcContext.hasVariable("@content")) {
			funcContext.setVariable(
				"@content",
				args[0] || { value: "", isMarkdown: true }
			);
		}

		const funcEvaluator = new Evaluator(funcContext);

		const results: EvaluatedValue[] = [];
		try {
			for (const stmt of funcDef.body) {
				const result = funcEvaluator["evaluateStatement"](stmt);
				if (result) {
					results.push(result);
				}
			}
		} catch (e) {
			if (e instanceof ReturnValue) {
				if (e.value) {
					return {
						...e.value,
						styles:
							funcDef.styles.length > 0
								? funcDef.styles
								: e.value.styles,
					};
				} else {
					return { value: "", isMarkdown: true };
				}
			}

			throw e;
		}

		if (results.length === 0) {
			return { value: "", isMarkdown: true };
		}

		if (results.length === 1) {
			return {
				...results[0],
				styles:
					funcDef.styles.length > 0
						? funcDef.styles
						: results[0].styles,
			};
		}

		const concatenated = results.map((r) => r.value).join(" ");
		const isMarkdown = results.some((r) => r.isMarkdown);

		return {
			value: concatenated,
			isMarkdown,
			styles: funcDef.styles.length > 0 ? funcDef.styles : undefined,
			children: results,
		};
	}
}
