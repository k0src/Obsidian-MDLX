import {
	Token,
	TokenType,
	LexerError,
	TemplatePart,
} from "./types/lexer.types";

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

		while (!this.isAtEnd()) {
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

		if (this.isAtEnd()) {
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

		if (this.isDigit(char)) {
			return this.readNumber(startLine, startColumn);
		}

		if (char === "~") {
			if (this.peekNext() === "@") {
				this.advance();
				return this.readIdentifier(startLine, startColumn, true);
			}
			throw new LexerError(
				`Unexpected character '~', did you mean '~@' for global variable?`,
				startLine,
				startColumn
			);
		}

		if (char === "@") {
			return this.readIdentifier(startLine, startColumn, false);
		}

		if (char === "+") {
			this.advance();
			if (this.peek() === "+") {
				this.advance();
				return {
					type: TokenType.PLUS_PLUS,
					value: "++",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.PLUS,
				value: "+",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === "-") {
			this.advance();
			if (this.peek() === "-") {
				this.advance();
				return {
					type: TokenType.MINUS_MINUS,
					value: "--",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.MINUS,
				value: "-",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === "=") {
			this.advance();
			if (this.peek() === "=") {
				this.advance();
				return {
					type: TokenType.EQUALS_EQUALS,
					value: "==",
					line: startLine,
					column: startColumn,
				};
			}
			if (this.peek() === ">") {
				this.advance();
				return {
					type: TokenType.ARROW,
					value: "=>",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.EQUALS,
				value: "=",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === "!") {
			this.advance();
			if (this.peek() === "=") {
				this.advance();
				return {
					type: TokenType.NOT_EQUALS,
					value: "!=",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.NOT,
				value: "!",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === "<") {
			this.advance();
			if (this.peek() === "=") {
				this.advance();
				return {
					type: TokenType.LESS_THAN_EQUALS,
					value: "<=",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.LESS_THAN,
				value: "<",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === ">") {
			this.advance();
			if (this.peek() === "=") {
				this.advance();
				return {
					type: TokenType.GREATER_THAN_EQUALS,
					value: ">=",
					line: startLine,
					column: startColumn,
				};
			}
			return {
				type: TokenType.GREATER_THAN,
				value: ">",
				line: startLine,
				column: startColumn,
			};
		}

		if (char === "&") {
			this.advance();
			if (this.peek() === "&") {
				this.advance();
				return {
					type: TokenType.AND,
					value: "&&",
					line: startLine,
					column: startColumn,
				};
			}
			throw new LexerError(
				`Unexpected character '&', did you mean '&&'?`,
				startLine,
				startColumn
			);
		}

		if (char === "|") {
			this.advance();
			if (this.peek() === "|") {
				this.advance();
				return {
					type: TokenType.OR,
					value: "||",
					line: startLine,
					column: startColumn,
				};
			}
			throw new LexerError(
				`Unexpected character '|', did you mean '||'?`,
				startLine,
				startColumn
			);
		}

		switch (char) {
			case "*":
				this.advance();
				return {
					type: TokenType.STAR,
					value: "*",
					line: startLine,
					column: startColumn,
				};
			case "/":
				this.advance();
				return {
					type: TokenType.SLASH,
					value: "/",
					line: startLine,
					column: startColumn,
				};
			case "%":
				this.advance();
				return {
					type: TokenType.PERCENT,
					value: "%",
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
		const parts: TemplatePart[] = [];
		let hasTemplates = false;
		let inMathMode = false;
		let mathModeDouble = false;

		while (!this.isAtEnd() && this.peek() !== '"') {
			if (this.peek() === "\n") {
				throw new LexerError(
					"Unterminated string",
					startLine,
					startColumn
				);
			}

			const mathToggle = this.checkMathModeToggle(
				inMathMode,
				mathModeDouble
			);
			if (mathToggle.consumed > 0) {
				inMathMode = mathToggle.newInMathMode;
				mathModeDouble = mathToggle.newMathModeDouble;

				for (let i = 0; i < mathToggle.consumed; i++) {
					value += this.peek();
					this.advance();
				}
				continue;
			}

			if (this.peek() === "\\" && !inMathMode) {
				this.advance();

				if (!this.isAtEnd()) {
					const escaped = this.peek();
					value += this.getEscapedChar(escaped);
					this.advance();
				}
			} else if (this.peek() === "<" && this.peekNext() !== " ") {
				if (value.length > 0) {
					parts.push({ type: "text", value });
					value = "";
				}
				hasTemplates = true;

				this.advance();
				let exprSource = "";
				let depth = 1;

				while (!this.isAtEnd() && depth > 0) {
					if (this.peek() === "<") {
						depth++;
						exprSource += this.peek();
						this.advance();
					} else if (this.peek() === ">") {
						depth--;
						if (depth > 0) {
							exprSource += this.peek();
						}
						this.advance();
					} else if (this.peek() === "\n") {
						throw new LexerError(
							"Unterminated template expression in string",
							startLine,
							startColumn
						);
					} else {
						exprSource += this.peek();
						this.advance();
					}
				}

				if (depth !== 0) {
					throw new LexerError(
						"Unterminated template expression",
						startLine,
						startColumn
					);
				}

				parts.push({ type: "expression", value: exprSource.trim() });
			} else {
				value += this.peek();
				this.advance();
			}
		}

		if (this.isAtEnd()) {
			throw new LexerError("Unterminated string", startLine, startColumn);
		}

		this.advance();

		if (hasTemplates) {
			if (value.length > 0) {
				parts.push({ type: "text", value });
			}

			return {
				type: TokenType.TEMPLATE_STRING,
				value: "",
				line: startLine,
				column: startColumn,
				templateParts: parts,
			};
		}

		return {
			type: TokenType.STRING,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readMultilineString(startLine: number, startColumn: number): Token {
		let value = "";
		const parts: TemplatePart[] = [];
		let hasTemplates = false;
		let inMathMode = false;
		let mathModeDouble = false;

		while (!this.isAtEnd()) {
			if (
				this.peek() === '"' &&
				this.peekNext() === '"' &&
				this.peekAhead(2) === '"'
			) {
				this.advance();
				this.advance();
				this.advance();

				if (hasTemplates) {
					if (value.length > 0) {
						parts.push({ type: "text", value });
					}

					return {
						type: TokenType.TEMPLATE_STRING,
						value: "",
						line: startLine,
						column: startColumn,
						templateParts: parts,
					};
				}

				return {
					type: TokenType.STRING,
					value,
					line: startLine,
					column: startColumn,
				};
			}

			const mathToggle = this.checkMathModeToggle(
				inMathMode,
				mathModeDouble
			);
			if (mathToggle.consumed > 0) {
				inMathMode = mathToggle.newInMathMode;
				mathModeDouble = mathToggle.newMathModeDouble;

				for (let i = 0; i < mathToggle.consumed; i++) {
					value += this.peek();
					this.advance();
				}
				continue;
			}

			if (this.peek() === "\\" && !inMathMode) {
				this.advance();
				if (!this.isAtEnd()) {
					const escaped = this.peek();
					value += this.getEscapedChar(escaped);
					this.advance();
				}
			} else if (this.peek() === "<" && this.peekNext() !== " ") {
				if (value.length > 0) {
					parts.push({ type: "text", value });
					value = "";
				}
				hasTemplates = true;

				this.advance();
				let exprSource = "";
				let depth = 1;

				while (!this.isAtEnd() && depth > 0) {
					if (this.peek() === "<") {
						depth++;
						exprSource += this.peek();
						this.advance();
					} else if (this.peek() === ">") {
						depth--;
						if (depth > 0) {
							exprSource += this.peek();
						}
						this.advance();
					} else {
						exprSource += this.peek();
						this.advance();
					}
				}

				if (depth !== 0) {
					throw new LexerError(
						"Unterminated template expression",
						startLine,
						startColumn
					);
				}

				parts.push({ type: "expression", value: exprSource.trim() });
			} else {
				value += this.peek();
				this.advance();
			}
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
		while (!this.isAtEnd() && this.peek() !== "`") {
			value += this.peek();
			this.advance();
		}

		if (this.isAtEnd()) {
			throw new LexerError(
				"Unterminated literal string",
				startLine,
				startColumn
			);
		}

		this.advance();

		return {
			type: TokenType.LITERAL_STRING,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readIdentifier(
		startLine: number,
		startColumn: number,
		isGlobal: boolean = false
	): Token {
		this.advance();

		if (
			this.isAtEnd() ||
			(!this.isAlpha(this.peek()) && this.peek() !== "_")
		) {
			if (isGlobal) {
				throw new LexerError(
					"Expected identifier after ~@",
					startLine,
					startColumn
				);
			}
			return {
				type: TokenType.AT,
				value: "@",
				line: startLine,
				column: startColumn,
			};
		}

		let value = "@";
		while (
			!this.isAtEnd() &&
			(this.isAlphaNumeric(this.peek()) ||
				this.peek() === "_" ||
				(this.peek() === "-" && !this.isOperatorAhead()))
		) {
			value += this.peek();
			this.advance();
		}

		return {
			type: isGlobal ? TokenType.GLOBAL : TokenType.IDENTIFIER,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readName(startLine: number, startColumn: number): Token {
		let value = "";
		while (
			!this.isAtEnd() &&
			(this.isAlphaNumeric(this.peek()) || this.peek() === "-")
		) {
			value += this.peek();
			this.advance();
		}

		if (value === "true" || value === "false") {
			return {
				type: TokenType.BOOLEAN,
				value,
				line: startLine,
				column: startColumn,
			};
		}

		if (value === "if") {
			return {
				type: TokenType.IF,
				value,
				line: startLine,
				column: startColumn,
			};
		}

		if (value === "else") {
			return {
				type: TokenType.ELSE,
				value,
				line: startLine,
				column: startColumn,
			};
		}

		if (value === "for") {
			return {
				type: TokenType.FOR,
				value,
				line: startLine,
				column: startColumn,
			};
		}

		if (value === "while") {
			return {
				type: TokenType.WHILE,
				value,
				line: startLine,
				column: startColumn,
			};
		}

		return {
			type: TokenType.NAME,
			value,
			line: startLine,
			column: startColumn,
		};
	}

	private readNumber(startLine: number, startColumn: number): Token {
		let value = "";

		while (!this.isAtEnd() && this.isDigit(this.peek())) {
			value += this.peek();
			this.advance();
		}

		if (this.peek() === "." && this.isDigit(this.peekNext())) {
			value += ".";
			this.advance();

			while (!this.isAtEnd() && this.isDigit(this.peek())) {
				value += this.peek();
				this.advance();
			}
		}

		return {
			type: TokenType.NUMBER,
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
			case "<":
				return "<";
			case ">":
				return ">";
			default:
				return char;
		}
	}

	private checkMathModeToggle(
		inMathMode: boolean,
		mathModeDouble: boolean
	): {
		consumed: number;
		newInMathMode: boolean;
		newMathModeDouble: boolean;
	} {
		if (this.peek() === "$") {
			if (this.peekNext() === "$") {
				if (inMathMode && mathModeDouble) {
					return {
						consumed: 2,
						newInMathMode: false,
						newMathModeDouble: false,
					};
				} else if (!inMathMode) {
					return {
						consumed: 2,
						newInMathMode: true,
						newMathModeDouble: true,
					};
				}
			} else {
				if (inMathMode && !mathModeDouble) {
					return {
						consumed: 1,
						newInMathMode: false,
						newMathModeDouble: false,
					};
				} else if (!inMathMode) {
					return {
						consumed: 1,
						newInMathMode: true,
						newMathModeDouble: false,
					};
				}
			}
		}
		return {
			consumed: 0,
			newInMathMode: inMathMode,
			newMathModeDouble: mathModeDouble,
		};
	}

	private skipWhitespace(): void {
		while (!this.isAtEnd()) {
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
			!this.isAtEnd() &&
			this.peek() === "/" &&
			this.peekNext() === "/"
		) {
			this.advance();
			this.advance();

			while (!this.isAtEnd() && this.peek() !== "\n") {
				this.advance();
			}

			this.skipWhitespace();
		}
	}

	private isAlpha(char: string): boolean {
		return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
	}

	private isDigit(char: string): boolean {
		return char >= "0" && char <= "9";
	}

	private isAlphaNumeric(char: string): boolean {
		return this.isAlpha(char) || this.isDigit(char);
	}

	private peek(): string {
		if (this.isAtEnd()) return "\0";
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

	private isAtEnd(): boolean {
		return this.pos >= this.source.length;
	}

	private isOperatorAhead(): boolean {
		const current = this.peek();
		const next = this.peekNext();
		return (
			(current === "+" && next === "+") ||
			(current === "-" && next === "-")
		);
	}
}
