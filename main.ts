import { Plugin, MarkdownPostProcessorContext, TFile } from "obsidian";
import { Lexer } from "./src/lexer";
import { Parser } from "./src/parser";
import { Evaluator, ExecutionContext } from "./src/evaluator";
import { Renderer } from "./src/renderer";
import { DynamicStyleManager } from "./src/styleManager";

export default class MDLXPlugin extends Plugin {
	private globalContexts: Map<string, ExecutionContext> = new Map();
	private processingQueues: Map<string, Promise<void>> = new Map();
	private processedBlocks: Map<string, Set<HTMLElement>> = new Map();
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
					this.globalContexts.delete(file.path);
					this.processedBlocks.delete(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file instanceof TFile) {
					const queue = this.processingQueues.get(oldPath);
					if (queue) {
						this.processingQueues.set(file.path, queue);
						this.processingQueues.delete(oldPath);
					}
					const context = this.globalContexts.get(oldPath);
					if (context) {
						this.globalContexts.set(file.path, context);
						this.globalContexts.delete(oldPath);
					}
					const blocks = this.processedBlocks.get(oldPath);
					if (blocks) {
						this.processedBlocks.set(file.path, blocks);
						this.processedBlocks.delete(oldPath);
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
		let blocks = this.processedBlocks.get(ctx.sourcePath);
		if (!blocks) {
			blocks = new Set();
			this.processedBlocks.set(ctx.sourcePath, blocks);

			this.globalContexts.delete(ctx.sourcePath);
			this.processingQueues.delete(ctx.sourcePath);
		}

		const isReRender = blocks.has(el);
		if (isReRender) {
			blocks.clear();
			this.globalContexts.delete(ctx.sourcePath);
			this.processingQueues.delete(ctx.sourcePath);
		}

		blocks.add(el);

		const previousProcessing = this.processingQueues.get(ctx.sourcePath);

		const currentProcessing = (async () => {
			if (previousProcessing) {
				await previousProcessing.catch(() => {});
			}

			el.addClass("lx-container");

			try {
				let globalContext = this.globalContexts.get(ctx.sourcePath);
				if (!globalContext) {
					globalContext = new ExecutionContext();
					this.globalContexts.set(ctx.sourcePath, globalContext);
				}

				const blockContext = new ExecutionContext();
				blockContext.setGlobalContext(globalContext);

				const lexer = new Lexer(source);
				const tokens = lexer.tokenize();
				const parser = new Parser(tokens);
				const ast = parser.parse();
				const evaluator = new Evaluator(blockContext);
				const results = evaluator.evaluate(ast);

				await this.renderer.render(results, el, ctx.sourcePath, source);
			} catch (error) {
				console.error("LX processing error:", error);
				this.renderer.renderError(error as Error, el);
			}
		})();

		this.processingQueues.set(ctx.sourcePath, currentProcessing);
		await currentProcessing;
	}

	onunload() {
		this.processingQueues.clear();
		this.globalContexts.clear();
		this.processedBlocks.clear();
		this.styleManager?.cleanup();
	}
}
