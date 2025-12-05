import { EvaluatedValue } from "./evaluator";
import { RuntimeError } from "./evaluator";

export type StdLibFunction = (
	args: EvaluatedValue[],
	line: number,
	column: number
) => EvaluatedValue;

export const STDLIB_FUNCTIONS: Map<string, StdLibFunction> = new Map();

export function isStdLibFunction(name: string): boolean {
	return STDLIB_FUNCTIONS.has(name);
}

export function getStdLibFunction(name: string): StdLibFunction | undefined {
	return STDLIB_FUNCTIONS.get(name);
}

/* ============================= Util Functions ============================= */

function stdlib_len(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@len() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	const value = args[0];

	if (Array.isArray(value.value)) {
		return {
			value: value.value.length,
			isMarkdown: true,
		};
	}

	if (typeof value.value === "string") {
		return {
			value: value.value.length,
			isMarkdown: true,
		};
	}

	throw new RuntimeError(
		`@len() expects a string or array, got ${typeof value.value}`,
		line,
		column
	);
}

function stdlib_join(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@join() expects 1-2 arguments, got ${args.length}`,
			line,
			column
		);
	}

	const array = args[0];
	const separator = args[1] ? String(args[1].value) : "";

	if (!Array.isArray(array.value)) {
		throw new RuntimeError(
			`@join() expects an array as first argument, got ${typeof array.value}`,
			line,
			column
		);
	}

	const joined = (array.value as EvaluatedValue[])
		.map((v) => String(v.value))
		.join(separator);

	return {
		value: joined,
		isMarkdown: true,
	};
}

function stdlib_range(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@range() expects 1-2 arguments, got ${args.length}`,
			line,
			column
		);
	}

	let start: number;
	let end: number;

	if (args.length === 1) {
		start = 0;
		end = Number(args[0].value);
	} else {
		start = Number(args[0].value);
		end = Number(args[1].value);
	}

	if (isNaN(start) || isNaN(end)) {
		throw new RuntimeError(
			`@range() expects numeric arguments`,
			line,
			column
		);
	}

	const result: EvaluatedValue[] = [];
	for (let i = start; i < end; i++) {
		result.push({
			value: i,
			isMarkdown: true,
		});
	}

	return {
		value: result,
		isMarkdown: false,
	};
}

function stdlib_upper(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@upper() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	return {
		value: String(args[0].value).toUpperCase(),
		isMarkdown: args[0].isMarkdown,
	};
}

function stdlib_lower(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@lower() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	return {
		value: String(args[0].value).toLowerCase(),
		isMarkdown: args[0].isMarkdown,
	};
}

/* =========================== Markdown Functions =========================== */

function stdlib_heading(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 2) {
		throw new RuntimeError(
			`@heading() expects 2 arguments (level, text), got ${args.length}`,
			line,
			column
		);
	}

	const level = Number(args[0].value);
	const text = String(args[1].value);

	if (isNaN(level) || level < 1 || level > 6) {
		throw new RuntimeError(
			`@heading() level must be between 1 and 6, got ${level}`,
			line,
			column
		);
	}

	const hashes = "#".repeat(level);
	return {
		value: `${hashes} ${text}`,
		isMarkdown: true,
	};
}

function stdlib_link(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 2) {
		throw new RuntimeError(
			`@link() expects 2 arguments (text, url), got ${args.length}`,
			line,
			column
		);
	}

	const text = String(args[0].value);
	const url = String(args[1].value);

	return {
		value: `[${text}](${url})`,
		isMarkdown: true,
	};
}

function stdlib_img(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@img() expects 1-2 arguments (url, [alt]), got ${args.length}`,
			line,
			column
		);
	}

	const url = String(args[0].value);
	const alt = args[1] ? String(args[1].value) : "";

	return {
		value: `![${alt}](${url})`,
		isMarkdown: true,
	};
}

function stdlib_code(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@code() expects 1-2 arguments (code, [lang]), got ${args.length}`,
			line,
			column
		);
	}

	const code = String(args[0].value);
	const lang = args[1] ? String(args[1].value) : "";

	return {
		value: `\`\`\`${lang}\n${code}\n\`\`\``,
		isMarkdown: true,
	};
}

function stdlib_quote(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@quote() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	const text = String(args[0].value);
	const lines = text.split("\n");
	const quoted = lines.map((l) => `> ${l}`).join("\n");

	return {
		value: quoted,
		isMarkdown: true,
	};
}

