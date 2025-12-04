export enum TokenType {
	STRING = "STRING",
	TEMPLATE_STRING = "TEMPLATE_STRING",
	LITERAL_STRING = "LITERAL_STRING",
	NUMBER = "NUMBER",
	BOOLEAN = "BOOLEAN",

	IF = "IF",
	ELSE = "ELSE",
	FOR = "FOR",
	WHILE = "WHILE",

	IDENTIFIER = "IDENTIFIER",
	NAME = "NAME",

	AT = "AT",
	GLOBAL = "GLOBAL",
	EQUALS = "EQUALS",
	PLUS = "PLUS",
	MINUS = "MINUS",
	STAR = "STAR",
	SLASH = "SLASH",
	PERCENT = "PERCENT",
	PLUS_PLUS = "PLUS_PLUS",
	MINUS_MINUS = "MINUS_MINUS",

	EQUALS_EQUALS = "EQUALS_EQUALS",
	NOT_EQUALS = "NOT_EQUALS",
	LESS_THAN = "LESS_THAN",
	LESS_THAN_EQUALS = "LESS_THAN_EQUALS",
	GREATER_THAN = "GREATER_THAN",
	GREATER_THAN_EQUALS = "GREATER_THAN_EQUALS",

	AND = "AND",
	OR = "OR",
	NOT = "NOT",

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

export interface TemplatePart {
	type: "text" | "expression";
	value: string;
}

export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
	templateParts?: TemplatePart[];
}

export class LexerError extends Error {
	constructor(message: string, public line: number, public column: number) {
		super(`Lexer error at line ${line}, column ${column}: ${message}`);
		this.name = "LexerError";
	}
}
