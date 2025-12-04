import { Plugin, MarkdownPostProcessorContext, TFile } from "obsidian";
import { Lexer } from "./src/lexer";
import { Parser } from "./src/parser";
import { Evaluator, ExecutionContext } from "./src/evaluator";
import { Renderer } from "./src/renderer";
import { DynamicStyleManager } from "./src/styleManager";

export default class MDLXPlugin extends Plugin {
	private globalContext: ExecutionContext = new ExecutionContext();
	private processingQueues: Map<string, Promise<void>> = new Map();
	private renderer: Renderer;
	private styleManager: DynamicStyleManager;

	async onload() {
		this.styleManager = new DynamicStyleManager();
		this.renderer = new Renderer(this.app, this.styleManager);
		this.registerMarkdownCodeBlockProcessor(
			"lx",
			this.processMDLXBlock.bind(this)
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile) {
					this.processingQueues.delete(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					const oldQueue = this.processingQueues.get(oldPath);
					if (oldQueue) {
						this.processingQueues.set(file.path, oldQueue);
						this.processingQueues.delete(oldPath);
					}
				}
			})
		);
	}

	private async processMDLXBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	): Promise<void> {
		const previousProcessing = this.processingQueues.get(ctx.sourcePath);

		const currentProcessing = (async () => {
			if (previousProcessing) {
				await previousProcessing.catch(() => {});
			}

			el.addClass("lx-container");

			try {
				const blockContext = new ExecutionContext();
				blockContext.setGlobalContext(this.globalContext);

				const lexer = new Lexer(source);
				const tokens = lexer.tokenize();

				const parser = new Parser(tokens);
				const ast = parser.parse();

				const evaluator = new Evaluator(blockContext);
				const results = evaluator.evaluate(ast);

				await this.renderer.render(results, el, ctx.sourcePath);
			} catch (error) {
				console.error("MDLX processing error:", error);
				this.renderer.renderError(error as Error, el);
			}
		})();

		this.processingQueues.set(ctx.sourcePath, currentProcessing);

		await currentProcessing;
	}

	onunload() {
		this.processingQueues.clear();
		this.styleManager?.cleanup();
	}
}
