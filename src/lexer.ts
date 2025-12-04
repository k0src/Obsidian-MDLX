import { Token, TokenType, LexerError } from "./types/lexer.types";

export class Lexer {
	private source: string;
	private pos: number = 0;
	private line: number = 1;
	private column: number = 1;

	constructor(source: string) {
		this.source = source;
	}

	tokenize(): Token[] {
		const tokens: Token[] = [];

		while (!this.atEnd()) {
			const token = this.nextToken();
			if (token) {
				tokens.push(token);
			}
		}

		tokens.push({
			type: TokenType.EOF,
			value: "",
			line: this.line,
			column: this.column,
		});

		return tokens;
	}

	private nextToken(): Token | null {
		this.skipWhitespace();
		this.skipComments();

		if (this.atEnd()) {
			return null;
		}

		const start = this.pos;
		const startLine = this.line;
		const startColumn = this.column;

		const char = this.peek();

		if (char === "\n") {
			this.advance();
			return {
				type: TokenType.NEWLINE,
				value: "\n",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === '"') {
			return this.readString(startLine, startColumn);
		}

		if (char === "`") {
			return this.readLiteralString(startLine, startColumn);
		}

		if (char === "@") {
			return this.readIdentifier(startLine, startColumn);
		}

		switch (char) {
			case "=":
				this.advance();
				return {
					type: TokenType.EQUALS,
					value: "=",
					line: startLine,
					column: startColumn,
				};
			case "+":
				this.advance();
				return {
					type: TokenType.PLUS,
					value: "+",
					line: startLine,
					column: startColumn,
				};
			case "(":
				this.advance();
				return {
					type: TokenType.LPAREN,
					value: "(",
					line: startLine,
					column: startColumn,
				};
			case ")":
				this.advance();
				return {
					type: TokenType.RPAREN,
					value: ")",
					line: startLine,
					column: startColumn,
				};
			case "[":
				this.advance();
				return {
					type: TokenType.LBRACKET,
					value: "[",
					line: startLine,
					column: startColumn,
				};
			case "]":
				this.advance();
				return {
					type: TokenType.RBRACKET,
					value: "]",
					line: startLine,
					column: startColumn,
				};
			case "{":
				this.advance();
				return {
					type: TokenType.LBRACE,
					value: "{",
					line: startLine,
					column: startColumn,
				};
			case "}":
				this.advance();
				return {
					type: TokenType.RBRACE,
					value: "}",
					line: startLine,
					column: startColumn,
				};
			case ",":
				this.advance();
				return {
					type: TokenType.COMMA,
					value: ",",
					line: startLine,
					column: startColumn,
				};
		}

		if (this.isAlpha(char)) {
			return this.readName(startLine, startColumn);
		}

		throw new LexerError(
			`Unexpected character: '${char}'`,
			startLine,
			startColumn
		);
	}

	private readString(startLine: number, startColumn: number): Token {
		this.advance();

		if (this.peek() === '"' && this.peekNext() === '"') {
			this.advance();
			this.advance();
			return this.readMultilineString(startLine, startColumn);
		}

		let value = "";
		while (!this.atEnd() && this.peek() !== '"') {
			if (this.peek() === "\n") {
				throw new LexerError(
					"Unterminated string",
					startLine,
					startColumn
				);
			}
			if (this.peek() === "\\") {
				this.advance();
				if (!this.atEnd()) {
					const escaped = this.peek();
					value += this.getEscapedChar(escaped);
					this.advance();
				}
			} else {
				value += this.peek();
				this.advance();
			}
		}

		if (this.atEnd()) {
			throw new LexerError("Unterminated string", startLine, startColumn);
		}

		this.advance();

		return {
			type: TokenType.STRING,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readMultilineString(startLine: number, startColumn: number): Token {
		let value = "";

		while (!this.atEnd()) {
			if (
				this.peek() === '"' &&
				this.peekNext() === '"' &&
				this.peekAhead(2) === '"'
			) {
				this.advance();
				this.advance();
				this.advance();
				return {
					type: TokenType.STRING,
					value,
					line: startLine,
					column: startColumn,
				};
			}

			value += this.peek();
			this.advance();
		}

		throw new LexerError(
			"Unterminated multiline string",
			startLine,
			startColumn
		);
	}

	private readLiteralString(startLine: number, startColumn: number): Token {
		this.advance();

		let value = "";
		while (!this.atEnd() && this.peek() !== "`") {
			if (this.peek() === "\\") {
				this.advance();
				if (!this.atEnd()) {
					const escaped = this.peek();
					value += this.getEscapedChar(escaped);
					this.advance();
				}
			} else {
				value += this.peek();
				this.advance();
			}
		}

		if (this.atEnd()) {
			throw new LexerError(
				"Unterminated literal string",
				startLine,
				startColumn
			);
		}

		this.advance();

		return {
			type: TokenType.LITERAL,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readIdentifier(startLine: number, startColumn: number): Token {
		this.advance();

		if (
			this.atEnd() ||
			(!this.isAlpha(this.peek()) && this.peek() !== "_")
		) {
			return {
				type: TokenType.AT,
				value: "@",
				line: startLine,
				column: startColumn,
			};
		}

		let value = "@";
		while (
			!this.atEnd() &&
			(this.isAlphaNumeric(this.peek()) ||
				this.peek() === "_" ||
				this.peek() === "-")
		) {
			value += this.peek();
			this.advance();
		}

		return {
			type: TokenType.IDENTIFIER,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readName(startLine: number, startColumn: number): Token {
		let value = "";
		while (
			!this.atEnd() &&
			(this.isAlphaNumeric(this.peek()) || this.peek() === "-")
		) {
			value += this.peek();
			this.advance();
		}

		return {
			type: TokenType.NAME,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private getEscapedChar(char: string): string {
		switch (char) {
			case "n":
				return "\n";
			case "t":
				return "\t";
			case "r":
				return "\r";
			case "\\":
				return "\\";
			case '"':
				return '"';
			case "`":
				return "`";
			default:
				return char;
		}
	}

	private skipWhitespace(): void {
		while (!this.atEnd()) {
			const char = this.peek();
			if (char === " " || char === "\t" || char === "\r") {
				this.advance();
			} else {
				break;
			}
		}
	}

	private skipComments(): void {
		while (
			!this.atEnd() &&
			this.peek() === "/" &&
			this.peekNext() === "/"
		) {
			this.advance();
			this.advance();

			while (!this.atEnd() && this.peek() !== "\n") {
				this.advance();
			}

			this.skipWhitespace();
		}
	}

	private isAlpha(char: string): boolean {
		return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
	}

	private isAlphaNumeric(char: string): boolean {
		return this.isAlpha(char) || (char >= "0" && char <= "9");
	}

	private peek(): string {
		if (this.atEnd()) return "\0";
		return this.source[this.pos];
	}

	private peekNext(): string {
		if (this.pos + 1 >= this.source.length) return "\0";
		return this.source[this.pos + 1];
	}

	private peekAhead(n: number): string {
		if (this.pos + n >= this.source.length) return "\0";
		return this.source[this.pos + n];
	}

	private advance(): string {
		const char = this.source[this.pos];
		this.pos++;

		if (char === "\n") {
			this.line++;
			this.column = 1;
		} else {
			this.column++;
		}

		return char;
	}

	private atEnd(): boolean {
		return this.pos >= this.source.length;
	}
}
