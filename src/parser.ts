import { Token, TokenType } from "./types/lexer.types";
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
	IdentifierNode,
	ConcatenationNode,
	BinaryOpNode,
	UnaryOpNode,
	ArrayNode,
	ArrayIndexNode,
	ArrayIndexAssignmentNode,
	ParseError,
} from "./types/ast.types";
import { Lexer } from "./lexer";

export class Parser {
	private tokens: Token[];
	private current: number = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	parse(): ProgramNode {
		const statements: StatementNode[] = [];

		while (!this.isAtEnd()) {
			if (this.check(TokenType.NEWLINE)) {
				this.advance();
				continue;
			}

			const stmt = this.parseStatement();
			if (stmt) {
				statements.push(stmt);
			}
		}

		return {
			type: "Program",
			statements,
			line: 1,
			column: 1,
		};
	}

	private parseStatement(): StatementNode | null {
		while (this.check(TokenType.NEWLINE)) {
			this.advance();
		}

		if (this.isAtEnd()) {
			return null;
		}

		if (this.check(TokenType.IF)) {
			return this.parseIfStatement();
		}

		if (this.check(TokenType.FOR)) {
			return this.parseForStatement();
		}

		if (this.check(TokenType.WHILE)) {
			return this.parseWhileStatement();
		}

		if (this.check(TokenType.ARROW)) {
			return this.parseReturnStatement();
		}

		if (
			this.check(TokenType.GLOBAL) &&
			this.peekNext()?.type === TokenType.EQUALS
		) {
			const nameToken = this.peek();
			const name = nameToken.value;

			this.advance();
			this.advance();

			if (this.check(TokenType.LPAREN)) {
				return this.parseFunctionDefinition(
					name,
					nameToken.line,
					nameToken.column,
					true
				);
			} else {
				const value = this.parseExpression();
				return {
					type: "Variable",
					name,
					value,
					isGlobal: true,
					line: nameToken.line,
					column: nameToken.column,
				};
			}
		}

		if (this.check(TokenType.IDENTIFIER)) {
			const nameToken = this.peek();
			const name = nameToken.value;

			const nextToken = this.peekNext();

			if (nextToken?.type === TokenType.LBRACKET) {
				this.advance();

				const arrayExpr = this.parseArrayIndex({
					type: "Identifier",
					name,
					line: nameToken.line,
					column: nameToken.column,
				});

				if (this.check(TokenType.EQUALS)) {
					this.advance();
					const value = this.parseExpression();

					const arrayIndexNode = arrayExpr as ArrayIndexNode;
					return {
						type: "ArrayIndexAssignment",
						array: arrayIndexNode.array,
						index: arrayIndexNode.index,
						value,
						line: nameToken.line,
						column: nameToken.column,
					};
				} else {
					return arrayExpr;
				}
			}

			if (nextToken?.type === TokenType.EQUALS) {
				this.advance();
				this.advance();

				if (this.check(TokenType.LPAREN)) {
					return this.parseFunctionDefinition(
						name,
						nameToken.line,
						nameToken.column,
						false
					);
				} else {
					const value = this.parseExpression();
					return {
						type: "Variable",
						name,
						value,
						isGlobal: false,
						line: nameToken.line,
						column: nameToken.column,
					};
				}
			}
		}

		return this.parseExpression();
	}

	private parseFunctionDefinition(
		name: string,
		line: number,
		column: number,
		isGlobal: boolean = false
	): FunctionNode {
		const params = this.parseParameterList();

		const styles = this.check(TokenType.LBRACKET)
			? this.parseStyleList()
			: [];

		this.consume(TokenType.LBRACE, "Expected '{' to start function body");
		const body = this.parseStatementBlock();
		this.consume(TokenType.RBRACE, "Expected '}' to end function body");

		return {
			type: "Function",
			name,
			params,
			styles,
			body,
			isGlobal,
			line,
			column,
		};
	}

