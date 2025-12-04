import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { Lexer } from "./src/lexer";
import { Parser } from "./src/parser";
import { Evaluator, ExecutionContext } from "./src/evaluator";
import { Renderer } from "./src/renderer";
import { DynamicStyleManager } from "./src/styleManager";

export default class MDLXPlugin extends Plugin {
	private contexts: Map<string, ExecutionContext> = new Map();
	private renderer: Renderer;
	private styleManager: DynamicStyleManager;

	async onload() {
		this.styleManager = new DynamicStyleManager();
		this.renderer = new Renderer(this.app, this.styleManager);
		this.registerMarkdownCodeBlockProcessor(
			"lx",
			this.processMDLXBlock.bind(this)
		);
	}

	private async processMDLXBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		el.addClass("lx-container");

		try {
			const context = this.getContextForFile(ctx.sourcePath);

			const lexer = new Lexer(source);
			const tokens = lexer.tokenize();

			const parser = new Parser(tokens);
			const ast = parser.parse();

			const evaluator = new Evaluator(context);
			const results = evaluator.evaluate(ast);

			await this.renderer.render(results, el, ctx.sourcePath);
		} catch (error) {
			console.error("MDLX processing error:", error);
			this.renderer.renderError(error as Error, el);
		}
	}

	private getContextForFile(sourcePath: string): ExecutionContext {
		if (!this.contexts.has(sourcePath)) {
			this.contexts.set(sourcePath, new ExecutionContext());
		}
		return this.contexts.get(sourcePath)!;
	}

	private clearContextForFile(sourcePath: string): void {
		this.contexts.delete(sourcePath);
	}

	onunload() {
		this.contexts.clear();
		this.styleManager?.cleanup();
	}
}
