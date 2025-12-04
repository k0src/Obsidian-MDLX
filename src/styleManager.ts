export class DynamicStyleManager {
	private styleElement: HTMLStyleElement | null = null;
	private customStyles: Map<string, string> = new Map();

	constructor() {
		this.createStyleElement();
	}

	private createStyleElement(): void {
		this.styleElement = document.createElement("style");
		this.styleElement.id = "lt-dynamic-styles";
		document.head.appendChild(this.styleElement);
	}

	addCustomStyle(className: string, css: string): void {
		this.customStyles.set(className, css);
		this.updateStyleElement();
	}

	removeCustomStyle(className: string): void {
		this.customStyles.delete(className);
		this.updateStyleElement();
	}

	private updateStyleElement(): void {
		if (this.styleElement) {
			const allStyles = Array.from(this.customStyles.values()).join("\n");
			this.styleElement.textContent = allStyles;
		}
	}

	cleanup(): void {
		if (this.styleElement) {
			this.styleElement.remove();
			this.styleElement = null;
		}
		this.customStyles.clear();
	}

	getStyleCount(): number {
		return this.customStyles.size;
	}
}
