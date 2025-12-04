import { Token, TokenType } from "./types/lexer.types";
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
	ParseError,
} from "./types/ast.types";

export class Parser {
	private tokens: Token[];
	private current: number = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	parse(): ProgramNode {
		const statements: StatementNode[] = [];

		while (!this.isAtEnd()) {
			// Skip newlines
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
		// Skip newlines
		while (this.check(TokenType.NEWLINE)) {
			this.advance();
		}

		if (this.isAtEnd()) {
			return null;
		}

		// Check for variables/functions
		if (
			this.check(TokenType.IDENTIFIER) &&
			this.peekNext()?.type === TokenType.EQUALS
		) {
			const nameToken = this.peek();
			const name = nameToken.value;

			// Look ahead to see if its a function definition or variable
			this.advance(); // consume identifier
			this.advance(); // consume =

			// Check if next token is LPAREN (function)
			if (this.check(TokenType.LPAREN)) {
				return this.parseFunctionDefinition(
					name,
					nameToken.line,
					nameToken.column
				);
			} else {
				// Variable
				const value = this.parseExpression();
				return {
					type: "Variable",
					name,
					value,
					line: nameToken.line,
					column: nameToken.column,
				};
			}
		}

		// Expression statement
		return this.parseExpression();
	}

	private parseFunctionDefinition(
		name: string,
		line: number,
		column: number
	): FunctionNode {
		// Parse parameter list
		const params = this.parseParameterList();

		// Parse optional style list
		const styles = this.check(TokenType.LBRACKET)
			? this.parseStyleList()
			: [];

		// Parse function body
		this.consume(TokenType.LBRACE, "Expected '{' to start function body");

		const body: StatementNode[] = [];
		while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
			// Skip newlines
			if (this.check(TokenType.NEWLINE)) {
				this.advance();
				continue;
			}

			const stmt = this.parseStatement();
			if (stmt) {
				body.push(stmt);
			}
		}

		this.consume(TokenType.RBRACE, "Expected '}' to end function body");

		return {
			type: "Function",
			name,
			params,
			styles,
			body,
			line,
			column,
		};
	}

	private parseParameterList(): string[] {
		this.consume(TokenType.LPAREN, "Expected '(' to start parameter list");

		const params: string[] = [];

		// Empty list
		if (this.check(TokenType.RPAREN)) {
			this.advance();
			return params;
		}

		// Parse parameters
		do {
			// Skip commas
			if (this.check(TokenType.COMMA)) {
				this.advance();
			}

			// Parameters must be identifiers
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

		// Empty style list
		if (this.check(TokenType.RBRACKET)) {
			this.advance();
			return styles;
		}

		// Parse style classes
		do {
			// Skip commas
			if (this.check(TokenType.COMMA)) {
				this.advance();
			}

			// Style classes are plain NAMEs
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
		let expr = this.parsePrimary();

		// Check for concatenation
		if (this.check(TokenType.PLUS)) {
			const parts: ExpressionNode[] = [expr];

			while (this.check(TokenType.PLUS)) {
				this.advance(); // consume +
				this.skipNewlines(); // skip newlines after +
				parts.push(this.parsePrimary());
			}

			return {
				type: "Concatenation",
				parts,
				line: expr.line,
				column: expr.column,
			};
		}

		return expr;
	}

	private parsePrimary(): ExpressionNode {
		// String literal
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

		// Literal string
		if (this.check(TokenType.LITERAL)) {
			const token = this.advance();
			return {
				type: "String",
				value: token.value,
				isMarkdown: false,
				line: token.line,
				column: token.column,
			};
		}

		// Identifier or function
		if (this.check(TokenType.IDENTIFIER)) {
			const token = this.advance();

			// Function
			if (this.check(TokenType.LPAREN)) {
				return this.parseFunctionCall(
					token.value,
					token.line,
					token.column
				);
			}

			// Identifier
			return {
				type: "Identifier",
				name: token.value,
				line: token.line,
				column: token.column,
			};
		}

		// Anonymous function
		if (this.check(TokenType.AT)) {
			const token = this.advance();

			// Must be followed by LPAREN
			if (this.check(TokenType.LPAREN)) {
				return this.parseAnonymousFunction(token.line, token.column);
			}

			throw new ParseError(
				"Unexpected '@' token - expected identifier or function call",
				token.line,
				token.column
			);
		}

		// Block/div
		if (this.check(TokenType.LBRACE)) {
			return this.parseBlock();
		}

		// if we are here we have an unpected token
		const token = this.peek();
		throw new ParseError(
			`Unexpected token: ${token.type} ('${token.value}')`,
			token.line,
			token.column
		);
	}

	private parseFunctionCall(
		name: string,
		line: number,
		column: number
	): FunctionCallNode {
		// Parse argument list
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
		this.skipNewlines(); // skip newlines

		const args: ExpressionNode[] = [];

		// Empty argument list
		if (this.check(TokenType.RPAREN)) {
			this.advance();
			return args;
		}

		// Parse arguments
		do {
			// Skip commas
			if (this.check(TokenType.COMMA)) {
				this.advance();
				this.skipNewlines(); // skip newlines after comma
			}

			// Parse expression argument
			if (!this.check(TokenType.RPAREN)) {
				args.push(this.parseExpression());
				this.skipNewlines(); // skip newlines after argument
			}
		} while (this.check(TokenType.COMMA));

		this.consume(TokenType.RPAREN, "Expected ')' after argument list");

		return args;
	}

	private parseAnonymousFunction(
		line: number,
		column: number
	): AnonymousFunctionNode {
		// Parse arguments
		const args = this.parseArgumentList();

		// Parse optional style list
		const styles = this.check(TokenType.LBRACKET)
			? this.parseStyleList()
			: [];

		// Final () invokes the function
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
		const token = this.advance(); // consume {
		const line = token.line;
		const column = token.column;

		this.skipNewlines(); // skip newlines after {

		// Parse all statements inside the block
		const body: StatementNode[] = [];
		while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
			// Skip newlines between statements
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

		// Parse optional style list
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
