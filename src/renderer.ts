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
		if (Array.isArray(value.value)) {
			this.renderArray(value.value, container);
			return;
		}

		if (value.children && value.children.length > 0) {
			await this.renderValueWithChildren(value, container, sourcePath);
		} else if (value.styles && value.styles.length > 0) {
			await this.renderStyledValue(value, container, sourcePath);
		} else {
			const stringValue = String(value.value);

			if (value.isMarkdown) {
				await this.renderMarkdown(stringValue, container, sourcePath);
			} else {
				this.renderLiteral(stringValue, container);
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

		const stringValue = String(value.value);

		if (value.isMarkdown) {
			await this.renderMarkdown(stringValue, wrapper, sourcePath);
		} else {
			this.renderLiteral(stringValue, wrapper);
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

	private renderArray(array: EvaluatedValue[], container: HTMLElement): void {
		const arrayString = this.arrayToString(array);

		const pre = container.createEl("pre", {
			cls: "lx-literal-output",
		});

		const code = pre.createEl("code");
		code.textContent = arrayString;
	}

	private arrayToString(array: EvaluatedValue[]): string {
		const elements = array.map((elem) => {
			if (Array.isArray(elem.value)) {
				return this.arrayToString(elem.value as EvaluatedValue[]);
			}
			return JSON.stringify(elem.value);
		});
		return `[${elements.join(", ")}]`;
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
