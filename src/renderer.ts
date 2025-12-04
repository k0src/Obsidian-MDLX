import { App, Component, MarkdownRenderer } from "obsidian";
import { EvaluatedValue } from "./evaluator";
import { DynamicStyleManager } from "./styleManager";
import { StyleParser } from "./utilityClasses";

export class Renderer {
	constructor(private app: App, private styleManager: DynamicStyleManager) {}

	async render(
		results: EvaluatedValue[],
		container: HTMLElement,
		sourcePath: string
	): Promise<void> {
		container.empty();

		if (results.length === 0) {
			return;
		}

		for (const result of results) {
			await this.renderValue(result, container, sourcePath);
		}
	}

	private async renderValue(
		value: EvaluatedValue,
		container: HTMLElement,
		sourcePath: string
	): Promise<void> {
		if (value.children && value.children.length > 0) {
			await this.renderValueWithChildren(value, container, sourcePath);
		} else if (value.styles && value.styles.length > 0) {
			await this.renderStyledValue(value, container, sourcePath);
		} else {
			if (value.isMarkdown) {
				await this.renderMarkdown(value.value, container, sourcePath);
			} else {
				this.renderLiteral(value.value, container);
			}
		}
	}

	private async renderValueWithChildren(
		value: EvaluatedValue,
		container: HTMLElement,
		sourcePath: string
	): Promise<void> {
		let wrapper = container;
		if (value.styles && value.styles.length > 0) {
			const className = StyleParser.generateClassName();

			const cssRule = StyleParser.createStyleRule(
				className,
				value.styles
			);

			this.styleManager.addCustomStyle(className, cssRule);

			wrapper = container.createEl("div", {
				cls: className,
			});
		}

		for (const child of value.children!) {
			await this.renderValue(child, wrapper, sourcePath);
		}
	}

	private async renderStyledValue(
		value: EvaluatedValue,
		container: HTMLElement,
		sourcePath: string
	): Promise<void> {
		const className = StyleParser.generateClassName();
		const cssRule = StyleParser.createStyleRule(className, value.styles!);
		this.styleManager.addCustomStyle(className, cssRule);

		const wrapper = container.createEl("div", {
			cls: className,
		});

		if (value.isMarkdown) {
			await this.renderMarkdown(value.value, wrapper, sourcePath);
		} else {
			this.renderLiteral(value.value, wrapper);
		}
	}

	private async renderMarkdown(
		markdown: string,
		container: HTMLElement,
		sourcePath: string
	): Promise<void> {
		const wrapper = container.createEl("div", {
			cls: "lx-markdown-output",
		});

		const component = new Component();

		try {
			await MarkdownRenderer.render(
				this.app,
				markdown,
				wrapper,
				sourcePath,
				component
			);

			component.load();
		} catch (error) {
			console.error("Failed to render markdown:", error);
			wrapper.textContent = markdown;
		}
	}

	private renderLiteral(text: string, container: HTMLElement): void {
		const pre = container.createEl("pre", {
			cls: "lx-literal-output",
		});

		const code = pre.createEl("code");
		code.textContent = text;
	}

	renderError(error: Error, container: HTMLElement): void {
		container.empty();

		const errorDiv = container.createEl("div", {
			cls: "lx-error",
		});
		const errorMessage = errorDiv.createEl("pre", {
			cls: "lx-error-message",
		});

		errorMessage.textContent = error.message;
	}
}
