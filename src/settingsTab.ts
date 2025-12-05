import { App, PluginSettingTab, Setting } from "obsidian";
import MDLXPlugin from "../main";

export class MDLXSettingTab extends PluginSettingTab {
	plugin: MDLXPlugin;

	constructor(app: App, plugin: MDLXPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "MDLX Settings" });

		new Setting(containerEl)
			.setName("Enable autocomplete suggestions")
			.setDesc(
				"Show autocomplete suggestions when typing @ followed by function/variable names"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.enableAutocompleteSuggestions
					)
					.onChange(async (value) => {
						this.plugin.settings.enableAutocompleteSuggestions =
							value;
						await this.plugin.saveSettings();
					})
			);
	}
}
