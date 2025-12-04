export interface ASTNode {
	type: string;
	line: number;
	column: number;
}

export interface StringNode extends ASTNode {
	type: "String";
	value: string;
	isMarkdown: boolean;
}

export interface TemplateStringNode extends ASTNode {
	type: "TemplateString";
	parts: Array<
		| { type: "text"; value: string }
		| { type: "expression"; expr: ExpressionNode }
	>;
}

export interface NumberNode extends ASTNode {
	type: "Number";
	value: number;
}

export interface IdentifierNode extends ASTNode {
	type: "Identifier";
	name: string;
}

export interface ConcatenationNode extends ASTNode {
	type: "Concatenation";
	parts: ExpressionNode[];
}

export interface BinaryOpNode extends ASTNode {
	type: "BinaryOp";
	operator: "+" | "-" | "*" | "/" | "%";
	left: ExpressionNode;
	right: ExpressionNode;
}

export interface UnaryOpNode extends ASTNode {
	type: "UnaryOp";
	operator: "++" | "--";
	operand: IdentifierNode;
	prefix: boolean;
}

export interface VariableNode extends ASTNode {
	type: "Variable";
	name: string;
	value: ExpressionNode;
}

export interface FunctionNode extends ASTNode {
	type: "Function";
	name: string;
	params: string[];
	styles: string[];
	body: StatementNode[];
}

export interface FunctionCallNode extends ASTNode {
	type: "FunctionCall";
	name: string;
	args: ExpressionNode[];
}

export interface AnonymousFunctionNode extends ASTNode {
	type: "AnonymousFunction";
	args: ExpressionNode[];
	styles: string[];
}

export interface BlockNode extends ASTNode {
	type: "Block";
	body: StatementNode[];
	styles: string[];
}

export type ExpressionNode =
	| StringNode
	| TemplateStringNode
	| NumberNode
	| IdentifierNode
	| ConcatenationNode
	| BinaryOpNode
	| UnaryOpNode
	| FunctionCallNode
	| AnonymousFunctionNode
	| BlockNode;

export type StatementNode = VariableNode | FunctionNode | ExpressionNode;

export interface ProgramNode extends ASTNode {
	type: "Program";
	statements: StatementNode[];
}

export class ParseError extends Error {
	constructor(message: string, public line: number, public column: number) {
		super(`Parse error at line ${line}, column ${column}: ${message}`);
		this.name = "ParseError";
	}
}
