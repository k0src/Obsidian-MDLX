import { Plugin, MarkdownPostProcessorContext, TFile } from "obsidian";
import { Lexer } from "./src/lexer";
import { Parser } from "./src/parser";
import { Evaluator, ExecutionContext } from "./src/evaluator";
import { Renderer } from "./src/renderer";
import { DynamicStyleManager } from "./src/styleManager";
import { MDLXSuggest } from "./src/mdlxSuggest";
import { MDLXSettings, DEFAULT_SETTINGS } from "./src/settings";
import { MDLXSettingTab } from "./src/settingsTab";
import {
	addLxMode,
	addLxSyntaxHighlight,
	removeLxMode,
} from "./src/syntaxHighlighting";

export default class MDLXPlugin extends Plugin {
	settings: MDLXSettings;
	private globalContexts: Map<string, ExecutionContext> = new Map();
	private processingQueues: Map<string, Promise<void>> = new Map();
	private processedBlocks: Map<string, Set<HTMLElement>> = new Map();
	private renderer: Renderer;
	private styleManager: DynamicStyleManager;

	async onload() {
		await this.loadSettings();

		this.styleManager = new DynamicStyleManager();
		this.renderer = new Renderer(this.app, this.styleManager);
		this.registerEditorSuggest(new MDLXSuggest(this));

		this.addSettingTab(new MDLXSettingTab(this.app, this));

		addLxMode();
		if (window.CodeMirror) {
			addLxSyntaxHighlight(window.CodeMirror);
		}

		this.registerMarkdownCodeBlockProcessor(
			"lx",
			this.processMDLXBlock.bind(this)
		);

		this.registerEvent(
			this.app.workspace.on("file-open", async (file) => {
				if (file) {
					await this.preProcessFile(file);
				}
			})
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
				console.error("MDLX processing error:", error);
				this.renderer.renderError(error as Error, el);
			}
		})();

		this.processingQueues.set(ctx.sourcePath, currentProcessing);
		await currentProcessing;
	}

	private async preProcessFile(file: TFile): Promise<void> {
		if (this.globalContexts.has(file.path)) {
			return;
		}

		const content = await this.app.vault.read(file);
		const lxBlockRegex = /```lx\n([\s\S]*?)```/g;
		const matches = Array.from(content.matchAll(lxBlockRegex));

		if (matches.length === 0) {
			return;
		}

		const globalContext = new ExecutionContext();
		this.globalContexts.set(file.path, globalContext);

		for (const match of matches) {
			const source = match[1];
			try {
				const lexer = new Lexer(source);
				const tokens = lexer.tokenize();
				const parser = new Parser(tokens);
				const ast = parser.parse();
				const evaluator = new Evaluator(globalContext);

				for (const statement of ast.statements) {
					if (statement.type === "Variable" && statement.isGlobal) {
						evaluator.evaluateStatement(statement);
					} else if (
						statement.type === "Function" &&
						statement.isGlobal
					) {
						evaluator.evaluateStatement(statement);
					}
				}
			} catch (error) {
				console.warn("MDLX pre-processing error:", error);
			}
		}
	}

	onunload() {
		this.processingQueues.clear();
		this.globalContexts.clear();
		this.processedBlocks.clear();
		this.styleManager?.cleanup();
		removeLxMode();
	}

	getGlobalContext(filePath: string): ExecutionContext | undefined {
		return this.globalContexts.get(filePath);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
