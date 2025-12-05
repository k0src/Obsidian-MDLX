import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import { STDLIB_FUNCTIONS } from "./stdlib";
import MDLXPlugin from "../main";

interface MDLXSuggestion {
	name: string;
	type: "stdlib" | "global-var" | "global-func";
}

export class MDLXSuggest extends EditorSuggest<MDLXSuggestion> {
	private plugin: MDLXPlugin;

	constructor(plugin: MDLXPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		// Check if suggestions are enabled
		if (!this.plugin.settings.enableAutocompleteSuggestions) {
			return null;
		}

		const line = editor.getLine(cursor.line);
		const beforeCursor = line.substring(0, cursor.ch);

		if (cursor.ch === 0) {
			return null;
		}

		const match = beforeCursor.match(/@(\w*)$/);
		if (!match) {
			return null;
		}

		return {
			start: { line: cursor.line, ch: cursor.ch - match[0].length },
			end: cursor,
			query: match[1],
		};
	}

	getSuggestions(context: EditorSuggestContext): MDLXSuggestion[] {
		const suggestions: MDLXSuggestion[] = [];
		const query = context.query.toLowerCase();

		for (const funcName of STDLIB_FUNCTIONS.keys()) {
			if (funcName.toLowerCase().includes(query)) {
				suggestions.push({
					name: funcName,
					type: "stdlib",
				});
			}
		}

		if (context.file) {
			const globalContext = this.plugin.getGlobalContext(
				context.file.path
			);
			if (globalContext) {
				const variables = globalContext.getAllVariables();
				for (const varName of variables.keys()) {
					if (
						varName.toLowerCase().includes(query) &&
						!suggestions.some((s) => s.name === varName)
					) {
						suggestions.push({
							name: varName,
							type: "global-var",
						});
					}
				}

				const functions = globalContext.getAllFunctions();
				for (const funcName of functions.keys()) {
					if (
						funcName.toLowerCase().includes(query) &&
						!suggestions.some((s) => s.name === funcName)
					) {
						suggestions.push({
							name: funcName,
							type: "global-func",
						});
					}
				}
			}
		}

		return suggestions;
	}

	renderSuggestion(suggestion: MDLXSuggestion, el: HTMLElement): void {
		el.createEl("div", { text: suggestion.name });
		el.createEl("small", {
			text:
				suggestion.type === "stdlib"
					? "stdlib"
					: suggestion.type === "global-var"
					? "global var"
					: "global func",
			cls: "lx-suggest-type",
		});
	}

	selectSuggestion(
		suggestion: MDLXSuggestion,
		evt: MouseEvent | KeyboardEvent
	): void {
		if (!this.context) return;

		const editor = this.context.editor;
		const cursor = editor.getCursor();

		editor.replaceRange(
			suggestion.name,
			this.context.start,
			this.context.end
		);

		const isInsideCodeBlock = this.isInsideLxBlock(editor, cursor.line);

		if (!isInsideCodeBlock) {
			const updatedLine = editor.getLine(cursor.line);
			const trimmedLine = updatedLine.trim();

			editor.replaceRange(
				`\`\`\`lx\n${trimmedLine}\n\`\`\``,
				{ line: cursor.line, ch: 0 },
				{ line: cursor.line, ch: updatedLine.length }
			);

			editor.setCursor({ line: cursor.line + 1, ch: trimmedLine.length });
		} else {
			const newCursor = editor.getCursor();
			editor.setCursor(newCursor);
		}

		this.close();
	}

	private isInsideLxBlock(editor: Editor, currentLine: number): boolean {
		let inBlock = false;

		for (let i = currentLine - 1; i >= 0; i--) {
			const line = editor.getLine(i).trim();
			if (line === "```") {
				return inBlock;
			}
			if (line === "```lx") {
				return true;
			}
		}

		return false;
	}
}
