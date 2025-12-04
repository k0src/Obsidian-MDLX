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
	IdentifierNode,
	ConcatenationNode,
} from "./types/ast.types";

export class RuntimeError extends Error {
	constructor(message: string, public line: number, public column: number) {
		super(`Runtime error at line ${line}, column ${column}: ${message}`);
		this.name = "RuntimeError";
	}
}

export interface EvaluatedValue {
	value: string;
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
	private parent?: ExecutionContext; // For nested scopes

	constructor(parent?: ExecutionContext) {
		this.parent = parent;
	}

	// Variable methods
	setVariable(name: string, value: EvaluatedValue): void {
		this.variables.set(name, value);
	}

	getVariable(name: string): EvaluatedValue | undefined {
		const value = this.variables.get(name);
		if (value !== undefined) {
			return value;
		}
		// Check parent scope
		return this.parent?.getVariable(name);
	}

	hasVariable(name: string): boolean {
		return (
			this.variables.has(name) ||
			(this.parent?.hasVariable(name) ?? false)
		);
	}

	// Function methods
	setFunction(name: string, func: FunctionDefinition): void {
		this.functions.set(name, func);
	}

	getFunction(name: string): FunctionDefinition | undefined {
		const func = this.functions.get(name);
		if (func !== undefined) {
			return func;
		}
		// Check parent scope
		return this.parent?.getFunction(name);
	}

	hasFunction(name: string): boolean {
		return (
			this.functions.has(name) ||
			(this.parent?.hasFunction(name) ?? false)
		);
	}

	// Clear all
	clear(): void {
		this.variables.clear();
		this.functions.clear();
	}

	// For debugging
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
			case "Identifier":
			case "Concatenation":
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
			case "Identifier":
				return this.evaluateIdentifier(expr as IdentifierNode);
			case "Concatenation":
				return this.evaluateConcatenation(expr as ConcatenationNode);
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

	private evaluateString(node: StringNode): EvaluatedValue {
		return {
			value: node.value,
			isMarkdown: node.isMarkdown,
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
		// Evaluate the arguments
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
		// Evaluate all statements
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
		// Create a new scope
		const funcContext = new ExecutionContext(this.context);

		// Bind parameters to arguments
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

		// Add implicit @content parameter
		// @content gets the first argument by default or empty string
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