	private parseIfStatement(): IfNode {
		const ifToken = this.advance();
		this.skipNewlines();

		this.consume(TokenType.LPAREN, "Expected '(' after 'if'");
		this.skipNewlines();
		const condition = this.parseExpression();
		this.skipNewlines();
		this.consume(TokenType.RPAREN, "Expected ')' after if condition");
		this.skipNewlines();

		this.consume(TokenType.LBRACE, "Expected '{' after if condition");
		const then = this.parseStatementBlock();
		this.consume(TokenType.RBRACE, "Expected '}' to end if block");
		this.skipNewlines();

		const elseIfs: Array<{
			condition: ExpressionNode;
			then: StatementNode[];
		}> = [];
		let elseBlock: StatementNode[] | undefined;

		while (this.check(TokenType.ELSE)) {
			this.advance();
			this.skipNewlines();

			if (this.check(TokenType.IF)) {
				this.advance();
				this.skipNewlines();

				this.consume(TokenType.LPAREN, "Expected '(' after 'else if'");
				this.skipNewlines();
				const elseIfCondition = this.parseExpression();
				this.skipNewlines();
				this.consume(
					TokenType.RPAREN,
					"Expected ')' after else if condition"
				);
				this.skipNewlines();

				this.consume(
					TokenType.LBRACE,
					"Expected '{' after else if condition"
				);
				const elseIfThen = this.parseStatementBlock();
				this.consume(
					TokenType.RBRACE,
					"Expected '}' to end else if block"
				);
				this.skipNewlines();

				elseIfs.push({ condition: elseIfCondition, then: elseIfThen });
			} else {
				this.consume(TokenType.LBRACE, "Expected '{' after 'else'");
				elseBlock = this.parseStatementBlock();
				this.consume(
					TokenType.RBRACE,
					"Expected '}' to end else block"
				);
				break;
			}
		}

		return {
			type: "If",
			condition,
			then,
			elseIfs,
			else: elseBlock,
			line: ifToken.line,
			column: ifToken.column,
		};
	}

	private parseForStatement(): ForNode {
		const forToken = this.advance();
		this.skipNewlines();

		this.consume(TokenType.LPAREN, "Expected '(' after 'for'");
		this.skipNewlines();

		const init = this.parseStatement();
		if (!init) {
			throw new ParseError(
				"Expected initialization in for loop",
				forToken.line,
				forToken.column
			);
		}
		this.skipNewlines();

		this.consume(
			TokenType.COMMA,
			"Expected ',' after for loop initialization"
		);
		this.skipNewlines();

		const condition = this.parseExpression();
		this.skipNewlines();

		this.consume(TokenType.COMMA, "Expected ',' after for loop condition");
		this.skipNewlines();

		const update = this.parseExpression();
		this.skipNewlines();

		this.consume(TokenType.RPAREN, "Expected ')' after for loop header");
		this.skipNewlines();

		this.consume(TokenType.LBRACE, "Expected '{' after for loop header");
		const body = this.parseStatementBlock();
		this.consume(TokenType.RBRACE, "Expected '}' to end for loop body");

		return {
			type: "For",
			init,
			condition,
			update,
			body,
			line: forToken.line,
			column: forToken.column,
		};
	}

	private parseWhileStatement(): WhileNode {
		const whileToken = this.advance();
		this.skipNewlines();

		this.consume(TokenType.LPAREN, "Expected '(' after 'while'");
		this.skipNewlines();
		const condition = this.parseExpression();
		this.skipNewlines();
		this.consume(TokenType.RPAREN, "Expected ')' after while condition");
		this.skipNewlines();

		this.consume(TokenType.LBRACE, "Expected '{' after while condition");
		const body = this.parseStatementBlock();
		this.consume(TokenType.RBRACE, "Expected '}' to end while loop body");

		return {
			type: "While",
			condition,
			body,
			line: whileToken.line,
			column: whileToken.column,
		};
	}

	private parseReturnStatement(): ReturnNode {
		const arrowToken = this.advance();
		this.skipNewlines();

		if (
			this.check(TokenType.NEWLINE) ||
			this.check(TokenType.RBRACE) ||
			this.isAtEnd()
		) {
			return {
				type: "Return",
				line: arrowToken.line,
				column: arrowToken.column,
			};
		}

		const value = this.parseExpression();

		return {
			type: "Return",
			value,
			line: arrowToken.line,
			column: arrowToken.column,
		};
	}

	private parseStatementBlock(): StatementNode[] {
		const statements: StatementNode[] = [];

		while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
			if (this.check(TokenType.NEWLINE)) {
				this.advance();
				continue;
			}

			const stmt = this.parseStatement();
			if (stmt) {
				statements.push(stmt);
			}
		}