function stdlib_list(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@list() expects 1-2 arguments (array, [numbered]), got ${args.length}`,
			line,
			column
		);
	}

	if (!Array.isArray(args[0].value)) {
		throw new RuntimeError(
			`@list() expects an array, got ${typeof args[0].value}`,
			line,
			column
		);
	}

	const items = args[0].value as EvaluatedValue[];
	const numbered = args[1] ? Boolean(args[1].value) : false;

	let lines: string[];
	if (numbered) {
		lines = items.map(
			(item, index) => `${index + 1}. ${String(item.value)}`
		);
	} else {
		lines = items.map((item) => `- ${String(item.value)}`);
	}

	return {
		value: lines.join("\n"),
		isMarkdown: true,
	};
}

function stdlib_table(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 2) {
		throw new RuntimeError(
			`@table() expects 2 arguments (headers, rows), got ${args.length}`,
			line,
			column
		);
	}

	if (!Array.isArray(args[0].value) || !Array.isArray(args[1].value)) {
		throw new RuntimeError(
			`@table() expects two arrays (headers, rows)`,
			line,
			column
		);
	}

	const headers = args[0].value as EvaluatedValue[];
	const rows = args[1].value as EvaluatedValue[];

	const headerRow =
		"| " + headers.map((h) => String(h.value)).join(" | ") + " |";
	const separator = "| " + headers.map(() => "---").join(" | ") + " |";

	const bodyRows = rows.map((row) => {
		if (!Array.isArray(row.value)) {
			return `| ${String(row.value)} |`;
		}
		const cells = row.value as EvaluatedValue[];
		return "| " + cells.map((c) => String(c.value)).join(" | ") + " |";
	});

	const table = [headerRow, separator, ...bodyRows].join("\n");

	return {
		value: table,
		isMarkdown: true,
	};
}

function stdlib_callout(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 2 || args.length > 3) {
		throw new RuntimeError(
			`@callout() expects 2-3 arguments (type, title, [content]), got ${args.length}`,
			line,
			column
		);
	}

	const type = String(args[0].value);
	const title = String(args[1].value);
	const content = args[2] ? String(args[2].value) : "";

	let result = `> [!${type}] ${title}`;
	if (content) {
		const contentLines = content
			.split("\n")
			.map((l) => `> ${l}`)
			.join("\n");
		result += "\n" + contentLines;
	}

	return {
		value: result,
		isMarkdown: true,
	};
}

function stdlib_wiki(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 1 || args.length > 2) {
		throw new RuntimeError(
			`@wiki() expects 1-2 arguments (page, [alias]), got ${args.length}`,
			line,
			column
		);
	}

	const page = String(args[0].value);
	const alias = args[1] ? String(args[1].value) : null;

	if (alias) {
		return {
			value: `[[${page}|${alias}]]`,
			isMarkdown: true,
		};
	}

	return {
		value: `[[${page}]]`,
		isMarkdown: true,
	};
}

function stdlib_tag(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@tag() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	const name = String(args[0].value);
	return {
		value: `#${name}`,
		isMarkdown: true,
	};
}

function stdlib_repeat(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 2) {
		throw new RuntimeError(
			`@repeat() expects 2 arguments (content, count), got ${args.length}`,
			line,
			column
		);
	}

	const content = String(args[0].value);
	const count = Number(args[1].value);

	if (isNaN(count) || count < 0) {
		throw new RuntimeError(
			`@repeat() count must be a positive number, got ${count}`,
			line,
			column
		);
	}

	const repeated = Array(Math.floor(count)).fill(content).join("");

	return {
		value: repeated,
		isMarkdown: args[0].isMarkdown,
	};
}

/* ========================== Layout & Components ========================== */

function stdlib_grid(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 2 || args.length > 3) {
		throw new RuntimeError(
			`@grid() expects 2-3 arguments (columns, items, [gap]), got ${args.length}`,
			line,
			column
		);
	}

	const columns = Number(args[0].value);
	const items = args[1];
	const gap = args[2] ? Number(args[2].value) : 4;

	if (isNaN(columns) || columns < 1) {
		throw new RuntimeError(
			`@grid() columns must be a positive number, got ${columns}`,
			line,
			column
		);
	}

	if (!Array.isArray(items.value)) {
		throw new RuntimeError(
			`@grid() expects an array as second argument, got ${typeof items.value}`,
			line,
			column
		);
	}

	const itemsArray = items.value as EvaluatedValue[];

	return {
		value: "",
		isMarkdown: true,
		children: itemsArray,
		styles: ["grd", `grd-cls-${columns}`, `gp-${gap}`],
	};
}

function stdlib_columns(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 2 || args.length > 3) {
		throw new RuntimeError(
			`@columns() expects 2-3 arguments (count, items, [gap]), got ${args.length}`,
			line,
			column
		);
	}

	const count = Number(args[0].value);
	const items = args[1];
	const gap = args[2] ? Number(args[2].value) : 8;

	if (isNaN(count) || count < 1) {
		throw new RuntimeError(
			`@columns() count must be a positive number, got ${count}`,
			line,
			column
		);
	}

	if (!Array.isArray(items.value)) {
		throw new RuntimeError(
			`@columns() expects an array as second argument, got ${typeof items.value}`,
			line,
			column
		);
	}

	const itemsArray = items.value as EvaluatedValue[];

	return {
		value: "",
		isMarkdown: true,
		children: itemsArray,
		styles: ["grd", `grd-cls-${count}`, `gp-${gap}`],
	};
}

