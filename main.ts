import { Plugin, MarkdownPostProcessorContext, TFile } from "obsidian";

export default class MDLXPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			"lx",
			this.processLXBlock.bind(this)
		);
	}

	private async processLXBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	) {
		el.addClass("lx-container");
		// lexer parse render
	}
}
