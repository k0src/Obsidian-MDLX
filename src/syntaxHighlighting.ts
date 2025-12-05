export function addLxMode() {
	// @ts-ignore
	if (!window.CodeMirror) return;

	// @ts-ignore
	window.CodeMirror.modeInfo.push({
		name: "lx",
		mime: "text/lx",
		mode: "lx",
		ext: ["lx"],
	});
}

export function removeLxMode() {
	// @ts-ignore
	if (!window.CodeMirror) return;

	// @ts-ignore
	const modeIndex = window.CodeMirror.modeInfo.findIndex(
		(mode: { mode: string }) => mode.mode === "lx"
	);
	if (modeIndex !== -1) {
		// @ts-ignore
		window.CodeMirror.modeInfo.splice(modeIndex, 1);
	}
}

export function addLxSyntaxHighlight(
	// @ts-ignore
	CodeMirror: any
) {
	CodeMirror.defineMode("lx", function (_config: any, _parserConfig: any) {
		return {
			startState: () => ({}),

			token: (stream: any, _state: any) => {
				if (stream.eatSpace()) return null;
				if (stream.match(/^\/\/.*/)) return "lx-comment";
				if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "lx-string";
				if (stream.match(/^'(?:[^'\\]|\\.)*'/)) return "lx-string";
				if (stream.match(/^`[^`]*`/)) return "lx-literal-string";
				if (stream.match(/^<[^>]+>/)) return "lx-template-string";
				if (stream.match(/^-?\d+\.?\d*/)) return "lx-number";
				if (stream.match(/^(true|false)\b/)) return "lx-boolean";
				if (stream.match(/^(if|else|for|while)\b/)) return "lx-keyword";
				if (stream.match(/^=>/)) return "lx-operator";
				if (stream.match(/^(==|!=|<=|>=|&&|\|\||<|>)/))
					return "lx-operator";
				if (stream.match(/^(\+\+|--)/)) return "lx-operator";
				if (stream.match(/^[+\-*\/%]/)) return "lx-operator";
				if (stream.match(/^~/)) return "lx-operator";
				if (stream.match(/^=/)) return "lx-operator";
				if (stream.match(/^@[a-zA-Z_][a-zA-Z0-9_-]*/))
					return "lx-function";
				if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/))
					return "lx-identifier";
				if (stream.match(/^[(){}\[\],]/)) return null;
				stream.next();
				return null;
			},
		};
	});

	CodeMirror.defineMIME("text/lx", "lx");
}