function stdlib_center(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@center() expects 1 argument, got ${args.length}`,
			line,
			column
		);
	}

	const content = String(args[0].value);

	return {
		value: content,
		isMarkdown: args[0].isMarkdown,
		styles: ["flx", "jst-center", "aln-center", "txt-center"],
	};
}

function stdlib_hero(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 2 || args.length > 3) {
		throw new RuntimeError(
			`@hero() expects 2-3 arguments (title, subtitle, [content]), got ${args.length}`,
			line,
			column
		);
	}

	const title = String(args[0].value);
	const subtitle = String(args[1].value);
	const content = args[2] ? String(args[2].value) : null;

	const children: EvaluatedValue[] = [];

	children.push({
		value: `# ${title}`,
		isMarkdown: true,
		styles: ["txt-2xl", "fnt-bold", "mb-2"],
	});

	children.push({
		value: subtitle,
		isMarkdown: true,
		styles: ["txt-lg", "txt-muted", "mb-4"],
	});

	if (content) {
		children.push({
			value: content,
			isMarkdown: true,
		});
	}

	return {
		value: "",
		isMarkdown: true,
		children,
		styles: ["p-12", "txt-center"],
	};
}

function stdlib_feature(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 3) {
		throw new RuntimeError(
			`@feature() expects 3 arguments (icon, title, description), got ${args.length}`,
			line,
			column
		);
	}

	const icon = String(args[0].value);
	const title = String(args[1].value);
	const desc = String(args[2].value);

	const children: EvaluatedValue[] = [
		{
			value: icon,
			isMarkdown: true,
			styles: ["txt-4xl", "mb-2"],
		},
		{
			value: `### ${title}`,
			isMarkdown: true,
			styles: ["fnt-semibold", "mb-2"],
		},
		{
			value: desc,
			isMarkdown: true,
			styles: ["txt-muted"],
		},
	];

	return {
		value: "",
		isMarkdown: true,
		children,
		styles: ["p-6", "txt-center"],
	};
}

function stdlib_figure(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length < 2 || args.length > 3) {
		throw new RuntimeError(
			`@figure() expects 2 arguments (image, caption), got ${args.length}`,
			line,
			column
		);
	}

	const image = String(args[0].value);
	const caption = String(args[1].value);

	const children: EvaluatedValue[] = [
		{
			value: `![[${image}]]`,
			isMarkdown: true,
			styles: ["blck", "ml-auto", "mr-auto"],
		},
		{
			value: caption,
			isMarkdown: true,
			styles: ["txt-sm", "txt-muted"],
		},
	];

	return {
		value: "",
		isMarkdown: true,
		children,
		styles: ["my-4", "flx", "flx-col", "aln-center", "jst-center"],
	};
}

function stdlib_dl(
	args: EvaluatedValue[],
	line: number,
	column: number
): EvaluatedValue {
	if (args.length !== 1) {
		throw new RuntimeError(
			`@dl() expects 1 argument (terms), got ${args.length}`,
			line,
			column
		);
	}

	if (!Array.isArray(args[0].value)) {
		throw new RuntimeError(
			`@dl() expects an array of [term, definition] pairs`,
			line,
			column
		);
	}

	const terms = args[0].value as EvaluatedValue[];
	const items: string[] = [];

	for (const term of terms) {
		if (!Array.isArray(term.value) || term.value.length !== 2) {
			throw new RuntimeError(
				`@dl() expects an array of [term, definition] pairs`,
				line,
				column
			);
		}
		const pair = term.value as EvaluatedValue[];
		const dt = String(pair[0].value);
		const dd = String(pair[1].value);
		items.push(`**${dt}**:\n ${dd}`);
	}

	return {
		value: items.join("\n\n"),
		isMarkdown: true,
	};
}

STDLIB_FUNCTIONS.set("@len", stdlib_len);
STDLIB_FUNCTIONS.set("@join", stdlib_join);
STDLIB_FUNCTIONS.set("@range", stdlib_range);
STDLIB_FUNCTIONS.set("@upper", stdlib_upper);
STDLIB_FUNCTIONS.set("@lower", stdlib_lower);
STDLIB_FUNCTIONS.set("@repeat", stdlib_repeat);
STDLIB_FUNCTIONS.set("@heading", stdlib_heading);
STDLIB_FUNCTIONS.set("@link", stdlib_link);
STDLIB_FUNCTIONS.set("@img", stdlib_img);
STDLIB_FUNCTIONS.set("@code", stdlib_code);
STDLIB_FUNCTIONS.set("@quote", stdlib_quote);
STDLIB_FUNCTIONS.set("@list", stdlib_list);
STDLIB_FUNCTIONS.set("@table", stdlib_table);
STDLIB_FUNCTIONS.set("@callout", stdlib_callout);
STDLIB_FUNCTIONS.set("@wiki", stdlib_wiki);
STDLIB_FUNCTIONS.set("@tag", stdlib_tag);
STDLIB_FUNCTIONS.set("@grid", stdlib_grid);
STDLIB_FUNCTIONS.set("@columns", stdlib_columns);
STDLIB_FUNCTIONS.set("@center", stdlib_center);
STDLIB_FUNCTIONS.set("@hero", stdlib_hero);
STDLIB_FUNCTIONS.set("@feature", stdlib_feature);
STDLIB_FUNCTIONS.set("@figure", stdlib_figure);
STDLIB_FUNCTIONS.set("@dl", stdlib_dl);
