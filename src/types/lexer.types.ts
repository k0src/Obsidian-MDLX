export enum TokenType {
	STRING = "STRING",
	LITERAL = "LITERAL",
	NUMBER = "NUMBER",

	IDENTIFIER = "IDENTIFIER",
	NAME = "NAME",

	AT = "AT",
	EQUALS = "EQUALS",
	PLUS = "PLUS",
	MINUS = "MINUS",
	STAR = "STAR",
	SLASH = "SLASH",
	PERCENT = "PERCENT",
	PLUS_PLUS = "PLUS_PLUS",
	MINUS_MINUS = "MINUS_MINUS",

	LPAREN = "LPAREN",
	RPAREN = "RPAREN",
	LBRACKET = "LBRACKET",
	RBRACKET = "RBRACKET",
	LBRACE = "LBRACE",
	RBRACE = "RBRACE",
	COMMA = "COMMA",

	NEWLINE = "NEWLINE",
	EOF = "EOF",
}

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
}

export class LexerError extends Error {
	constructor(message: string, public line: number, public column: number) {
		super(`Lexer error at line ${line}, column ${column}: ${message}`);
		this.name = "LexerError";
	}
}
