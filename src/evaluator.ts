import {
	ProgramNode,
	StatementNode,
	ExpressionNode,
	VariableNode,
	FunctionNode,
	FunctionCallNode,
	AnonymousFunctionNode,
	BlockNode,
	StringNode,
	TemplateStringNode,
	NumberNode,
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

export interface EvaluatedValue {
	value: string | number;
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

	constructor(parent?: ExecutionContext) {
		this.parent = parent;
	}

	setVariable(name: string, value: EvaluatedValue): void {
		this.variables.set(name, value);
	}

	getVariable(name: string): EvaluatedValue | undefined {
		const value = this.variables.get(name);
		if (value !== undefined) {
			return value;
		}

		return this.parent?.getVariable(name);
	}

	hasVariable(name: string): boolean {
		return (
			this.variables.has(name) ||
			(this.parent?.hasVariable(name) ?? false)
		);
	}

	setFunction(name: string, func: FunctionDefinition): void {
		this.functions.set(name, func);
	}

	getFunction(name: string): FunctionDefinition | undefined {
		const func = this.functions.get(name);
		if (func !== undefined) {
			return func;
		}

		return this.parent?.getFunction(name);
	}

	hasFunction(name: string): boolean {
		return (
			this.functions.has(name) ||
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
			case "String":
			case "TemplateString":
			case "Number":
			case "Identifier":
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
		this.context.setVariable(node.name, value);
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

		this.context.setVariable(node.operand.name, {
			value: newValue,
			isMarkdown: true,
		});

		return {
			value: node.prefix ? newValue : currentNum,
			isMarkdown: true,
		};
	}

	private toNumber(
		value: string | number,
		line: number,
		column: number
	): number {
		if (typeof value === "number") {
			return value;
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

	private evaluateFunctionDefinition(node: FunctionNode): null {
		this.context.setFunction(node.name, {
			params: node.params,
			styles: node.styles,
			body: node.body,
		});
		return null;
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
		for (const stmt of funcDef.body) {
			const result = funcEvaluator["evaluateStatement"](stmt);
			if (result) {
				results.push(result);
			}
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