		return statements;
	}

	private parseParameterList(): string[] {
		this.consume(TokenType.LPAREN, "Expected '(' to start parameter list");

		const params: string[] = [];

		if (this.check(TokenType.RPAREN)) {
			this.advance();
			return params;
		}

		do {
			if (this.check(TokenType.COMMA)) {
				this.advance();
			}

			if (this.check(TokenType.IDENTIFIER)) {
				params.push(this.advance().value);
			} else if (!this.check(TokenType.RPAREN)) {
				throw new ParseError(
					"Expected parameter name (identifier)",
					this.peek().line,
					this.peek().column
				);
			}
		} while (this.check(TokenType.COMMA));

		this.consume(TokenType.RPAREN, "Expected ')' after parameter list");

		return params;
	}

	private parseStyleList(): string[] {
		this.consume(TokenType.LBRACKET, "Expected '[' to start style list");

		const styles: string[] = [];

		if (this.check(TokenType.RBRACKET)) {
			this.advance();
			return styles;
		}

		do {
			if (this.check(TokenType.COMMA)) {
				this.advance();
			}

			if (this.check(TokenType.NAME)) {
				styles.push(this.advance().value);
			} else if (!this.check(TokenType.RBRACKET)) {
				throw new ParseError(
					"Expected style class name",
					this.peek().line,
					this.peek().column
				);
			}
		} while (this.check(TokenType.COMMA));

		this.consume(TokenType.RBRACKET, "Expected ']' after style list");

		return styles;
	}

	private parseExpression(): ExpressionNode {
		return this.parseLogicalOr();
	}

	private parseLogicalOr(): ExpressionNode {
		let left = this.parseLogicalAnd();

		while (this.check(TokenType.OR)) {
			const operator = this.advance();
			this.skipNewlines();
			const right = this.parseLogicalAnd();

			left = {
				type: "BinaryOp",
				operator: "||",
				left,
				right,
				line: operator.line,
				column: operator.column,
			};
		}

		return left;
	}

	private parseLogicalAnd(): ExpressionNode {
		let left = this.parseComparison();

		while (this.check(TokenType.AND)) {
			const operator = this.advance();
			this.skipNewlines();
			const right = this.parseComparison();

			left = {
				type: "BinaryOp",
				operator: "&&",
				left,
				right,
				line: operator.line,
				column: operator.column,
			};
		}

		return left;
	}

	private parseComparison(): ExpressionNode {
		let left = this.parseAdditive();

		while (
			this.check(TokenType.EQUALS_EQUALS) ||
			this.check(TokenType.NOT_EQUALS) ||
			this.check(TokenType.LESS_THAN) ||
			this.check(TokenType.LESS_THAN_EQUALS) ||
			this.check(TokenType.GREATER_THAN) ||
			this.check(TokenType.GREATER_THAN_EQUALS)
		) {
			const operator = this.advance();
			this.skipNewlines();
			const right = this.parseAdditive();

			left = {
				type: "BinaryOp",
				operator: operator.value as
					| "=="
					| "!="
					| "<"
					| "<="
					| ">"
					| ">=",
				left,
				right,
				line: operator.line,
				column: operator.column,
			};
		}

		return left;
	}

	private parseAdditive(): ExpressionNode {
		let left = this.parseMultiplicative();

		while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
			const operator = this.advance();
			this.skipNewlines();
			const right = this.parseMultiplicative();

			left = {
				type: "BinaryOp",
				operator: operator.value as "+" | "-",
				left,
				right,
				line: operator.line,
				column: operator.column,
			};
		}

		return left;
	}

	private parseMultiplicative(): ExpressionNode {
		let left = this.parseUnary();

		while (
			this.check(TokenType.STAR) ||
			this.check(TokenType.SLASH) ||
			this.check(TokenType.PERCENT)
		) {
			const operator = this.advance();
			this.skipNewlines();
			const right = this.parseUnary();

			left = {
				type: "BinaryOp",
				operator: operator.value as "*" | "/" | "%",
				left,
				right,
				line: operator.line,
				column: operator.column,
			};
		}

		return left;
	}

	private parseUnary(): ExpressionNode {
		if (
			this.check(TokenType.PLUS_PLUS) ||
			this.check(TokenType.MINUS_MINUS)
		) {
			const operator = this.advance();
			this.skipNewlines();

			if (
				!this.check(TokenType.IDENTIFIER) &&
				!this.check(TokenType.GLOBAL)
			) {
				throw new ParseError(
					`Expected identifier after ${operator.value}`,
					this.peek().line,
					this.peek().column
				);
			}

			const operand = this.advance();
			return {
				type: "UnaryOp",
				operator: operator.value as "++" | "--",
				operand: {
					type: "Identifier",
					name: operand.value,
					line: operand.line,
					column: operand.column,
				},
				prefix: true,
				line: operator.line,
				column: operator.column,
			};
		}

		if (this.check(TokenType.NOT)) {
			const operator = this.advance();
			this.skipNewlines();
			const operand = this.parseUnary();

			return {
				type: "UnaryOp",
				operator: "!",
				operand,
				prefix: true,
				line: operator.line,
				column: operator.column,
			};
		}

		if (this.check(TokenType.MINUS)) {
			const operator = this.advance();
			this.skipNewlines();
			const operand = this.parseUnary();

			return {
				type: "UnaryOp",
				operator: "-",
				operand,
				prefix: true,
				line: operator.line,
				column: operator.column,
			};
		}

		const expr = this.parsePrimary();

		if (
			expr.type === "Identifier" &&
			(this.check(TokenType.PLUS_PLUS) ||
				this.check(TokenType.MINUS_MINUS))
		) {
			const operator = this.advance();
			return {
				type: "UnaryOp",
				operator: operator.value as "++" | "--",
				operand: expr,
				prefix: false,
				line: expr.line,
				column: expr.column,
			};
		}

		return expr;
	}

	private parsePrimary(): ExpressionNode {
		if (this.check(TokenType.LPAREN)) {
			this.advance();
			this.skipNewlines();
			const expr = this.parseExpression();
			this.skipNewlines();
			this.consume(TokenType.RPAREN, "Expected ')' after expression");
			return expr;
		}

		if (this.check(TokenType.BOOLEAN)) {
			const token = this.advance();
			return {
				type: "Boolean",
				value: token.value === "true",
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.NUMBER)) {
			const token = this.advance();
			return {
				type: "Number",
				value: parseFloat(token.value),
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.STRING)) {
			const token = this.advance();
			return {
				type: "String",
				value: token.value,
				isMarkdown: true,
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.TEMPLATE_STRING)) {
			const token = this.advance();
			return this.parseTemplateString(token);
		}

		if (this.check(TokenType.LITERAL_STRING)) {
			const token = this.advance();
			return {
				type: "String",
				value: token.value,
				isMarkdown: false,
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.GLOBAL)) {
			const token = this.advance();

			if (this.check(TokenType.LPAREN)) {
				return this.parseFunctionCall(
					token.value,
					token.line,
					token.column
				);
			}

			if (this.check(TokenType.LBRACKET)) {
				return this.parseArrayIndex({
					type: "Identifier",
					name: token.value,
					line: token.line,
					column: token.column,
				});
			}

			return {
				type: "Identifier",
				name: token.value,
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.IDENTIFIER)) {
			const token = this.advance();

			if (this.check(TokenType.LPAREN)) {
				return this.parseFunctionCall(
					token.value,
					token.line,
					token.column
				);
			}

			if (this.check(TokenType.LBRACKET)) {
				return this.parseArrayIndex({
					type: "Identifier",
					name: token.value,
					line: token.line,
					column: token.column,
				});
			}

			return {
				type: "Identifier",
				name: token.value,
				line: token.line,
				column: token.column,
			};
		}

		if (this.check(TokenType.AT)) {
			const token = this.advance();

			if (this.check(TokenType.LPAREN)) {
				return this.parseAnonymousFunction(token.line, token.column);
			}

			throw new ParseError(
				"Unexpected '@' token - expected identifier or function call",
				token.line,
				token.column
			);
		}

		if (this.check(TokenType.LBRACKET)) {
			return this.parseArrayLiteral();
		}

		if (this.check(TokenType.LBRACE)) {
			return this.parseBlock();
		}

		const token = this.peek();
		throw new ParseError(
			`Unexpected token: ${token.type} ('${token.value}')`,
			token.line,
			token.column
		);
	}

	private parseTemplateString(token: Token): TemplateStringNode {
		const parts: TemplateStringNode["parts"] = [];

		if (!token.templateParts) {
			throw new ParseError(
				"Template string token missing parts",
				token.line,
				token.column
			);
		}

		for (const part of token.templateParts) {
			if (part.type === "text") {
				parts.push({ type: "text", value: part.value });
			} else {
				const exprLexer = new Lexer(part.value);
				const exprTokens = exprLexer.tokenize();
				const exprParser = new Parser(exprTokens);
				const expr = exprParser.parseExpression();
				parts.push({ type: "expression", expr });
			}
		}

		return {
			type: "TemplateString",
			parts,
			line: token.line,
			column: token.column,
		};
	}

	private parseFunctionCall(
		name: string,
		line: number,
		column: number
	): FunctionCallNode {
		const args = this.parseArgumentList();

		return {
			type: "FunctionCall",
			name,
			args,
			line,
			column,
		};
	}

	private parseArgumentList(): ExpressionNode[] {
		this.consume(TokenType.LPAREN, "Expected '(' to start argument list");
		this.skipNewlines();

		const args: ExpressionNode[] = [];

		if (this.check(TokenType.RPAREN)) {
			this.advance();
			return args;
		}

		do {
			if (this.check(TokenType.COMMA)) {
				this.advance();
				this.skipNewlines();
			}

			if (!this.check(TokenType.RPAREN)) {
				args.push(this.parseExpression());
				this.skipNewlines();
			}
		} while (this.check(TokenType.COMMA));

		this.consume(TokenType.RPAREN, "Expected ')' after argument list");

		return args;
	}

	private parseAnonymousFunction(
		line: number,
		column: number
	): AnonymousFunctionNode {
		const args = this.parseArgumentList();

		const styles = this.check(TokenType.LBRACKET)
			? this.parseStyleList()
			: [];

		this.consume(
			TokenType.LPAREN,
			"Expected '()' to invoke anonymous function"
		);
		this.consume(
			TokenType.RPAREN,
			"Expected ')' to complete anonymous function invocation"
		);

		return {
			type: "AnonymousFunction",
			args,
			styles,
			line,
			column,
		};
	}

	private parseBlock(): BlockNode {
		const token = this.advance();
		const line = token.line;
		const column = token.column;

		this.skipNewlines();

		const body: StatementNode[] = [];
		while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
			if (this.check(TokenType.NEWLINE)) {
				this.advance();
				continue;
			}

			const stmt = this.parseStatement();
			if (stmt) {
				body.push(stmt);
			}
		}

		this.consume(TokenType.RBRACE, "Expected '}' after block content");

		const styles = this.check(TokenType.LBRACKET)
			? this.parseStyleList()
			: [];

		return {
			type: "Block",
			body,
			styles,
			line,
			column,
		};
	}

	private parseArrayLiteral(): ArrayNode {
		const token = this.advance();
		const line = token.line;
		const column = token.column;

		this.skipNewlines();

		const elements: ExpressionNode[] = [];

		if (this.check(TokenType.RBRACKET)) {
			this.advance();
			return {
				type: "Array",
				elements,
				line,
				column,
			};
		}

		while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
			this.skipNewlines();
			elements.push(this.parseExpression());
			this.skipNewlines();

			if (this.check(TokenType.COMMA)) {
				this.advance();
				this.skipNewlines();
			} else if (!this.check(TokenType.RBRACKET)) {
				throw new ParseError(
					"Expected ',' or ']' in array literal",
					this.peek().line,
					this.peek().column
				);
			}
		}

		this.consume(TokenType.RBRACKET, "Expected ']' after array elements");

		return {
			type: "Array",
			elements,
			line,
			column,
		};
	}

	private parseArrayIndex(array: ExpressionNode): ArrayIndexNode {
		const token = this.advance();
		const line = token.line;
		const column = token.column;

		this.skipNewlines();
		const index = this.parseExpression();
		this.skipNewlines();

		this.consume(TokenType.RBRACKET, "Expected ']' after array index");

		const indexNode: ArrayIndexNode = {
			type: "ArrayIndex",
			array,
			index,
			line,
			column,
		};

		if (this.check(TokenType.LBRACKET)) {
			return this.parseArrayIndex(indexNode);
		}

		return indexNode;
	}

	private check(type: TokenType): boolean {
		if (this.isAtEnd()) return false;
		return this.peek().type === type;
	}

	private skipNewlines(): void {
		while (this.check(TokenType.NEWLINE)) {
			this.advance();
		}
	}

	private consume(type: TokenType, message: string): Token {
		if (this.check(type)) {
			return this.advance();
		}

		const token = this.peek();
		throw new ParseError(message, token.line, token.column);
	}

	private advance(): Token {
		if (!this.isAtEnd()) {
			this.current++;
		}
		return this.previous();
	}

	private isAtEnd(): boolean {
		return this.peek().type === TokenType.EOF;
	}

	private peek(): Token {
		return this.tokens[this.current];
	}

	private peekNext(): Token | null {
		if (this.current + 1 >= this.tokens.length) {
			return null;
		}
		return this.tokens[this.current + 1];
	}

	private previous(): Token {
		return this.tokens[this.current - 1];
	}
}
